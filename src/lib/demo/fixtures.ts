/**
 * Canned data for demo mode.
 *
 * The narrative: a developer at "Northwind" has loaded three internal documents
 * and is asking questions about them. Every answer cites real passages from
 * those documents, so the demo shows retrieval working rather than describing it.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = () => Date.now();

export const DEMO_USER = { id: "demo-user", username: "demo", role: "admin" as const };

// ── Documents ────────────────────────────────────────────────────────────
export const DEMO_DOCUMENTS = [
  {
    id: "doc-api",
    filename: "northwind-api-reference.md",
    mimetype: "text/markdown",
    size_bytes: 48_210,
    chunk_count: 34,
    embed_model: "nomic-embed-text",
    created_at: now() - 6 * DAY,
    user_id: DEMO_USER.id,
  },
  {
    id: "doc-handbook",
    filename: "engineering-handbook.md",
    mimetype: "text/markdown",
    size_bytes: 71_940,
    chunk_count: 52,
    embed_model: "nomic-embed-text",
    created_at: now() - 5 * DAY,
    user_id: DEMO_USER.id,
  },
  {
    id: "doc-postmortem",
    filename: "incident-2024-11-postmortem.pdf",
    mimetype: "application/pdf",
    size_bytes: 26_780,
    chunk_count: 19,
    embed_model: "nomic-embed-text",
    created_at: now() - 2 * DAY,
    user_id: DEMO_USER.id,
  },
];

// ── Collections ──────────────────────────────────────────────────────────
export const DEMO_COLLECTIONS = [
  {
    id: "col-platform",
    name: "Platform docs",
    description: "API reference and the engineering handbook.",
    user_id: DEMO_USER.id,
    is_team: 1,
    doc_count: 2,
    created_at: now() - 6 * DAY,
    updated_at: now() - 2 * DAY,
  },
  {
    id: "col-incidents",
    name: "Incident reports",
    description: "Postmortems from the last two quarters.",
    user_id: DEMO_USER.id,
    is_team: 0,
    doc_count: 1,
    created_at: now() - 2 * DAY,
    updated_at: now() - 2 * DAY,
  },
];

export const DEMO_COLLECTION_DOCS: Record<string, string[]> = {
  "col-platform": ["doc-api", "doc-handbook"],
  "col-incidents": ["doc-postmortem"],
};

// ── Prompts ──────────────────────────────────────────────────────────────
export const DEMO_PROMPTS = [
  {
    id: "p-review",
    title: "Review this code",
    content:
      "Review the following {{language}} code. Flag correctness bugs first, then " +
      "readability. Be specific about line numbers.\n\n{{code}}",
    category: "Engineering",
    variables: JSON.stringify(["language", "code"]),
    is_team: 1,
    user_id: DEMO_USER.id,
    use_count: 23,
    created_at: now() - 12 * DAY,
  },
  {
    id: "p-summarize",
    title: "Summarize for a standup",
    content:
      "Summarize {{document}} in three bullets a teammate could read aloud at " +
      "standup. Lead with what changed.",
    category: "Writing",
    variables: JSON.stringify(["document"]),
    is_team: 1,
    user_id: DEMO_USER.id,
    use_count: 11,
    created_at: now() - 9 * DAY,
  },
  {
    id: "p-sql",
    title: "Explain this query",
    content:
      "Explain what this SQL does in plain language, then note any index that " +
      "would make it faster.\n\n{{query}}",
    category: "Data",
    variables: JSON.stringify(["query"]),
    is_team: 0,
    user_id: DEMO_USER.id,
    use_count: 7,
    created_at: now() - 4 * DAY,
  },
];

// ── Models ───────────────────────────────────────────────────────────────
export const DEMO_MODELS = [
  {
    name: "llama3.2:3b",
    size: 2_019_393_189,
    digest: "a80c4f17acd5",
    modified_at: new Date(now() - 8 * DAY).toISOString(),
    details: { family: "llama", parameter_size: "3.2B", quantization_level: "Q4_K_M" },
  },
  {
    name: "qwen2.5-coder:7b",
    size: 4_683_075_271,
    digest: "2b0496514337",
    modified_at: new Date(now() - 6 * DAY).toISOString(),
    details: { family: "qwen2", parameter_size: "7.6B", quantization_level: "Q4_K_M" },
  },
  {
    name: "phi3.5:3.8b",
    size: 2_176_178_913,
    digest: "61819fb370a3",
    modified_at: new Date(now() - 3 * DAY).toISOString(),
    details: { family: "phi3", parameter_size: "3.8B", quantization_level: "Q4_0" },
  },
  {
    name: "nomic-embed-text",
    size: 274_302_450,
    digest: "0a109f422b47",
    modified_at: new Date(now() - 8 * DAY).toISOString(),
    details: { family: "nomic-bert", parameter_size: "137M", quantization_level: "F16" },
  },
];

// ── Chat sessions ────────────────────────────────────────────────────────
/** Rows are snake_case because the real endpoint returns raw SQLite rows. */
export interface DemoSession {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  message_count: number;
  model_used?: string;
}

