/**
 * Demo-mode API layer.
 *
 * Patches window.fetch and answers every /api/* call from fixtures, so the whole
 * UI runs with no server, no database, and no Ollama. Components are untouched —
 * they still call fetch exactly as they do against the real backend.
 *
 * Streaming responses are re-created as real ReadableStreams emitting SSE frames
 * on a timer, so chat and benchmark stream token by token the way they do live.
 */
import {
  DEMO_USER, DEMO_DOCUMENTS, DEMO_COLLECTIONS, DEMO_COLLECTION_DOCS,
  DEMO_PROMPTS, DEMO_MODELS, DEMO_SESSIONS, DEMO_MESSAGES, DEMO_CITATIONS,
  DEMO_METRICS, DEMO_BENCHMARK, DEMO_EVAL_CASES, DEMO_EVAL_RESULTS,
  DEMO_API_KEYS, DEMO_AUDIT, DEMO_AUDIT_STATS,
  CANNED_ANSWERS, FALLBACK_ANSWER,
} from "./fixtures";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Mutable copies so create/delete actions feel real for the session. */
const state = {
  sessions: [...DEMO_SESSIONS],
  messages: { ...DEMO_MESSAGES } as Record<string, Array<Record<string, unknown>>>,
  documents: [...DEMO_DOCUMENTS],
  collections: [...DEMO_COLLECTIONS],
  prompts: [...DEMO_PROMPTS],
  apiKeys: [...DEMO_API_KEYS],
  evalCases: [] as typeof DEMO_EVAL_CASES,
};

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idCounter++}`;

/** Emits SSE frames from an async generator on a real ReadableStream. */
function sseResponse(produce: (emit: (data: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        await produce(emit);
      } catch {
        emit({ type: "error", error: "demo stream ended" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

/** Splits text into streamable pieces that keep markdown and code intact. */
function tokenize(text: string): string[] {
  return text.match(/\s*\S+/g) ?? [text];
}

async function handleChat(body: Record<string, unknown>): Promise<Response> {
  const message = String(body.message ?? "");
  const sessionId = String(body.sessionId ?? "");
  const override = body.modelOverride ? String(body.modelOverride) : "";
  const hasDocs = Array.isArray(body.documentIds) && body.documentIds.length > 0;

  const answer = CANNED_ANSWERS.find((a) => a.match.test(message)) ?? FALLBACK_ANSWER;
  const model = override || answer.model;
  const citations = hasDocs || answer.citations.length > 0 ? answer.citations : [];

  return sseResponse(async (emit) => {
    await sleep(280); // retrieval + first-token latency
    emit({
      type: "meta",
      model,
      category: answer.category,
      reason: override ? "manual override" : answer.reason,
      ragChunks: citations,
    });

    const pieces = tokenize(answer.content);
    const started = Date.now();
    for (const piece of pieces) {
      await sleep(18 + Math.random() * 26);
      emit({ type: "token", content: piece });
    }

    const elapsed = (Date.now() - started) / 1000;
    const tokens = pieces.length;
    const msgId = nextId("m");

    // Persist so switching sessions shows the exchange.
    if (sessionId) {
      const list = state.messages[sessionId] ?? (state.messages[sessionId] = []);
      list.push({ id: nextId("m"), role: "user", content: message, created_at: Date.now() });
      list.push({
        id: msgId, role: "assistant", content: answer.content,
        created_at: Date.now(), model_used: model,
        tokens_generated: tokens,
        tokens_per_second: +(tokens / elapsed).toFixed(1),
        latency_ms: 280,
      });
      const s = state.sessions.find((x) => x.id === sessionId);
      if (s) { s.message_count = list.length; s.updated_at = Date.now(); s.model_used = model; }
    }

    emit({
      type: "done",
      messageId: msgId,
      metrics: {
        tokensGenerated: tokens,
        tokensPerSecond: +(tokens / elapsed).toFixed(1),
        latencyMs: 280,
      },
    });
  });
}

async function handleBenchmark(body: Record<string, unknown>): Promise<Response> {
  const models = (Array.isArray(body.models) ? body.models : []).map(String).slice(0, 6);

  return sseResponse(async (emit) => {
    const streams = models.map((model) => {
      const canned = DEMO_BENCHMARK[model] ?? {
        text:
          `\`${model}\` is not part of the recorded demo set, so there is no captured ` +
          `output for it. Running Prism locally benchmarks whichever models you have installed.`,
        tps: 28, latency: 400,
      };
      return { model, pieces: tokenize(canned.text), canned, i: 0, started: 0 };
    });

    await sleep(200);
    for (const s of streams) s.started = Date.now();

    // Round-robin so all models appear to stream in parallel, paced by their tok/s.
    let remaining = streams.filter((s) => s.i < s.pieces.length);
    while (remaining.length > 0) {
      for (const s of remaining) {
        emit({ type: "token", model: s.model, content: s.pieces[s.i] });
        s.i++;
      }
      await sleep(34);
      remaining = streams.filter((s) => s.i < s.pieces.length);
    }

    // The benchmark endpoint puts metrics flat on the done frame — unlike
    // /api/chat, which nests them under `metrics`.
    for (const s of streams) {
      emit({
        type: "done",
        model: s.model,
        tokensGenerated: s.pieces.length,
        tokensPerSecond: s.canned.tps,
        latencyMs: s.canned.latency,
      });
    }
  });
}

