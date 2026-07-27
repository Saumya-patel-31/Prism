import { NextRequest } from "next/server";
import { getApiUserFromRequest, hashApiKey } from "@/lib/auth";
import { getApiKeyByHash, touchApiKey, getUserById, addMessage, getOllamaHost } from "@/lib/db";
import { streamChat } from "@/lib/ollama";
import { logAudit } from "@/lib/audit";
import { generateId } from "@/lib/metrics";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Authenticate via API key
  const rawKey = getApiUserFromRequest(req);
  if (!rawKey) {
    return Response.json({ error: "Missing API key. Use Authorization: Bearer prism_xxx" }, { status: 401 });
  }

  const keyRow = getApiKeyByHash(hashApiKey(rawKey));
  if (!keyRow) {
    return Response.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  const dbUser = getUserById(keyRow.user_id);
  if (!dbUser) {
    return Response.json({ error: "User not found" }, { status: 401 });
  }

  touchApiKey(keyRow.id);
  logAudit("apikey.used", { resourceType: "api_key", resourceId: keyRow.id, resourceName: keyRow.name });

  const body = await req.json() as {
    message: string;
    model?: string;
    stream?: boolean;
    system?: string;
    history?: { role: string; content: string }[];
  };

  const { message, model, stream = true, system, history = [] } = body;
  if (!message?.trim()) {
    return Response.json({ error: "message required" }, { status: 400 });
  }

  // Pick model — fallback to first available
  let resolvedModel = model ?? "";
  if (!resolvedModel) {
    try {
      const base = getOllamaHost() || "http://localhost:11434";
      const r = await fetch(`${base}/api/tags`);
      const d = await r.json();
      resolvedModel = (d.models ?? [])[0]?.name ?? "llama3.2";
    } catch {
      resolvedModel = "llama3.2";
    }
  }

  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  for (const h of history.slice(-8)) messages.push(h);
  messages.push({ role: "user", content: message });

  const msgId = generateId();
  const start = Date.now();

  if (!stream) {
    // Collect full response and return JSON
    let fullContent = "";
    let tokensGenerated = 0;

    for await (const chunk of streamChat(resolvedModel, messages)) {
      if (!chunk.done) {
        fullContent += chunk.message.content;
      } else {
        tokensGenerated = chunk.eval_count ?? 0;
      }
    }

    const latencyMs = Date.now() - start;
    addMessage({
      id: msgId,
      sessionId: "api",
      role: "assistant",
      content: fullContent,
      modelUsed: resolvedModel,
      tokensGenerated,
      latencyMs,
    });

    return Response.json({
      id: msgId,
      model: resolvedModel,
      content: fullContent,
      tokensGenerated,
      latencyMs,
    });
  }

  // Streaming SSE response
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      function send(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      send({ type: "meta", model: resolvedModel });

      let fullContent = "";
      let tokensGenerated = 0;

      try {
        for await (const chunk of streamChat(resolvedModel, messages)) {
          if (!chunk.done) {
            const token = chunk.message.content;
            fullContent += token;
            send({ type: "token", content: token });
          } else {
            tokensGenerated = chunk.eval_count ?? 0;
          }
        }
      } catch (err) {
        send({ type: "error", message: String(err) });
        controller.close();
        return;
      }

      const latencyMs = Date.now() - start;
      const tps = tokensGenerated > 0 ? tokensGenerated / (latencyMs / 1000) : 0;

      addMessage({
        id: msgId,
        sessionId: "api",
        role: "assistant",
        content: fullContent,
        modelUsed: resolvedModel,
        tokensGenerated,
        tokensPerSecond: tps,
        latencyMs,
      });

      send({ type: "done", id: msgId, tokensGenerated, tokensPerSecond: tps, latencyMs });
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