export const DEMO_SESSIONS: DemoSession[] = [
  { id: "s-ratelimit", title: "What is our API rate limit?", created_at: now() - 3 * HOUR, updated_at: now() - 3 * HOUR, message_count: 2, model_used: "llama3.2:3b" },
  { id: "s-deploy", title: "How do deploys work here?", created_at: now() - DAY, updated_at: now() - DAY, message_count: 2, model_used: "llama3.2:3b" },
  { id: "s-incident", title: "Summarize the November outage", created_at: now() - 2 * DAY, updated_at: now() - 2 * DAY, message_count: 2, model_used: "phi3.5:3.8b" },
];

/** Message rows use snake_case — the chat UI maps them straight from SQLite. */
export const DEMO_MESSAGES: Record<string, Array<Record<string, unknown>>> = {
  "s-ratelimit": [
    {
      id: "m-1", role: "user",
      content: "What is our API rate limit, and does it differ for enterprise accounts?",
      created_at: now() - 3 * HOUR,
    },
    {
      id: "m-2", role: "assistant",
      content:
        "Northwind enforces two separate limits.\n\n" +
        "**Standard accounts** are capped at **120 requests per minute** per API key, " +
        "measured as a sliding window (Source 1).\n\n" +
        "**Enterprise accounts** are raised to **500 requests per minute**, and burst " +
        "traffic up to 1,000 RPM is tolerated for 30 seconds before throttling begins " +
        "(Source 1).\n\n" +
        "When you exceed the limit the API returns `429 Too Many Requests` with a " +
        "`Retry-After` header in seconds — the handbook asks clients to respect that " +
        "header rather than retrying on a fixed interval (Source 2).",
      created_at: now() - 3 * HOUR + 4000,
      model_used: "llama3.2:3b",
      tokens_generated: 142,
      tokens_per_second: 38.4,
      latency_ms: 312,
    },
  ],
  "s-deploy": [
    {
      id: "m-3", role: "user",
      content: "How do deploys work here? What do I need to do to ship?",
      created_at: now() - DAY,
    },
    {
      id: "m-4", role: "assistant",
      content:
        "Deploys are trunk-based and fully automated (Source 1).\n\n" +
        "1. Open a pull request against `main`. CI runs unit tests, typecheck, and a " +
        "migration dry-run.\n" +
        "2. One approving review is required. The branch must be current with `main`.\n" +
        "3. Merging triggers a canary release to 5% of traffic for 10 minutes.\n" +
        "4. If error rate stays under 0.5%, the rollout proceeds automatically.\n\n" +
        "You do not need to do anything manual to promote a release. Rollback is " +
        "`northwind deploy rollback <sha>` and takes about 40 seconds (Source 1).",
      created_at: now() - DAY + 5200,
      model_used: "llama3.2:3b",
      tokens_generated: 128,
      tokens_per_second: 41.2,
      latency_ms: 287,
    },
  ],
  "s-incident": [
    {
      id: "m-5", role: "user",
      content: "Summarize the November incident and what we changed afterwards.",
      created_at: now() - 2 * DAY,
    },
    {
      id: "m-6", role: "assistant",
      content:
        "**What happened.** On 12 November a schema migration added a non-null column " +
        "to `orders` without a default. The migration held an exclusive lock for 8 " +
        "minutes, and checkout requests timed out behind it (Source 1).\n\n" +
        "**Impact.** 41 minutes of degraded checkout, roughly 2,300 failed orders.\n\n" +
        "**Root cause.** The migration dry-run ran against a staging database with " +
        "12,000 rows. Production had 47 million (Source 1).\n\n" +
        "**Changes made.** Dry-runs now execute against a production-sized snapshot, " +
        "and any migration holding a lock for more than 2 seconds fails CI automatically.",
      created_at: now() - 2 * DAY + 6100,
      model_used: "phi3.5:3.8b",
      tokens_generated: 156,
      tokens_per_second: 33.8,
      latency_ms: 355,
    },
  ],
};

