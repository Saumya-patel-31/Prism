"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, X, FileText, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Doc { id: string; filename: string; chunk_count: number; }

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function DocumentPicker({ selectedIds, onChange }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []));
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (docs.length === 0) return null;

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors",
          selectedIds.length > 0
            ? "border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/10"
            : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)]/50"
        )}
      >
        <Paperclip className="w-3.5 h-3.5" />
        {selectedIds.length > 0 ? (
          <span>{selectedIds.length} doc{selectedIds.length > 1 ? "s" : ""}</span>
        ) : (
          <span>Attach docs</span>
        )}
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-popover)] shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--color-border)]">
            <span className="text-xs font-medium text-[var(--color-foreground)]">
              Select documents for RAG
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {docs.map((doc) => {
              const checked = selectedIds.includes(doc.id);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => toggle(doc.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--color-secondary)] transition-colors",
                    checked && "bg-[var(--color-primary)]/5"
                  )}
                >
                  <div className={cn(
                    "w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center",
                    checked
                      ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                      : "border-[var(--color-border)]"
                  )}>
                    {checked && <span className="text-white text-[8px] font-bold">✓</span>}
                  </div>
                  <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-foreground)] truncate">{doc.filename}</p>
                    <p className="text-[10px] text-[var(--color-muted-foreground)]">
                      {doc.chunk_count} chunks
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedIds.length > 0 && (
            <div className="px-3 py-2 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              >
                <X className="w-3 h-3" /> Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
