const OLLAMA_BASE = process.env.OLLAMA_HOST ?? "http://localhost:11434";

// Preferred embedding models in priority order
const EMBED_MODEL_PRIORITY = [
  "nomic-embed-text",
  "mxbai-embed-large",
  "all-minilm",
  "snowflake-arctic-embed",
  "bge-m3",
];

let _cachedEmbedModel: string | null = null;

export async function resolveEmbedModel(availableModels: string[]): Promise<string | null> {
  if (_cachedEmbedModel) return _cachedEmbedModel;
  const names = availableModels.map((m) => m.toLowerCase());
  for (const preferred of EMBED_MODEL_PRIORITY) {
    if (names.some((n) => n.includes(preferred))) {
      _cachedEmbedModel = availableModels.find((m) =>
        m.toLowerCase().includes(preferred)
      )!;
      return _cachedEmbedModel;
    }
  }
  // Fall back to first available model (most LLMs can produce embeddings)
  _cachedEmbedModel = availableModels[0] ?? null;
  return _cachedEmbedModel;
}

export function clearEmbedModelCache() {
  _cachedEmbedModel = null;
}

export async function embedText(text: string, model: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embed failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  // Ollama returns { embeddings: [[...]] } for batch or { embedding: [...] } for single
  const vec: number[] = data.embeddings?.[0] ?? data.embedding;
  if (!vec || vec.length === 0) throw new Error("Empty embedding returned");
  return vec;
}

export async function embedBatch(texts: string[], model: string): Promise<number[][]> {
  // Ollama /api/embed supports batch input
  const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) throw new Error(`Batch embed failed: ${res.status}`);
  const data = await res.json();
  if (data.embeddings) return data.embeddings;
  // Fallback: single embed each
  return Promise.all(texts.map((t) => embedText(t, model)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function packEmbedding(vec: number[]): string {
  return JSON.stringify(vec);
}

export function unpackEmbedding(packed: string): number[] {
  return JSON.parse(packed);
}