/** Citations attached to the seeded assistant answers. */
export const DEMO_CITATIONS: Record<string, Array<Record<string, unknown>>> = {
  "s-ratelimit": [
    {
      id: "c-1", filename: "northwind-api-reference.md", chunkIndex: 11,
      score: 1, vectorScore: 0.83, keywordScore: 1,
      preview:
        "Rate limiting. Standard API keys are limited to 120 requests per minute. " +
        "Enterprise plans are raised to 500 requests per minute with burst tolerance",
    },
    {
      id: "c-2", filename: "engineering-handbook.md", chunkIndex: 27,
      score: 0.71, vectorScore: 0.79, keywordScore: 0.42,
      preview:
        "Clients must honour the Retry-After header returned with 429 responses. " +
        "Fixed-interval retries are the most common cause of self-inflicted throttling",
    },
  ],
  "s-deploy": [
    {
      id: "c-3", filename: "engineering-handbook.md", chunkIndex: 8,
      score: 1, vectorScore: 0.88, keywordScore: 0.76,
      preview:
        "Deployment. We practise trunk-based development. Merging to main triggers a " +
        "canary release to 5% of traffic for ten minutes before automatic promotion",
    },
  ],
  "s-incident": [
    {
      id: "c-4", filename: "incident-2024-11-postmortem.pdf", chunkIndex: 3,
      score: 1, vectorScore: 0.91, keywordScore: 0.68,
      preview:
        "Timeline. 14:02 UTC migration 0184 begins. The ALTER TABLE acquires an " +
        "ACCESS EXCLUSIVE lock on orders, which is held for 8 minutes 11 seconds",
    },
  ],
};

// ── Canned answers for newly typed questions ─────────────────────────────
interface CannedAnswer {
  match: RegExp;
  model: string;
  category: string;
  reason: string;
  citations: Array<Record<string, unknown>>;
  content: string;
}

export const CANNED_ANSWERS: CannedAnswer[] = [
  {
    match: /rate limit|throttl|429|quota/i,
    model: "llama3.2:3b",
    category: "general",
    reason: "general question, smallest capable model",
    citations: DEMO_CITATIONS["s-ratelimit"],
    content:
      "Standard API keys are limited to **120 requests per minute**; enterprise " +
      "accounts get **500 requests per minute** with a 30-second burst allowance up " +
      "to 1,000 RPM (Source 1).\n\n" +
      "Exceeding the limit returns `429` with a `Retry-After` header, and clients are " +
      "expected to honour that header rather than retrying on a fixed interval " +
      "(Source 2).",
  },
  {
    match: /deploy|ship|release|rollback|ci\b/i,
    model: "llama3.2:3b",
    category: "general",
    reason: "general question, smallest capable model",
    citations: DEMO_CITATIONS["s-deploy"],
    content:
      "Deploys are trunk-based and automated (Source 1). Open a PR against `main`, " +
      "get one approving review, and merge — that triggers a canary to 5% of traffic " +
      "for ten minutes, then automatic promotion if the error rate holds under 0.5%.\n\n" +
      "Rollback is a single command and completes in roughly 40 seconds.",
  },
  {
    match: /incident|outage|postmortem|down|failure/i,
    model: "phi3.5:3.8b",
    category: "domain",
    reason: "domain document lookup",
    citations: DEMO_CITATIONS["s-incident"],
    content:
      "The 12 November incident was caused by a migration that added a non-null " +
      "column without a default, holding an exclusive lock on `orders` for 8 minutes " +
      "and timing out checkout requests (Source 1).\n\n" +
      "It lasted 41 minutes and failed about 2,300 orders. The dry-run had run against " +
      "a 12,000-row staging database while production held 47 million rows.",
  },
  {
    match: /function|code|bug|refactor|typescript|python|sql/i,
    model: "qwen2.5-coder:7b",
    category: "code",
    reason: "code keywords detected, routed to the coder model",
    citations: [],
    content:
      "Routing sent this to `qwen2.5-coder:7b` because the prompt contains code " +
      "keywords.\n\n" +
      "```ts\nexport function debounce<T extends (...a: never[]) => void>(\n" +
      "  fn: T,\n  ms = 200,\n) {\n  let t: ReturnType<typeof setTimeout>;\n" +
      "  return (...args: Parameters<T>) => {\n    clearTimeout(t);\n" +
      "    t = setTimeout(() => fn(...args), ms);\n  };\n}\n```\n\n" +
      "In the live app this response streams from a model running on your own " +
      "machine — this demo replays a recorded answer.",
  },
];

