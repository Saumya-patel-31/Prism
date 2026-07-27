import os from "os";

export function getRamUsageMb(): number {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return Math.round((totalMem - freeMem) / 1024 / 1024);
}

export function calcTps(tokensGenerated: number, durationMs: number): number {
  if (durationMs <= 0 || tokensGenerated <= 0) return 0;
  return Math.round((tokensGenerated / durationMs) * 1000 * 10) / 10;
}

// Ollama reports eval_duration in nanoseconds
export function extractOllamaMetrics(finalChunk: {
  eval_count?: number;
  eval_duration?: number;
  prompt_eval_count?: number;
  load_duration?: number;
  total_duration?: number;
}) {
  const tokensGenerated = finalChunk.eval_count ?? 0;
  const evalDurationMs = (finalChunk.eval_duration ?? 0) / 1_000_000;
  const totalDurationMs = (finalChunk.total_duration ?? 0) / 1_000_000;
  const promptTokens = finalChunk.prompt_eval_count ?? 0;
  const tps = calcTps(tokensGenerated, evalDurationMs);

  return {
    tokensGenerated,
    tokensPerSecond: tps,
    latencyMs: Math.round(totalDurationMs),
    promptTokens,
    evalDurationMs,
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
