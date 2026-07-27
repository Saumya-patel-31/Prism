import { retrieveRelevantChunks } from "./rag";
import { getChunksByDocuments } from "./db";
import { completeChat } from "./ollama";

export interface EvalCase {
  id: string;
  query: string;
  /** The document the answer lives in — a retrieval "hit" means a chunk from this doc was returned */
  expectedDocId: string;
  /** Stricter target: the exact chunk the question was generated from */
  expectedChunkId?: string;
}

export interface EvalCaseResult {
  caseId: string;
  query: string;
  /** Rank (1-based) of the first chunk from the expected document, or null if missed */
  hitRank: number | null;
  /** Rank of the exact expected chunk, if one was specified */
  chunkHitRank: number | null;
  topScore: number;
  latencyMs: number;
  retrieved: { id: string; documentId: string; filename: string; score: number }[];
}

export interface EvalSummary {
  cases: number;
  hitAt1: number;
  hitAtK: number;
  /** Mean Reciprocal Rank over document-level hits */
  mrr: number;
  avgLatencyMs: number;
  k: number;
}

export async function runEval(
  cases: EvalCase[],
  documentIds: string[],
  embedModel: string,
  topK = 5
): Promise<{ results: EvalCaseResult[]; summary: EvalSummary }> {
  const results: EvalCaseResult[] = [];

  for (const c of cases) {
    const started = Date.now();
    const chunks = await retrieveRelevantChunks(c.query, documentIds, embedModel, topK);
    const latencyMs = Date.now() - started;

    const docRank = chunks.findIndex((ch) => ch.documentId === c.expectedDocId);
    const chunkRank = c.expectedChunkId
      ? chunks.findIndex((ch) => ch.id === c.expectedChunkId)
      : -1;

    results.push({
      caseId: c.id,
      query: c.query,
      hitRank: docRank === -1 ? null : docRank + 1,
      chunkHitRank: chunkRank === -1 ? null : chunkRank + 1,
      topScore: chunks[0]?.score ?? 0,
      latencyMs,
      retrieved: chunks.map((ch) => ({
        id: ch.id,
        documentId: ch.documentId,
        filename: ch.filename,
        score: ch.score,
      })),
    });
  }

  const n = results.length || 1;
  const summary: EvalSummary = {
    cases: results.length,
    hitAt1: results.filter((r) => r.hitRank === 1).length / n,
    hitAtK: results.filter((r) => r.hitRank !== null).length / n,
    mrr: results.reduce((s, r) => s + (r.hitRank ? 1 / r.hitRank : 0), 0) / n,
    avgLatencyMs: Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / n),
    k: topK,
  };

  return { results, summary };
}

/**
 * Synthetic eval-set generation: sample chunks from the corpus and ask a local
 * model to write one question each chunk uniquely answers. The source chunk
 * becomes the ground-truth label — no hand-labeling required.
 */
export async function generateEvalCases(
  documentIds: string[],
  genModel: string,
  count = 8
): Promise<EvalCase[]> {
  const rows = getChunksByDocuments(documentIds) as {
    id: string;
    document_id: string;
    filename: string;
    content: string;
  }[];
  if (rows.length === 0) return [];

  // Evenly sample chunks across the corpus
  const step = Math.max(1, Math.floor(rows.length / count));
  const sampled = rows.filter((_, i) => i % step === 0).slice(0, count);

  const cases: EvalCase[] = [];
  for (const chunk of sampled) {
    try {
      const raw = await completeChat(genModel, [
        {
          role: "system",
          content:
            "You write retrieval-evaluation questions. Given a passage, write ONE short, specific question that this passage (and only this passage) answers. Reply with the question text only — no preamble, no quotes.",
        },
        { role: "user", content: chunk.content.slice(0, 1500) },
      ], { numPredict: 80, temperature: 0.4 });

      const query = raw.trim().split("\n")[0].replace(/^["']|["']$/g, "").trim();
      if (query.length < 8) continue;

      cases.push({
        id: chunk.id,
        query,
        expectedDocId: chunk.document_id,
        expectedChunkId: chunk.id,
      });
    } catch {
      // Skip chunks whose generation failed — partial eval sets are still useful
    }
  }
  return cases;
}