function handleSearch(q: string): Response {
  const needle = q.toLowerCase();
  const hit = (s: string) => s.toLowerCase().includes(needle);
  if (!needle) {
    return json({ sessions: [], messages: [], documents: [], prompts: [], collections: [] });
  }
  return json({
    sessions: state.sessions.filter((s) => hit(s.title))
      .map((s) => ({ id: s.id, title: s.title, updated_at: s.updated_at })),
    messages: Object.entries(state.messages).flatMap(([sid, msgs]) =>
      msgs.filter((m) => hit(String(m.content))).slice(0, 2).map((m) => ({
        id: String(m.id), session_id: sid,
        snippet: String(m.content).slice(0, 140),
        role: String(m.role), created_at: Number(m.created_at),
        session_title: state.sessions.find((s) => s.id === sid)?.title ?? "Chat",
      }))
    ).slice(0, 5),
    documents: state.documents.filter((d) => hit(d.filename)),
    prompts: state.prompts.filter((p) => hit(p.title) || hit(p.content))
      .map((p) => ({ id: p.id, title: p.title, snippet: p.content.slice(0, 120), category: p.category, is_team: p.is_team })),
    collections: state.collections.filter((c) => hit(c.name) || hit(c.description))
      .map((c) => ({ id: c.id, name: c.name, description: c.description, doc_count: c.doc_count })),
  });
}

