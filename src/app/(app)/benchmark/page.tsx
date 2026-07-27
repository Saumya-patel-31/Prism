"use client";

import { useEffect, useRef, useState } from "react";
import { Gauge, Play, RotateCcw, Square, ChevronDown, ChevronUp, Settings2 } from "lucide-react";

interface ModelState {
  content: string;
  done: boolean;
  error?: string;
  tokensGenerated?: number;
  tokensPerSecond?: number;
  latencyMs?: number;
}

function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg border ${
      highlight
        ? "border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10"
        : "border-[var(--color-border)] bg-[var(--color-secondary)]"
    }`}>
      <span className={`text-sm font-bold font-mono ${highlight ? "text-[var(--color-primary)]" : "text-[var(--color-foreground)]"}`}>
        {value}
      </span>
      <span className="text-[10px] text-[var(--color-muted-foreground)]">{label}</span>
    </div>
  );
}

function ModelCard({ model, state, running }: { model: string; state: ModelState; running: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state.content]);

  const shortName = model.split(":")[0];

  return (
    <div className={`flex flex-col rounded-xl border transition-colors ${
      state.error
        ? "border-red-500/30 bg-red-500/5"
        : state.done
        ? "border-[var(--color-primary)]/30 bg-[var(--color-card)]"
        : running && !state.done
        ? "border-[var(--color-primary)]/50 bg-[var(--color-card)]"
        : "border-[var(--color-border)] bg-[var(--color-card)]"
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
        <div className={`w-2 h-2 rounded-full shrink-0 ${
          state.error ? "bg-red-400" :
          state.done ? "bg-green-400" :
          running && state.content ? "bg-[var(--color-primary)] animate-pulse" :
          "bg-[var(--color-muted-foreground)]/40"
        }`} />
        <span className="text-sm font-semibold text-[var(--color-foreground)] truncate flex-1">{shortName}</span>
        <span className="text-[10px] text-[var(--color-muted-foreground)] font-mono truncate max-w-[120px]">{model}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-h-64 px-4 py-3">
        {state.error ? (
          <p className="text-xs text-red-400 font-mono">{state.error}</p>
        ) : state.content ? (
          <p className="text-sm text-[var(--color-foreground)] leading-relaxed whitespace-pre-wrap">
            {state.content}
            {running && !state.done && (
              <span className="inline-block w-1.5 h-4 bg-[var(--color-primary)] ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        ) : (
          <p className="text-xs text-[var(--color-muted-foreground)] italic">
            {running ? "Waiting for response…" : "—"}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Stats */}
      {state.done && !state.error && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--color-border)] flex-wrap">
          <StatPill label="tok/s" value={state.tokensPerSecond?.toFixed(1) ?? "—"} highlight />
          <StatPill label="latency" value={state.latencyMs ? `${(state.latencyMs / 1000).toFixed(1)}s` : "—"} />
          <StatPill label="tokens" value={String(state.tokensGenerated ?? "—")} />
        </div>
      )}
    </div>
  );
}

