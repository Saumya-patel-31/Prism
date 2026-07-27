"use client";

import { useState } from "react";
import { FlaskConical, Play, Sparkles, Trash2, Plus, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentPicker } from "@/components/chat/DocumentPicker";

interface EvalCase {
  id: string;
  query: string;
  expectedDocId: string;
  expectedChunkId?: string;
}

interface CaseResult {
  caseId: string;
  query: string;
  hitRank: number | null;
  chunkHitRank: number | null;
  topScore: number;
  latencyMs: number;
  retrieved: { id: string; documentId: string; filename: string; score: number }[];
}

interface Summary {
  cases: number;
  hitAt1: number;
  hitAtK: number;
  mrr: number;
  avgLatencyMs: number;
  k: number;
}

function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
      <span className="text-2xl font-bold font-mono text-[var(--color-foreground)]">{value}</span>
      <span className="text-[11px] text-[var(--color-muted-foreground)] mt-0.5">{label}</span>
      {sub && <span className="text-[10px] text-[var(--color-muted-foreground)] opacity-70">{sub}</span>}
    </div>
  );
}

export default function EvalsPage() {
  const [docIds, setDocIds] = useState<string[]>([]);
  const [cases, setCases] = useState<EvalCase[]>([]);
  const [results, setResults] = useState<CaseResult[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState("");

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/rag-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", documentIds: docIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setCases((prev) => [...prev, ...data.cases]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function run() {
    setRunning(true);
    setError(null);
    setResults(null);
    setSummary(null);
    try {
      const res = await fetch("/api/rag-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", documentIds: docIds, cases }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eval failed");
      setResults(data.results);
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eval failed");
    } finally {
      setRunning(false);
    }
  }

  function addManualCase() {
    const q = manualQuery.trim();
    if (!q || docIds.length === 0) return;
    setCases((prev) => [
      ...prev,
      { id: `manual-${Date.now()}`, query: q, expectedDocId: docIds[0] },
    ]);
    setManualQuery("");
  }

  const resultFor = (id: string) => results?.find((r) => r.caseId === id);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <FlaskConical className="w-5 h-5 text-[var(--color-primary)]" />
          <h1 className="text-xl font-semibold text-[var(--color-foreground)]">Retrieval evals</h1>
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)] mb-6">
          Measure how well hybrid retrieval finds the right source. Generate a synthetic
          test set from your documents, or write your own queries — then track Hit@K and MRR.
        </p>

        {/* Setup row */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <DocumentPicker selectedIds={docIds} onChange={setDocIds} />
          <Button
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={docIds.length === 0 || generating}
            className="gap-1.5"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? "Generating…" : "Generate test set"}
          </Button>
          <Button
            size="sm"
            onClick={run}
            disabled={cases.length === 0 || running}
            className="gap-1.5"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {running ? "Running…" : `Run eval (${cases.length})`}
          </Button>
          {cases.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCases([]); setResults(null); setSummary(null); }}
              className="gap-1.5 text-[var(--color-muted-foreground)]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </Button>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 border border-red-500/20 bg-red-500/5 rounded-md px-3 py-2 mb-4">
            {error}
          </p>
        )}

        {/* Summary metrics */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <MetricTile label="Hit@1" value={`${Math.round(summary.hitAt1 * 100)}%`} sub="right doc ranked first" />
            <MetricTile label={`Hit@${summary.k}`} value={`${Math.round(summary.hitAtK * 100)}%`} sub={`right doc in top ${summary.k}`} />
            <MetricTile label="MRR" value={summary.mrr.toFixed(2)} sub="mean reciprocal rank" />
            <MetricTile label="Avg latency" value={`${summary.avgLatencyMs}ms`} sub="per query" />
          </div>
        )}

        {/* Manual case input */}
        <div className="flex gap-2 mb-4">
          <input
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManualCase()}
            placeholder={docIds.length === 0 ? "Select documents first…" : "Add your own test query…"}
            disabled={docIds.length === 0}
            className="flex-1 text-sm bg-[var(--color-input)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-[var(--color-foreground)] outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-50"
          />
          <Button variant="outline" size="sm" onClick={addManualCase} disabled={!manualQuery.trim()}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Case list */}
        {cases.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[var(--color-border)] rounded-xl">
            <FlaskConical className="w-8 h-8 mx-auto mb-3 text-[var(--color-muted-foreground)] opacity-40" />
            <p className="text-sm text-[var(--color-muted-foreground)]">
              No test cases yet. Pick documents, then generate a test set from their content.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map((c, i) => {
              const r = resultFor(c.id);
              return (
                <div
                  key={c.id}
                  className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3"
                >
                  <span className="text-[10px] font-mono text-[var(--color-muted-foreground)] mt-1 w-5 shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-foreground)]">{c.query}</p>
                    {r && (
                      <p className="text-[11px] text-[var(--color-muted-foreground)] mt-1">
                        {r.hitRank
                          ? `Expected doc at rank ${r.hitRank}${r.chunkHitRank ? ` · exact chunk at rank ${r.chunkHitRank}` : ""}`
                          : `Expected doc not in top ${r.retrieved.length}`}
                        {" · "}{r.latencyMs}ms
                        {r.retrieved[0] && ` · top: ${r.retrieved[0].filename}`}
                      </p>
                    )}
                  </div>
                  {r ? (
                    r.hitRank ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    )
                  ) : (
                    <button
                      onClick={() => setCases((prev) => prev.filter((x) => x.id !== c.id))}
                      className="p-1 rounded text-[var(--color-muted-foreground)] hover:text-red-400 transition-colors cursor-pointer shrink-0"
                      aria-label="Remove case"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