async function route(url: URL, init: RequestInit | undefined): Promise<Response | null> {
  const path = url.pathname;
  const method = (init?.method ?? "GET").toUpperCase();
  let body: Record<string, unknown> = {};
  if (init?.body && typeof init.body === "string") {
    try { body = JSON.parse(init.body); } catch { /* not JSON */ }
  }

  // ── auth ──
  if (path === "/api/auth") {
    if (method === "GET") {
      return url.searchParams.get("me") === "1"
        ? json({ user: DEMO_USER })
        : json({ hasUsers: true });
    }
    if (body.action === "logout") return json({ success: true });
    return json({ user: DEMO_USER });
  }

  // ── models ──
  if (path === "/api/models") {
    if (method === "GET") {
      return json({
        models: DEMO_MODELS, healthy: true,
        routerConfig: {
          codeModels: ["qwen2.5-coder:7b"],
          generalModels: ["llama3.2:3b"],
          mathModels: ["phi3.5:3.8b"],
          domainModels: ["phi3.5:3.8b"],
          defaultModel: "llama3.2:3b",
        },
      });
    }
    return json({ error: "Pulling and deleting models is disabled in the demo." }, 403);
  }

  // ── sessions ──
  if (path === "/api/sessions") {
    if (method === "GET") {
      const id = url.searchParams.get("id");
      if (id) return json({ messages: state.messages[id] ?? [] });
      return json({ sessions: state.sessions });
    }
    if (method === "POST") {
      const id = nextId("s");
      state.sessions.unshift({
        id, title: String(body.title ?? "New Chat"),
        created_at: Date.now(), updated_at: Date.now(), message_count: 0,
      });
      state.messages[id] = [];
      return json({ id });
    }
    if (method === "PATCH") {
      const s = state.sessions.find((x) => x.id === body.id);
      if (s) s.title = String(body.title);
      return json({ success: true });
    }
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      state.sessions = state.sessions.filter((s) => s.id !== id);
      return json({ success: true });
    }
  }

  // ── chat + benchmark (streaming) ──
  if (path === "/api/chat" && method === "POST") return handleChat(body);
  if (path === "/api/benchmark" && method === "POST") return handleBenchmark(body);

  // ── documents ──
  if (path === "/api/documents") {
    if (method === "GET") return json({ documents: state.documents });
    if (method === "POST") {
      const form = init?.body instanceof FormData ? init.body : null;
      const file = form?.get("file") as File | null;
      await sleep(700); // embedding pass
      const doc = {
        id: nextId("doc"),
        filename: file?.name ?? "uploaded-file.txt",
        mimetype: file?.type || "text/plain",
        size_bytes: file?.size ?? 1024,
        chunk_count: Math.max(3, Math.round((file?.size ?? 4096) / 1600)),
        embed_model: "nomic-embed-text",
        created_at: Date.now(),
        user_id: DEMO_USER.id,
      };
      state.documents = [doc, ...state.documents];
      return json({ document: doc, chunks: doc.chunk_count });
    }
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      state.documents = state.documents.filter((d) => d.id !== id);
      return json({ success: true });
    }
  }

  // ── collections ──
  if (path.startsWith("/api/collections")) {
    const m = path.match(/^\/api\/collections\/([^/]+)\/documents$/);
    if (m) {
      const ids = DEMO_COLLECTION_DOCS[m[1]] ?? [];
      if (method === "GET") {
        return json({ documents: state.documents.filter((d) => ids.includes(d.id)) });
      }
      return json({ success: true });
    }
    if (method === "GET") return json({ collections: state.collections });
    if (method === "POST") {
      const c = {
        id: nextId("col"), name: String(body.name ?? "Untitled"),
        description: String(body.description ?? ""), user_id: DEMO_USER.id,
        is_team: Number(body.isTeam ?? 0), doc_count: 0,
        created_at: Date.now(), updated_at: Date.now(),
      };
      state.collections = [c, ...state.collections];
      return json({ collection: c });
    }
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      state.collections = state.collections.filter((c) => c.id !== id);
      return json({ success: true });
    }
    return json({ success: true });
  }

  // ── prompts ──
  if (path === "/api/prompts") {
    if (method === "GET") return json({ prompts: state.prompts });
    if (method === "POST") {
      const p = {
        id: nextId("p"), title: String(body.title ?? "Untitled"),
        content: String(body.content ?? ""), category: String(body.category ?? "General"),
        variables: JSON.stringify(body.variables ?? []),
        is_team: Number(body.isTeam ?? 0), user_id: DEMO_USER.id,
        use_count: 0, created_at: Date.now(),
      };
      state.prompts = [p, ...state.prompts];
      return json({ prompt: p });
    }
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      state.prompts = state.prompts.filter((p) => p.id !== id);
      return json({ success: true });
    }
    return json({ success: true });
  }

  // ── retrieval evals ──
  if (path === "/api/rag-eval") {
    if (body.action === "generate") {
      await sleep(1400);
      state.evalCases = [...DEMO_EVAL_CASES];
      return json({ cases: state.evalCases });
    }
    await sleep(1100);
    return json(DEMO_EVAL_RESULTS);
  }

  // ── everything else ──
  if (path === "/api/metrics") return json(DEMO_METRICS);
  if (path === "/api/search") return handleSearch(url.searchParams.get("q") ?? "");
  if (path === "/api/audit") {
    return url.searchParams.get("stats") === "1" ? json(DEMO_AUDIT_STATS) : json(DEMO_AUDIT);
  }
  if (path === "/api/keys") {
    if (method === "GET") return json({ keys: state.apiKeys });
    if (method === "POST") {
      const key = { id: nextId("k"), name: String(body.name ?? "New key"), user_id: DEMO_USER.id, last_used_at: null, created_at: Date.now() };
      state.apiKeys = [key, ...state.apiKeys];
      return json({ key, plaintext: `prism_demo${"0123456789abcdef".repeat(2)}` });
    }
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      state.apiKeys = state.apiKeys.filter((k) => k.id !== id);
      return json({ success: true });
    }
  }
  if (path === "/api/rag") {
    return json({ chunks: DEMO_CITATIONS["s-ratelimit"] });
  }
  if (path === "/api/settings") {
    if (method === "GET") return json({ settings: {} });
    return json({ success: true });
  }
  if (path === "/api/users") {
    if (method === "GET") return json({ users: [{ ...DEMO_USER, created_at: Date.now() - 12 * 86_400_000 }] });
    return json({ error: "User management is disabled in the demo." }, 403);
  }

  return json({ error: "Not available in the demo." }, 404);
}

let installed = false;

export function installDemoFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const realFetch = window.fetch.bind(window);

  async function serveDemo(
    url: URL,
    input: RequestInfo | URL,
    init: RequestInit | undefined
  ): Promise<Response> {
    // A Request object carries its own method/body — normalise before routing.
    let effInit = init;
    if (typeof input !== "string" && !(input instanceof URL)) {
      const req = input as Request;
      effInit = { method: req.method, body: init?.body ?? (await req.clone().text()), ...init };
    }
    const res = await route(url, effInit);
    return res ?? json({ error: "Not available in the demo." }, 404);
  }

  /* Deliberately synchronous. Next's router fetches RSC payloads through this
     same function during hydration; wrapping those in an extra async frame
     stalls the Suspense boundary. Only /api/ requests are diverted, and
     everything else returns the original promise untouched. */
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    let url: URL | null = null;
    try {
      const href =
        typeof input === "string" ? input :
        input instanceof URL ? input.href :
        input.url;
      url = new URL(href, window.location.origin);
    } catch {
      return realFetch(input, init);
    }

    if (!url.pathname.startsWith("/api/")) return realFetch(input, init);

    // Debug aid: confirms from the console which calls the demo layer served.
    const w = window as unknown as { __demoCalls?: string[] };
    (w.__demoCalls ??= []).push(`${(init?.method ?? "GET").toUpperCase()} ${url.pathname}`);

    return serveDemo(url, input, init);
  };
}
