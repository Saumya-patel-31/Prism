import { NextRequest } from "next/server";
import { checkOllamaHealth, deleteModel, listModels, pullModel } from "@/lib/ollama";
import { getRouterConfig } from "@/lib/router";
import { logAudit } from "@/lib/audit";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!getUserFromRequest(req)) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  const healthy = await checkOllamaHealth();
  if (!healthy) {
    return Response.json({ error: "Ollama not running", models: [], healthy: false });
  }
  const models = await listModels();
  const config = getRouterConfig();
  return Response.json({ models, healthy: true, routerConfig: config });
}

export async function POST(req: NextRequest) {
  if (!getUserFromRequest(req)) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { action, model } = await req.json();

  if (!model) return Response.json({ error: "model name required" }, { status: 400 });

  if (action === "pull") {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await pullModel(model, (status, percent) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ status, percent })}\n\n`
              )
            );
          });
          logAudit("model.pulled", { resourceType: "model", resourceName: model });
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ status: "done", percent: 100 })}\n\n`)
          );
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  if (action === "delete") {
    await deleteModel(model);
    logAudit("model.deleted", { resourceType: "model", resourceName: model });
    return Response.json({ success: true });
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
}
