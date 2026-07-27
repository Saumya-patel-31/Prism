"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "coding", label: "Coding" },
  { value: "writing", label: "Writing" },
  { value: "analysis", label: "Analysis" },
  { value: "research", label: "Research" },
  { value: "data", label: "Data" },
  { value: "summarize", label: "Summarize" },
];

interface Props {
  isAdmin: boolean;
  initial?: {
    id?: string; title?: string; content?: string;
    category?: string; isTeam?: boolean;
  };
  onSave: () => void;
  onClose: () => void;
}

function extractVars(content: string): string[] {
  return [...content.matchAll(/\{\{(\w+)\}\}/g)]
    .map((m) => m[1])
    .filter((v, i, a) => a.indexOf(v) === i);
}

export function PromptEditor({ isAdmin, initial = {}, onSave, onClose }: Props) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [content, setContent] = useState(initial.content ?? "");
  const [category, setCategory] = useState(initial.category ?? "general");
  const [isTeam, setIsTeam] = useState(initial.isTeam ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const vars = extractVars(content);
  const isEdit = !!initial.id;

  async function save() {
    if (!title.trim() || !content.trim()) { setError("Title and content are required"); return; }
    setSaving(true);
    setError("");
    const method = isEdit ? "PATCH" : "POST";
    const body = isEdit
      ? { id: initial.id, title, content, category, isTeam }
      : { title, content, category, isTeam };
    const r = await fetch("/api/prompts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { setError(d.error ?? "Failed to save"); return; }
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
            {isEdit ? "Edit prompt" : "New prompt"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-secondary)] text-[var(--color-muted-foreground)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Explain this code"
              className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1">
              Prompt content
              <span className="ml-2 font-normal opacity-60">use {"{{variable}}"} for dynamic parts</span>
            </label>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"Explain the following code:\n\n{{code}}"}
              className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            {/* Detected variables */}
            {vars.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] text-[var(--color-muted-foreground)]">Variables:</span>
                {vars.map((v) => (
                  <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-mono border border-[var(--color-primary)]/20">
                    {"{{"}{v}{"}}"}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Team toggle (admin only) */}
          {isAdmin && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                onClick={() => setIsTeam((p) => !p)}
                className={`w-8 h-4 rounded-full transition-colors relative ${isTeam ? "bg-[var(--color-primary)]" : "bg-[var(--color-secondary)]"}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isTeam ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm text-[var(--color-foreground)]">Publish to team</span>
              <span className="text-xs text-[var(--color-muted-foreground)]">Visible to all users</span>
            </label>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-secondary)] transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !title.trim() || !content.trim()}
            className="px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create prompt"}
          </button>
        </div>
      </div>
    </div>
  );
}
