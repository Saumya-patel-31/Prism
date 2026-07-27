"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, X, MessageSquare, FileText, BookOpen, Layers, Hash,
  ArrowRight, Clock,
} from "lucide-react";

interface SearchResults {
  sessions: { id: string; title: string; updated_at: number }[];
  messages: { id: string; session_id: string; snippet: string; role: string; created_at: number; session_title: string }[];
  documents: { id: string; filename: string; mimetype: string; size_bytes: number; created_at: number }[];
  prompts: { id: string; title: string; snippet: string; category: string; is_team: number }[];
  collections: { id: string; name: string; description: string; doc_count: number }[];
}

function timeSince(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

interface ResultItem {
  key: string;
  icon: React.ReactNode;
  primary: string;
  secondary?: string;
  meta?: string;
  href: string;
}

function flatten(results: SearchResults): ResultItem[] {
  const items: ResultItem[] = [];

  for (const s of results.sessions) {
    items.push({
      key: `session-${s.id}`,
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      primary: s.title,
      meta: timeSince(s.updated_at),
      href: `/chat?session=${s.id}`,
    });
  }
  for (const m of results.messages) {
    items.push({
      key: `msg-${m.id}`,
      icon: <Hash className="w-3.5 h-3.5" />,
      primary: m.session_title,
      secondary: m.snippet,
      meta: timeSince(m.created_at),
      href: `/chat?session=${m.session_id}`,
    });
  }
  for (const d of results.documents) {
    items.push({
      key: `doc-${d.id}`,
      icon: <FileText className="w-3.5 h-3.5" />,
      primary: d.filename,
      meta: timeSince(d.created_at),
      href: `/documents`,
    });
  }
  for (const p of results.prompts) {
    items.push({
      key: `prompt-${p.id}`,
      icon: <BookOpen className="w-3.5 h-3.5" />,
      primary: p.title,
      secondary: p.snippet,
      meta: p.category,
      href: `/prompts`,
    });
  }
  for (const c of results.collections) {
    items.push({
      key: `col-${c.id}`,
      icon: <Layers className="w-3.5 h-3.5" />,
      primary: c.name,
      secondary: c.description || undefined,
      meta: `${c.doc_count} docs`,
      href: `/collections`,
    });
  }

  return items;
}

function hasResults(r: SearchResults) {
  return r.sessions.length + r.messages.length + r.documents.length + r.prompts.length + r.collections.length > 0;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    setLoading(false);
    setResults(d);
    setCursor(0);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 200);
  }

  const items = results ? flatten(results) : [];

  function navigate(href: string) {
    router.push(href);
    // A query-only change (already on /chat) doesn't remount ChatInterface,
    // so tell it directly which session to open.
    const session = href.startsWith("/chat?")
      ? new URLSearchParams(href.split("?")[1]).get("session")
      : null;
    if (session) {
      window.dispatchEvent(new CustomEvent("prism:open-session", { detail: session }));
    }
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && items[cursor]) navigate(items[cursor].href);
  }

  if (!open) return null;

  const total = results
    ? results.sessions.length + results.messages.length + results.documents.length + results.prompts.length + results.collections.length
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <Search className="w-4 h-4 text-[var(--color-muted-foreground)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Search sessions, messages, documents, prompts…"
            className="flex-1 bg-transparent text-sm text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults(null); inputRef.current?.focus(); }}>
              <X className="w-4 h-4 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-[var(--color-border)] text-[var(--color-muted-foreground)] font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8 text-xs text-[var(--color-muted-foreground)]">
              Searching…
            </div>
          )}

          {!loading && results && !hasResults(results) && (
            <div className="flex flex-col items-center justify-center py-10 text-[var(--color-muted-foreground)]">
              <Search className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">No results for "{query}"</p>
            </div>
          )}

          {!loading && results && hasResults(results) && (() => {
            let globalIdx = 0;
            const sections: React.ReactNode[] = [];

            const renderSection = (
              label: string,
              sectionItems: ResultItem[],
              icon: React.ReactNode,
            ) => {
              if (sectionItems.length === 0) return null;
              const nodes = sectionItems.map((item) => {
                const idx = globalIdx++;
                const active = idx === cursor;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => setCursor(idx)}
                    className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                      active ? "bg-[var(--color-primary)] text-white" : "hover:bg-[var(--color-secondary)]"
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 ${active ? "text-white" : "text-[var(--color-muted-foreground)]"}`}>
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${active ? "text-white" : "text-[var(--color-foreground)]"}`}>
                        {item.primary}
                      </p>
                      {item.secondary && (
                        <p className={`text-xs truncate mt-0.5 ${active ? "text-white/70" : "text-[var(--color-muted-foreground)]"}`}>
                          {item.secondary}
                        </p>
                      )}
                    </div>
                    <div className={`flex items-center gap-1.5 shrink-0 ${active ? "text-white/70" : "text-[var(--color-muted-foreground)]"}`}>
                      {item.meta && <span className="text-[10px]">{item.meta}</span>}
                      {active && <ArrowRight className="w-3 h-3" />}
                    </div>
                  </button>
                );
              });
              return (
                <div key={label}>
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--color-secondary)]">
                    <span className="text-[var(--color-muted-foreground)]">{icon}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">{label}</span>
                  </div>
                  {nodes}
                </div>
              );
            };

            const sessionItems = items.filter((i) => i.key.startsWith("session-"));
            const msgItems = items.filter((i) => i.key.startsWith("msg-"));
            const docItems = items.filter((i) => i.key.startsWith("doc-"));
            const promptItems = items.filter((i) => i.key.startsWith("prompt-"));
            const colItems = items.filter((i) => i.key.startsWith("col-"));

            sections.push(renderSection("Sessions", sessionItems, <MessageSquare className="w-3 h-3" />));
            sections.push(renderSection("Messages", msgItems, <Hash className="w-3 h-3" />));
            sections.push(renderSection("Documents", docItems, <FileText className="w-3 h-3" />));
            sections.push(renderSection("Prompts", promptItems, <BookOpen className="w-3 h-3" />));
            sections.push(renderSection("Collections", colItems, <Layers className="w-3 h-3" />));

            return <>{sections}</>;
          })()}

          {!query && !results && (
            <div className="py-8 text-center text-[var(--color-muted-foreground)]">
              <p className="text-sm">Type to search across all your content</p>
              <p className="text-xs mt-1 opacity-60">Sessions · Messages · Documents · Prompts · Collections</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {results && total > 0 && (
          <div className="px-4 py-2 border-t border-[var(--color-border)] flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-muted-foreground)]">{total} result{total !== 1 ? "s" : ""}</span>
            <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted-foreground)]">
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> open</span>
              <span><kbd className="font-mono">esc</kbd> close</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
