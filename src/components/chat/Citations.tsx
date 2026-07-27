"use client";

import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CitationChunk {
  id: string;
  filename: string;
  chunkIndex: number;
  score: number;
  /** Cosine similarity from dense retrieval (0–1) */
  vectorScore?: number;
  /** Normalized BM25 score from lexical retrieval (0–1) */
  keywordScore?: number;
  preview: string;
}

interface Props {
  chunks: CitationChunk[];
}

function SignalBar({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <span className="flex items-center gap-1" title={`${label}: ${Math.round(value * 100)}%`}>
      <span className="text-[9px] uppercase tracking-wide text-[var(--color-muted-foreground)]">{label}</span>
      <span className="w-10 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
        <span
          className={cn("block h-full rounded-full", className)}
          style={{ width: `${Math.max(4, Math.round(value * 100))}%` }}
        />
      </span>
    </span>
  );
}

export function Citations({ chunks }: Props) {
  const [open, setOpen] = useState(false);

  if (!chunks || chunks.length === 0) return null;

  const isHybrid = chunks.some((c) => c.vectorScore !== undefined);

  return (
    <div className="mt-2 rounded-md border border-[var(--color-border)] overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--color-muted)] hover:bg-[var(--color-secondary)] transition-colors text-left cursor-pointer"
      >
        <FileText className="w-3.5 h-3.5 text-[var(--color-muted-foreground)]" />
        <span className="text-[var(--color-foreground)] font-medium">
          {chunks.length} source{chunks.length > 1 ? "s" : ""} used
        </span>
        {isHybrid && (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold">
            hybrid retrieval
          </span>
        )}
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 ml-auto text-[var(--color-muted-foreground)] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="divide-y divide-[var(--color-border)]">
          {chunks.map((c, i) => (
            <div key={c.id} className="px-3 py-2.5 bg-[var(--color-card)]">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-[var(--color-primary)]">
                  Source {i + 1}
                </span>
                <span className="text-[var(--color-muted-foreground)] truncate flex-1 min-w-0">
                  {c.filename}
                </span>
                {c.vectorScore !== undefined ? (
                  <span className="flex items-center gap-2.5 shrink-0">
                    <SignalBar label="sem" value={c.vectorScore} className="bg-[var(--color-primary)]" />
                    <SignalBar label="kw" value={c.keywordScore ?? 0} className="bg-emerald-500" />
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--color-muted-foreground)] shrink-0">
                    {Math.round(c.score * 100)}% match
                  </span>
                )}
              </div>
              <p className="text-[var(--color-muted-foreground)] leading-relaxed line-clamp-3">
                {c.preview}…
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
