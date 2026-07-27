import { NextRequest } from "next/server";
import { runEval, generateEvalCases, type EvalCase } from "@/lib/ragEval";
import { resolveEmbedModel } from "@/lib/embeddings";
import { listModels, checkOllamaHealth } from "@/lib/ollama";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { action, documentIds, cases, genModel, topK } = await req.json();

  if (!documentIds?.length) {
    return Response.json({ error: "Select at least one document" }, { status: 400 });
  }

  const healthy = await checkOllamaHealth();
  if (!healthy) {
    return Response.json({ error: "Ollama is not running" }, { status: 503 });
  }

  const models = await listModels().then((m) => m.map((x) => x.name)).catch(() => []);

  // --- Generate a synthetic eval set from the corpus ---
  if (action === "generate") {
    const model = genModel || models.find((m) => !m.includes("embed")) || models[0];
    if (!model) return Response.json({ error: "No models available" }, { status: 400 });
    const generated = await generateEvalCases(documentIds, model, 8);
    if (generated.length === 0) {
      return Response.json({ error: "No chunks found in the selected documents" }, { status: 400 });
    }
    return Response.json({ cases: generated });
  }

  // --- Run the eval ---
  if (action === "run") {
    if (!cases?.length) {
      return Response.json({ error: "No eval cases provided" }, { status: 400 });
    }
    const embedModel = await resolveEmbedModel(models);
    if (!embedModel) {
      return Response.json({ error: "No embedding model available" }, { status: 400 });
    }
    const { results, summary } = await runEval(
      cases as EvalCase[],
      documentIds,
      embedModel,
      Math.min(topK ?? 5, 10)
    );
    return Response.json({ results, summary });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
