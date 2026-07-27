"use client";

import { useEffect, useRef, useState } from "react";
import { Layers, X, ChevronDown, FileText } from "lucide-react";

interface Collection {
  id: string;
  name: string;
  description: string;
  is_team: number;
  doc_count: number;
}

interface Props {
  onCollectionChange: (docIds: string[], collectionName: string | null) => void;
}

export function CollectionPicker({ onCollectionChange }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<Collection | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d) => setCollections(d.collections ?? []));
  }, []);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function select(col: Collection) {
    setSelected(col);
    setOpen(false);
    const r = await fetch(`/api/collections?id=${col.id}`);
    const d = await r.json();
    const ids = (d.docs ?? []).map((doc: { id: string }) => doc.id);
    onCollectionChange(ids, col.name);
  }

  function clear() {
    setSelected(null);
    onCollectionChange([], null);
  }

  return (
    <div className="relative" ref={ref}>
      {selected ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium truncate max-w-[120px]">{selected.name}</span>
          <span className="opacity-60">({selected.doc_count})</span>
          <button onClick={clear} className="ml-0.5 hover:opacity-80">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
            open
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
              : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-secondary)]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Collection
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      )}

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-72 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[var(--color-border)]">
            <p className="text-xs font-medium text-[var(--color-foreground)]">Knowledge Collections</p>
            <p className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
              Select a collection to load all its documents into context
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {collections.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-[var(--color-muted-foreground)]">No collections yet</p>
                <a href="/collections" className="text-[10px] text-[var(--color-primary)] hover:underline mt-1 block">
                  Create one →
                </a>
              </div>
            ) : (
              collections.map((col) => (
                <button
                  key={col.id}
                  onClick={() => select(col)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-secondary)] border-b border-[var(--color-border)] last:border-b-0 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Layers className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                    <span className="text-sm font-medium text-[var(--color-foreground)] flex-1 truncate">{col.name}</span>
                    {col.is_team === 1 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded border bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20">
                        team
                      </span>
                    )}
                  </div>
                  {col.description && (
                    <p className="text-[10px] text-[var(--color-muted-foreground)] truncate pl-5 mb-1">{col.description}</p>
                  )}
                  <div className="flex items-center gap-1 pl-5">
                    <FileText className="w-2.5 h-2.5 text-[var(--color-muted-foreground)]" />
                    <span className="text-[10px] text-[var(--color-muted-foreground)]">
                      {col.doc_count} document{col.doc_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="px-3 py-2 border-t border-[var(--color-border)]">
            <a href="/collections" className="text-[10px] text-[var(--color-primary)] hover:underline">
              Manage collections →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