export default function BenchmarkPage() {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const [modelStates, setModelStates] = useState<Record<string, ModelState>>({});
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        const names: string[] = (d.models ?? []).map((m: { name: string }) => m.name);
        setAvailableModels(names);
        // Pre-select up to 2 models
        setSelectedModels(names.slice(0, Math.min(2, names.length)));
      });
  }, []);

  function toggleModel(model: string) {
    setSelectedModels((prev) =>
      prev.includes(model)
        ? prev.filter((m) => m !== model)
        : prev.length < 6
        ? [...prev, model]
        : prev
    );
  }

  async function run() {
    if (!prompt.trim() || selectedModels.length === 0 || running) return;

    const initial: Record<string, ModelState> = {};
    for (const m of selectedModels) initial[m] = { content: "", done: false };
    setModelStates(initial);
    setRunning(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, models: selectedModels, systemPrompt: systemPrompt || undefined }),
        signal: ctrl.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const chunk = JSON.parse(line.slice(6));

          if (chunk.type === "token") {
            setModelStates((prev) => ({
              ...prev,
              [chunk.model]: { ...prev[chunk.model], content: (prev[chunk.model]?.content ?? "") + chunk.content },
            }));
          } else if (chunk.type === "done") {
            setModelStates((prev) => ({
              ...prev,
              [chunk.model]: {
                ...prev[chunk.model],
                done: true,
                tokensGenerated: chunk.tokensGenerated,
                tokensPerSecond: chunk.tokensPerSecond,
                latencyMs: chunk.latencyMs,
              },
            }));
          } else if (chunk.type === "error") {
            setModelStates((prev) => ({
              ...prev,
              [chunk.model]: { ...prev[chunk.model], done: true, error: chunk.message },
            }));
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  function reset() {
    setModelStates({});
    setPrompt("");
  }

  const hasResults = Object.keys(modelStates).length > 0;

  // Find fastest model by tok/s
  const fastestModel = Object.entries(modelStates)
    .filter(([, s]) => s.done && !s.error && s.tokensPerSecond != null)
    .sort(([, a], [, b]) => (b.tokensPerSecond ?? 0) - (a.tokensPerSecond ?? 0))[0]?.[0];

  const gridCols =
    selectedModels.length === 1 ? "grid-cols-1" :
    selectedModels.length === 2 ? "grid-cols-1 lg:grid-cols-2" :
    selectedModels.length === 3 ? "grid-cols-1 lg:grid-cols-3" :
    "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <Gauge className="w-5 h-5 text-[var(--color-primary)]" />
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-foreground)]">Model Benchmark</h1>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Run one prompt against multiple models in parallel — compare speed and quality side by side
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

          {/* Config panel */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
            {/* Prompt */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">
                Prompt
              </label>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your benchmark prompt… e.g. 'Explain how transformers work in 3 sentences.'"
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                disabled={running}
              />
            </div>

            {/* System prompt toggle */}
            <div>
              <button
                onClick={() => setShowSystem((s) => !s)}
                className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                System prompt
                {showSystem ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showSystem && (
                <textarea
                  rows={2}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Optional system prompt applied to all models…"
                  className="mt-2 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  disabled={running}
                />
              )}
            </div>

            {/* Model selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
                  Models <span className="opacity-60">({selectedModels.length} selected, max 6)</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedModels(availableModels.slice(0, 6))}
                    className="text-[10px] text-[var(--color-primary)] hover:underline"
                    disabled={running}
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setSelectedModels([])}
                    className="text-[10px] text-[var(--color-muted-foreground)] hover:underline"
                    disabled={running}
                  >
                    Clear
                  </button>
                </div>
              </div>
              {availableModels.length === 0 ? (
                <p className="text-xs text-[var(--color-muted-foreground)] italic">
                  No models available — pull one from the{" "}
                  <a href="/models" className="text-[var(--color-primary)] hover:underline">Models</a> page.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableModels.map((m) => {
                    const active = selectedModels.includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => toggleModel(m)}
                        disabled={running || (!active && selectedModels.length >= 6)}
                        className={`px-3 py-1.5 rounded-lg text-xs border font-medium transition-colors disabled:opacity-40 ${
                          active
                            ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                            : "bg-[var(--color-secondary)] text-[var(--color-foreground)] border-[var(--color-border)] hover:border-[var(--color-primary)]/50"
                        }`}
                      >
                        {m.split(":")[0]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              {running ? (
                <button
                  onClick={stop}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={run}
                  disabled={!prompt.trim() || selectedModels.length === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--color-primary)] hover:opacity-90 text-white text-sm font-medium disabled:opacity-50 transition-opacity"
                >
                  <Play className="w-3.5 h-3.5" />
                  Run benchmark
                </button>
              )}
              {hasResults && !running && (
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] text-sm transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
              {selectedModels.length > 0 && (
                <span className="text-xs text-[var(--color-muted-foreground)] ml-auto">
                  {selectedModels.length} model{selectedModels.length !== 1 ? "s" : ""} · runs in parallel
                </span>
              )}
            </div>
          </div>

          {/* Results grid */}
          {hasResults && (
            <>
              {/* Winner banner */}
              {fastestModel && Object.values(modelStates).every((s) => s.done) && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10">
                  <Gauge className="w-4 h-4 text-[var(--color-primary)]" />
                  <span className="text-sm text-[var(--color-foreground)]">
                    Fastest: <span className="font-semibold text-[var(--color-primary)]">{fastestModel.split(":")[0]}</span>
                    {" "}at <span className="font-mono font-semibold">{modelStates[fastestModel].tokensPerSecond?.toFixed(1)} tok/s</span>
                  </span>
                </div>
              )}

              <div className={`grid gap-4 ${gridCols}`}>
                {selectedModels.map((model) => (
                  <ModelCard
                    key={model}
                    model={model}
                    state={modelStates[model] ?? { content: "", done: false }}
                    running={running}
                  />
                ))}
              </div>

              {/* Stats comparison table */}
              {Object.values(modelStates).some((s) => s.done && !s.error) && (
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-secondary)]">
                    <p className="text-xs font-semibold text-[var(--color-foreground)]">Comparison</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="text-left px-4 py-2 text-xs text-[var(--color-muted-foreground)] font-medium">Model</th>
                        <th className="text-right px-4 py-2 text-xs text-[var(--color-muted-foreground)] font-medium">Tok/s</th>
                        <th className="text-right px-4 py-2 text-xs text-[var(--color-muted-foreground)] font-medium">Latency</th>
                        <th className="text-right px-4 py-2 text-xs text-[var(--color-muted-foreground)] font-medium">Tokens</th>
                        <th className="text-right px-4 py-2 text-xs text-[var(--color-muted-foreground)] font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedModels
                        .filter((m) => modelStates[m]?.done)
                        .sort((a, b) => (modelStates[b].tokensPerSecond ?? 0) - (modelStates[a].tokensPerSecond ?? 0))
                        .map((model) => {
                          const s = modelStates[model];
                          const isFastest = model === fastestModel;
                          return (
                            <tr key={model} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-secondary)]/50">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {isFastest && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 font-medium">fastest</span>}
                                  <span className="font-medium text-[var(--color-foreground)]">{model.split(":")[0]}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-[var(--color-foreground)]">
                                {s.error ? "—" : s.tokensPerSecond?.toFixed(1) ?? "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-[var(--color-foreground)]">
                                {s.error ? "—" : s.latencyMs ? `${(s.latencyMs / 1000).toFixed(2)}s` : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-[var(--color-foreground)]">
                                {s.error ? "—" : s.tokensGenerated ?? "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                {s.error
                                  ? <span className="text-xs text-red-400">error</span>
                                  : <span className="text-xs text-green-400">done</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {!hasResults && (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--color-muted-foreground)]">
              <Gauge className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm font-medium mb-1">No benchmark run yet</p>
              <p className="text-xs max-w-sm text-center">
                Enter a prompt, select the models you want to compare, and hit Run.
                All models stream in parallel.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
