import { embedText, cosineSimilarity, unpackEmbedding } from "./embeddings";
import { getChunksByDocuments } from "./db";

export interface RetrievedChunk {
  id: string;
  documentId: string;
  filename: string;
  content: string;
  chunkIndex: number;
  /** Fused relevance score (RRF), normalized to 0–1 across the result set */
  score: number;
  /** Cosine similarity between query and chunk embeddings */
  vectorScore: number;
  /** BM25 lexical score, normalized to 0–1 across candidates */
  keywordScore: number;
}

interface Candidate {
  id: string;
  documentId: string;
  filename: string;
  content: string;
  chunkIndex: number;
  embedding: number[];
  tokens: string[];
  vectorScore: number;
  keywordScore: number;
}

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "has", "have", "how", "in", "is", "it", "its", "of", "on", "or", "that",
  "the", "this", "to", "was", "what", "when", "where", "which", "who",
  "why", "will", "with", "you", "your", "i", "me", "my", "we", "our",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * BM25 (Okapi) over the candidate chunk set.
 * k1 controls term-frequency saturation, b controls length normalization.
 */
function bm25Scores(queryTokens: string[], candidates: Candidate[]): number[] {
  const k1 = 1.5;
  const b = 0.75;
  const N = candidates.length;
  if (N === 0) return [];

  const avgLen = candidates.reduce((s, c) => s + c.tokens.length, 0) / N || 1;

  // Document frequency per query term
  const df = new Map<string, number>();
  const uniqueQuery = [...new Set(queryTokens)];
  for (const term of uniqueQuery) {
    let count = 0;
    for (const c of candidates) if (c.tokens.includes(term)) count++;
    df.set(term, count);
  }

  return candidates.map((c) => {
    const tf = new Map<string, number>();
    for (const t of c.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const term of uniqueQuery) {
      const f = tf.get(term) ?? 0;
      if (f === 0) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (c.tokens.length / avgLen))));
    }
    return score;
  });
}

/** Reciprocal Rank Fusion: score(d) = Σ 1 / (k + rank_i(d)) across ranked lists */
function rrfFuse(rankedLists: string[][], k = 60): Map<string, number> {
  const fused = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((id, rank) => {
      fused.set(id, (fused.get(id) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return fused;
}

/**
 * Maximal Marginal Relevance — greedily select chunks that balance relevance
 * against redundancy with already-selected chunks. λ=0.7 favors relevance.
 */
function mmrSelect(
  ranked: Candidate[],
  fusedScores: Map<string, number>,
  topK: number,
  lambda = 0.7
): Candidate[] {
  const selected: Candidate[] = [];
  const pool = [...ranked];

  while (selected.length < topK && pool.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const relevance = fusedScores.get(pool[i].id) ?? 0;
      const maxSim = selected.length === 0
        ? 0
        : Math.max(...selected.map((s) => cosineSimilarity(pool[i].embedding, s.embedding)));
      const mmr = lambda * relevance - (1 - lambda) * maxSim * 0.01; // scale sim into RRF range
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }
    selected.push(pool.splice(bestIdx, 1)[0]);
  }
  return selected;
}

/**
 * Hybrid retrieval: dense vector search + BM25 lexical search,
 * fused with Reciprocal Rank Fusion, de-duplicated with MMR.
 */
export async function retrieveRelevantChunks(
  query: string,
  documentIds: string[],
  embedModel: string,
  topK = 5,
  minVectorScore = 0.25
): Promise<RetrievedChunk[]> {
  if (documentIds.length === 0) return [];

  const queryVec = await embedText(query, embedModel);
  const queryTokens = tokenize(query);

  const rows = getChunksByDocuments(documentIds) as {
    id: string;
    document_id: string;
    filename: string;
    content: string;
    chunk_index: number;
    embedding: string;
  }[];
  if (rows.length === 0) return [];

  const candidates: Candidate[] = rows.map((row) => {
    const embedding = unpackEmbedding(row.embedding);
    return {
      id: row.id,
      documentId: row.document_id,
      filename: row.filename,
      content: row.content,
      chunkIndex: row.chunk_index,
      embedding,
      tokens: tokenize(row.content),
      vectorScore: cosineSimilarity(queryVec, embedding),
      keywordScore: 0,
    };
  });

  // Lexical scoring
  const bm25 = bm25Scores(queryTokens, candidates);
  const maxBm25 = Math.max(...bm25, 1e-9);
  candidates.forEach((c, i) => { c.keywordScore = bm25[i] / maxBm25; });

  // Drop chunks with no signal from either retriever
  const viable = candidates.filter(
    (c) => c.vectorScore >= minVectorScore || c.keywordScore > 0
  );
  if (viable.length === 0) return [];

  // Build ranked lists and fuse
  const byVector = [...viable].sort((a, b) => b.vectorScore - a.vectorScore).map((c) => c.id);
  const byKeyword = [...viable]
    .filter((c) => c.keywordScore > 0)
    .sort((a, b) => b.keywordScore - a.keywordScore)
    .map((c) => c.id);
  const fused = rrfFuse([byVector, byKeyword]);

  const ranked = [...viable].sort(
    (a, b) => (fused.get(b.id) ?? 0) - (fused.get(a.id) ?? 0)
  );

  // MMR selection for diversity
  const selected = mmrSelect(ranked, fused, topK);

  // Normalize fused scores to 0–1 for display
  const maxFused = Math.max(...selected.map((c) => fused.get(c.id) ?? 0), 1e-9);

  return selected.map((c) => ({
    id: c.id,
    documentId: c.documentId,
    filename: c.filename,
    content: c.content,
    chunkIndex: c.chunkIndex,
    score: (fused.get(c.id) ?? 0) / maxFused,
    vectorScore: c.vectorScore,
    keywordScore: c.keywordScore,
  }));
}

export function buildRagSystemPrompt(
  chunks: RetrievedChunk[],
  baseSystemPrompt?: string
): string {
  const context = chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}: ${c.filename}, chunk ${c.chunkIndex + 1}]\n${c.content}`
    )
    .join("\n\n---\n\n");

  return [
    baseSystemPrompt?.trim(),
    `You are a helpful assistant. Answer the user's question using the provided context below.`,
    `Ground every claim in the context. Cite sources inline like: (Source 1), (Source 2).`,
    `If the context does not contain the answer, say so explicitly before answering from general knowledge.`,
    `\n## Context\n\n${context}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