export const FALLBACK_ANSWER: CannedAnswer = {
  match: /.*/,
  model: "llama3.2:3b",
  category: "general",
  reason: "no specialised keywords, default model",
  citations: [],
  content:
    "You're looking at a recorded demo, so this reply is canned rather than " +
    "generated — but everything around it is the real interface.\n\n" +
    "Try asking about the **rate limit**, the **deploy process**, or the " +
    "**November incident**. Those questions run against the three documents in " +
    "the sidebar and return real citations, which is the part worth seeing.\n\n" +
    "Running Prism locally against Ollama gives you genuine answers over your own " +
    "files, with nothing leaving the machine.",
};

// ── Telemetry ────────────────────────────────────────────────────────────
function buildSeries() {
  const tpsSeries: { time: number; tps: number; model: string }[] = [];
  const ramSeries: { time: number; ram: number }[] = [];
  const models = ["llama3.2:3b", "qwen2.5-coder:7b", "phi3.5:3.8b"];
  for (let i = 23; i >= 0; i--) {
    const time = now() - i * HOUR;
    const model = models[i % models.length];
    const base = model.startsWith("qwen") ? 22 : model.startsWith("phi") ? 34 : 40;
    tpsSeries.push({ time, tps: +(base + Math.sin(i / 2.4) * 5.5).toFixed(1), model });
    ramSeries.push({ time, ram: Math.round(3200 + Math.cos(i / 3) * 640) });
  }
  return { tpsSeries, ramSeries };
}

export const DEMO_METRICS = {
  avgTps: 36.4,
  peakTps: 48.2,
  totalMessages: 128,
  totalTokens: 41_902,
  avgLatencyMs: 318,
  modelUsage: { "llama3.2:3b": 71, "qwen2.5-coder:7b": 34, "phi3.5:3.8b": 23 },
  ...buildSeries(),
};

// ── Benchmark ────────────────────────────────────────────────────────────
export const DEMO_BENCHMARK: Record<string, { text: string; tps: number; latency: number }> = {
  "llama3.2:3b": {
    text:
      "Reciprocal Rank Fusion combines several ranked lists without needing their " +
      "scores to be on the same scale. Each document scores 1/(k + rank) in every " +
      "list it appears in, and those values are summed. A document ranked highly by " +
      "two different retrievers therefore beats one ranked first by a single retriever.",
    tps: 41.8, latency: 264,
  },
  "qwen2.5-coder:7b": {
    text:
      "RRF merges ranked lists by rank rather than score. For each list, a document " +
      "contributes 1/(k + rank) with k typically 60; the contributions are summed " +
      "across lists. Because only ordinal position matters, you can fuse a cosine-" +
      "similarity ranking with a BM25 ranking without normalising either one.",
    tps: 21.4, latency: 487,
  },
  "phi3.5:3.8b": {
    text:
      "Reciprocal Rank Fusion is a way to blend multiple search rankings. Documents " +
      "get points based on where they place in each ranking — higher placements are " +
      "worth more — and the points are added up to produce the final order.",
    tps: 33.1, latency: 341,
  },
};

// ── Eval results ─────────────────────────────────────────────────────────
export const DEMO_EVAL_CASES = [
  { id: "e-1", query: "What is the per-minute request cap for enterprise keys?", expectedDocId: "doc-api" },
  { id: "e-2", query: "Which header should a client honour after a 429?", expectedDocId: "doc-handbook" },
  { id: "e-3", query: "How long was the exclusive lock held during the outage?", expectedDocId: "doc-postmortem" },
  { id: "e-4", query: "What percentage of traffic does a canary receive?", expectedDocId: "doc-handbook" },
  { id: "e-5", query: "How many orders failed during the November incident?", expectedDocId: "doc-postmortem" },
  { id: "e-6", query: "What is the burst allowance above the standard rate limit?", expectedDocId: "doc-api" },
];

