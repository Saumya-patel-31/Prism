import { NextRequest } from "next/server";
import { retrieveRelevantChunks } from "@/lib/rag";
import { resolveEmbedModel } from "@/lib/embeddings";
import { listModels } from "@/lib/ollama";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

// Quick retrieval preview — used by the UI to show what chunks would be used
export async function POST(req: NextRequest) {
  if (!getUserFromRequest(req)) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { query, documentIds } = await req.json();

  if (!query || !documentIds?.length) {
    return Response.json({ chunks: [] });
  }

  const models = await listModels().then((m) => m.map((x) => x.name)).catch(() => []);
  const embedModel = await resolveEmbedModel(models);
  if (!embedModel) return Response.json({ chunks: [] });

  const chunks = await retrieveRelevantChunks(query, documentIds, embedModel, 5);
  return Response.json({ chunks });
}
