import type { OllamaModel } from "@/types";
import { getOllamaHost } from "./db";

function getBase() {
  try { return getOllamaHost(); } catch { return process.env.OLLAMA_HOST ?? "http://localhost:11434"; }
}

export async function listModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${getBase()}/api/tags`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Ollama unreachable: ${res.status}`);
  const data = await res.json();
  return data.models ?? [];
}

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getBase()}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface StreamChunk {
  model: string;
  created_at: string;
  message: { role: string; content: string };
  done: boolean;
  eval_count?: number;
  eval_duration?: number;
  prompt_eval_count?: number;
  load_duration?: number;
  total_duration?: number;
}

export interface ChatOptions {
  numCtx?: number;    // context window — smaller = much faster on CPU
  temperature?: number;
  numPredict?: number;
}

export async function* streamChat(
  model: string,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
  opts: ChatOptions = {}
): AsyncGenerator<StreamChunk> {
  const options: Record<string, unknown> = {
    num_ctx: opts.numCtx ?? 2048,   // 2048 is ~4x faster than 8192 default
  };
  if (opts.temperature !== undefined) options.temperature = opts.temperature;
  if (opts.numPredict !== undefined) options.num_predict = opts.numPredict;

  const res = await fetch(`${getBase()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, options }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line) as StreamChunk;
      } catch {
        // skip malformed lines
      }
    }
  }
}

/** Non-streaming chat completion — used for eval question generation and grading. */
export async function completeChat(
  model: string,
  messages: { role: string; content: string }[],
  opts: ChatOptions = {}
): Promise<string> {
  const options: Record<string, unknown> = {
    num_ctx: opts.numCtx ?? 2048,
    temperature: opts.temperature ?? 0.3,
  };
  if (opts.numPredict !== undefined) options.num_predict = opts.numPredict;

  const res = await fetch(`${getBase()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false, options }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.message?.content ?? "";
}

export async function pullModel(
  model: string,
  onProgress?: (status: string, percent: number) => void
): Promise<void> {
  const res = await fetch(`${getBase()}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: model, stream: true }),
  });
  if (!res.ok) throw new Error(`Pull failed: ${res.status}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line);
        const percent =
          chunk.total && chunk.completed
            ? Math.round((chunk.completed / chunk.total) * 100)
            : 0;
        onProgress?.(chunk.status ?? "", percent);
      } catch {}
    }
  }
}

export async function deleteModel(model: string): Promise<void> {
  const res = await fetch(`${getBase()}/api/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: model }),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}
