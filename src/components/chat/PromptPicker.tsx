"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Search, X, Users, User } from "lucide-react";

interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
  variables: string; // JSON
  is_team: number;
  user_id: string;
  use_count: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  coding: "text-green-400 bg-green-500/10 border-green-500/20",
  writing: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  analysis: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  research: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  data: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  summarize: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  general: "text-[var(--color-muted-foreground)] bg-[var(--color-secondary)] border-[var(--color-border)]",
};

interface VariableFillProps {
  prompt: Prompt;
  onInsert: (text: string) => void;
  onBack: () => void;
}

function VariableFill({ prompt, onInsert, onBack }: VariableFillProps) {
  const vars: string[] = JSON.parse(prompt.variables || "[]");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(vars.map((v) => [v, ""]))
  );

  function insert() {
    let text = prompt.content;
    for (const [k, v] of Object.entries(values)) {
      text = text.replaceAll(`{{${k}}}`, v || `{{${k}}}`);
    }
    fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "use", id: prompt.id, title: prompt.title }),
    });
    onInsert(text);
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] text-xs">
          ← Back
        </button>
        <span className="text-sm font-medium text-[var(--color-foreground)] truncate">{prompt.title}</span>
      </div>
      <p className="text-xs text-[var(--color-muted-foreground)] bg-[var(--color-secondary)] rounded-md px-3 py-2 font-mono leading-relaxed line-clamp-3">
        {prompt.content.slice(0, 200)}{prompt.content.length > 200 ? "…" : ""}
      </p>
      <div className="space-y-2">
        {vars.map((v) => (
          <div key={v}>
            <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1 font-mono">
              {"{{"}{v}{"}}"}
            </label>
            <textarea
              rows={2}
              placeholder={`Enter ${v}…`}
              value={values[v]}
              onChange={(e) => setValues((p) => ({ ...p, [v]: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>
        ))}
      </div>
      <button
        onClick={insert}
        className="w-full py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Insert into chat
      </button>
    </div>
  );
}

interface Props {
  onInsert: (text: string) => void;
}

export function PromptPicker({ onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filling, setFilling] = useState<Prompt | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && prompts.length === 0) {
      fetch("/api/prompts").then((r) => r.json()).then((d) => setPrompts(d.prompts ?? []));
    }
  }, [open, prompts.length]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const categories = ["all", ...Array.from(new Set(prompts.map((p) => p.category)))];

  const filtered = prompts.filter((p) => {
    const matchCat = category === "all" || p.category === category;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function use(p: Prompt) {
    const vars: string[] = JSON.parse(p.variables || "[]");
    if (vars.length > 0) {
      setFilling(p);
    } else {
      fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "use", id: p.id, title: p.title }),
      });
      onInsert(p.content);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen((o) => !o); setFilling(null); setSearch(""); }}
        title="Prompt library"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
          open
            ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
            : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-secondary)]"
        }`}
      >
        <BookOpen className="w-3.5 h-3.5" />
        Prompts
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-80 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl z-50 overflow-hidden">
          {filling ? (
            <VariableFill
              prompt={filling}
              onInsert={(text) => { onInsert(text); setOpen(false); setFilling(null); }}
              onBack={() => setFilling(null)}
            />
          ) : (
            <>
              {/* Search */}
              <div className="p-3 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
                  <Search className="w-3.5 h-3.5 text-[var(--color-muted-foreground)] shrink-0" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search prompts…"
                    className="flex-1 bg-transparent text-sm text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] outline-none"
                  />
                  {search && (
                    <button onClick={() => setSearch("")}>
                      <X className="w-3 h-3 text-[var(--color-muted-foreground)]" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category tabs */}
              <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-[var(--color-border)]">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-colors ${
                      category === c
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Prompt list */}
              <div className="max-h-72 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted-foreground)] text-center py-6">
                    {search ? "No prompts match your search" : "No prompts yet"}
                  </p>
                ) : (
                  filtered.map((p) => {
                    const vars: string[] = JSON.parse(p.variables || "[]");
                    return (
                      <button
                        key={p.id}
                        onClick={() => use(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-secondary)] border-b border-[var(--color-border)] last:border-b-0 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-[var(--color-foreground)] truncate flex-1">
                            {p.title}
                          </span>
                          {p.is_team ? (
                            <Users className="w-3 h-3 text-[var(--color-muted-foreground)] shrink-0" />
                          ) : (
                            <User className="w-3 h-3 text-[var(--color-muted-foreground)] shrink-0" />
                          )}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium capitalize ${CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS.general}`}>
                            {p.category}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-muted-foreground)] truncate">{p.content.slice(0, 80)}</p>
                        {vars.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {vars.map((v) => (
                              <span key={v} className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-mono">
                                {"{{"}{v}{"}}"}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-3 py-2 border-t border-[var(--color-border)] flex justify-between items-center">
                <span className="text-[10px] text-[var(--color-muted-foreground)]">{filtered.length} prompt{filtered.length !== 1 ? "s" : ""}</span>
                <a href="/prompts" className="text-[10px] text-[var(--color-primary)] hover:underline">
                  Manage →
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
