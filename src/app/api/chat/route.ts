import { NextRequest } from "next/server";
import { listModels, streamChat } from "@/lib/ollama";
import { selectModel } from "@/lib/router";
import { addMessage, addMetric, createSession, getSession, getMessages } from "@/lib/db";
import { extractOllamaMetrics, generateId, getRamUsageMb } from "@/lib/metrics";
import { retrieveRelevantChunks, buildRagSystemPrompt } from "@/lib/rag";
import { resolveEmbedModel } from "@/lib/embeddings";
import { logAudit } from "@/lib/audit";
import { getUserFromRequest } from "@/lib/auth";
import type { ChatRequest } from "@/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body: ChatRequest & { documentIds?: string[] } = await req.json();
  const { message, sessionId, modelOverride, systemPrompt, documentIds } = body;

  if (!message?.trim() || !sessionId) {
    return Response.json({ error: "message and sessionId are required" }, { status: 400 });
  }

  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure session exists and belongs to this user
  if (!getSession(sessionId, user.userId)) {
    createSession(sessionId, message.slice(0, 60) || "New Chat", user.userId);
  }

  // Save user message
  const userMsgId = generateId();
  addMessage({ id: userMsgId, sessionId, role: "user", content: message });

  // Resolve model
  let availableModels: string[] = [];
  try {
    const models = await listModels();
    availableModels = models.map((m) => m.name);
  } catch {
    return Response.json(
      { error: "Ollama is not running. Start it with: ollama serve" },
      { status: 503 }
    );
  }

  const { model, category, reason } = selectModel(message, availableModels, modelOverride);

  // RAG: retrieve relevant chunks if documents are attached
  let ragChunks: Awaited<ReturnType<typeof retrieveRelevantChunks>> = [];
  if (documentIds && documentIds.length > 0) {
    try {
      const embedModel = await resolveEmbedModel(availableModels);
      if (embedModel) {
        ragChunks = await retrieveRelevantChunks(message, documentIds, embedModel, 5);
      }
    } catch {
      // RAG failure is non-fatal — fall back to plain chat
    }
  }

  // Build system prompt (with RAG context injected if available)
  const effectiveSystemPrompt =
    ragChunks.length > 0
      ? buildRagSystemPrompt(ragChunks, systemPrompt)
      : systemPrompt;

  // Keep last 8 turns (4 exchanges) — smaller history = much faster with num_ctx 2048
  const history = (getMessages(sessionId) as {
    role: "user" | "assistant" | "system";
    content: string;
  }[]).slice(-8);

  const ollamaMessages = [
    ...(effectiveSystemPrompt
      ? [{ role: "system" as const, content: effectiveSystemPrompt }]
      : []),
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Stream the response
  const encoder = new TextEncoder();
  const asstMsgId = generateId();

  const stream = new ReadableStream({
    async start(controller) {
      // Send routing metadata first (including which chunks were used)
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "meta",
            model,
            category,
            reason,
            ragChunks: ragChunks.map((c) => ({
              id: c.id,
              filename: c.filename,
              chunkIndex: c.chunkIndex,
              score: Math.round(c.score * 100) / 100,
              vectorScore: Math.round(c.vectorScore * 100) / 100,
              keywordScore: Math.round(c.keywordScore * 100) / 100,
              preview: c.content.slice(0, 120),
            })),
          })}\n\n`
        )
      );

      let fullContent = "";
      let finalChunk: Parameters<typeof extractOllamaMetrics>[0] = {};

      try {
        for await (const chunk of streamChat(model, ollamaMessages)) {
          if (chunk.message?.content) {
            fullContent += chunk.message.content;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "token", content: chunk.message.content })}\n\n`
              )
            );
          }
          if (chunk.done) {
            finalChunk = chunk;
          }
        }

        const metrics = extractOllamaMetrics(finalChunk);
        const ramUsageMb = getRamUsageMb();

        addMessage({
          id: asstMsgId,
          sessionId,
          role: "assistant",
          content: fullContent,
          modelUsed: model,
          tokensGenerated: metrics.tokensGenerated,
          tokensPerSecond: metrics.tokensPerSecond,
          latencyMs: metrics.latencyMs,
        });

        addMetric({
          id: generateId(),
          sessionId,
          messageId: asstMsgId,
          model,
          tokensGenerated: metrics.tokensGenerated,
          tokensPerSecond: metrics.tokensPerSecond,
          latencyMs: metrics.latencyMs,
          promptTokens: metrics.promptTokens,
          ramUsageMb,
        });

        logAudit("chat.created", {
          resourceType: "message",
          resourceId: asstMsgId,
          metadata: { model, sessionId, tokensGenerated: metrics.tokensGenerated },
        });

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "done",
              messageId: asstMsgId,
              metrics: { ...metrics, ramUsageMb },
            })}\n\n`
          )
        );
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