export const DEMO_EVAL_RESULTS = {
  results: [
    { caseId: "e-1", query: DEMO_EVAL_CASES[0].query, hitRank: 1, chunkHitRank: 1, topScore: 0.94, latencyMs: 41, retrieved: [{ id: "c-1", documentId: "doc-api", filename: "northwind-api-reference.md", score: 0.94 }] },
    { caseId: "e-2", query: DEMO_EVAL_CASES[1].query, hitRank: 1, chunkHitRank: 2, topScore: 0.88, latencyMs: 38, retrieved: [{ id: "c-2", documentId: "doc-handbook", filename: "engineering-handbook.md", score: 0.88 }] },
    { caseId: "e-3", query: DEMO_EVAL_CASES[2].query, hitRank: 1, chunkHitRank: 1, topScore: 0.91, latencyMs: 44, retrieved: [{ id: "c-4", documentId: "doc-postmortem", filename: "incident-2024-11-postmortem.pdf", score: 0.91 }] },
    { caseId: "e-4", query: DEMO_EVAL_CASES[3].query, hitRank: 1, chunkHitRank: 1, topScore: 0.86, latencyMs: 36, retrieved: [{ id: "c-3", documentId: "doc-handbook", filename: "engineering-handbook.md", score: 0.86 }] },
    { caseId: "e-5", query: DEMO_EVAL_CASES[4].query, hitRank: 2, chunkHitRank: null, topScore: 0.62, latencyMs: 47, retrieved: [{ id: "c-1", documentId: "doc-api", filename: "northwind-api-reference.md", score: 0.62 }, { id: "c-4", documentId: "doc-postmortem", filename: "incident-2024-11-postmortem.pdf", score: 0.58 }] },
    { caseId: "e-6", query: DEMO_EVAL_CASES[5].query, hitRank: 1, chunkHitRank: 1, topScore: 0.9, latencyMs: 39, retrieved: [{ id: "c-1", documentId: "doc-api", filename: "northwind-api-reference.md", score: 0.9 }] },
  ],
  summary: { cases: 6, hitAt1: 0.833, hitAtK: 1, mrr: 0.917, avgLatencyMs: 41, k: 5 },
};

// ── API keys & audit ─────────────────────────────────────────────────────
export interface DemoApiKey {
  id: string;
  name: string;
  user_id: string;
  last_used_at: number | null;
  created_at: number;
}

export const DEMO_API_KEYS: DemoApiKey[] = [
  { id: "k-1", name: "Editor plugin", user_id: DEMO_USER.id, last_used_at: now() - 2 * HOUR, created_at: now() - 11 * DAY },
  { id: "k-2", name: "Nightly eval job", user_id: DEMO_USER.id, last_used_at: now() - DAY, created_at: now() - 4 * DAY },
];

export const DEMO_AUDIT = {
  entries: [
    { id: "a-1", action: "document.uploaded", resource_type: "document", resource_name: "incident-2024-11-postmortem.pdf", user_id: DEMO_USER.id, username: "demo", created_at: now() - 2 * DAY, metadata: null },
    { id: "a-2", action: "apikey.created", resource_type: "api_key", resource_name: "Nightly eval job", user_id: DEMO_USER.id, username: "demo", created_at: now() - 4 * DAY, metadata: null },
    { id: "a-3", action: "model.pulled", resource_type: "model", resource_name: "phi3.5:3.8b", user_id: DEMO_USER.id, username: "demo", created_at: now() - 3 * DAY, metadata: null },
    { id: "a-4", action: "collection.created", resource_type: "collection", resource_name: "Platform docs", user_id: DEMO_USER.id, username: "demo", created_at: now() - 6 * DAY, metadata: null },
    { id: "a-5", action: "user.login", resource_type: "user", resource_name: "demo", user_id: DEMO_USER.id, username: "demo", created_at: now() - 3 * HOUR, metadata: null },
  ],
  total: 5,
};

export const DEMO_AUDIT_STATS = {
  total: 5,
  byAction: [
    { action: "document.uploaded", count: 1 },
    { action: "apikey.created", count: 1 },
    { action: "model.pulled", count: 1 },
    { action: "collection.created", count: 1 },
    { action: "user.login", count: 1 },
  ],
};
