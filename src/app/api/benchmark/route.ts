import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { streamChat } from "@/lib/ollama";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, models, systemPrompt } = await req.json() as {
    prompt: string;
    models: string[];
    systemPrompt?: string;
  };

  if (!prompt?.trim()) return Response.json({ error: "prompt required" }, { status: 400 });
  if (!Array.isArray(models) || models.length === 0)
    return Response.json({ error: "at least one model required" }, { status: 400 });
  if (models.length > 6)
    return Response.json({ error: "max 6 models per benchmark" }, { status: 400 });

  logAudit("benchmark.run", {
    resourceType: "benchmark",
    resourceName: prompt.slice(0, 60),
    metadata: { models },
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      function send(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      send({ type: "start", models });

      const runners = models.map(async (model) => {
        const messages: { role: string; content: string }[] = [];
        if (systemPrompt?.trim()) messages.push({ role: "system", content: systemPrompt.trim() });
        messages.push({ role: "user", content: prompt });

        const start = Date.now();
        let tokensGenerated = 0;

        try {
          for await (const chunk of streamChat(model, messages)) {
            if (!chunk.done) {
              send({ type: "token", model, content: chunk.message.content });
            } else {
              tokensGenerated = chunk.eval_count ?? 0;
            }
          }
        } catch (err) {
          send({ type: "error", model, message: String(err) });
          return;
        }

        const latencyMs = Date.now() - start;
        const tps = tokensGenerated > 0 ? tokensGenerated / (latencyMs / 1000) : 0;
        send({ type: "done", model, tokensGenerated, tokensPerSecond: tps, latencyMs });
      });

      await Promise.all(runners);
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
