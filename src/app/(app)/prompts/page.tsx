"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Pencil, Trash2, Users, User, TrendingUp } from "lucide-react";
import { PromptEditor } from "@/components/prompts/PromptEditor";

interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
  variables: string;
  is_team: number;
  user_id: string;
  use_count: number;
  created_at: number;
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

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [filter, setFilter] = useState<"all" | "team" | "mine">("all");
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    const [pr, me] = await Promise.all([
      fetch("/api/prompts").then((r) => r.json()),
      fetch("/api/auth?me=1").then((r) => r.json()),
    ]);
    setPrompts(pr.prompts ?? []);
    if (me.user) {
      setIsAdmin(me.user.role === "admin");
      setCurrentUserId(me.user.id);
    }
  }

  useEffect(() => { load(); }, []);

  async function del(id: string) {
    setDeleting(id);
    await fetch(`/api/prompts?id=${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  const visible = prompts.filter((p) => {
    if (filter === "team") return p.is_team === 1;
    if (filter === "mine") return p.user_id === currentUserId;
    return true;
  });

  const teamCount = prompts.filter((p) => p.is_team).length;
  const myCount = prompts.filter((p) => p.user_id === currentUserId).length;

  function canEdit(p: Prompt) {
    return isAdmin || p.user_id === currentUserId;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BookOpen className="w-5 h-5 text-[var(--color-primary)]" />
            <h1 className="text-xl font-semibold text-[var(--color-foreground)]">Prompt Library</h1>
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Reusable prompts with {"{{variable}}"} substitution — click any prompt in chat to insert it.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowEditor(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New prompt
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total prompts", value: prompts.length, icon: BookOpen },
          { label: "Team prompts", value: teamCount, icon: Users },
          { label: "My prompts", value: myCount, icon: User },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-3.5 h-3.5 text-[var(--color-muted-foreground)]" />
              <span className="text-xs text-[var(--color-muted-foreground)]">{label}</span>
            </div>
            <span className="text-2xl font-bold text-[var(--color-foreground)]">{value}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-[var(--color-secondary)] p-1 rounded-lg w-fit">
        {(["all", "team", "mine"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filter === f
                ? "bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {f === "mine" ? "My prompts" : f === "team" ? "Team" : "All"}
          </button>
        ))}
      </div>

      {/* Prompt grid */}
      {visible.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-muted-foreground)]">
          <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No prompts here yet.</p>
          {filter === "mine" && (
            <button
              onClick={() => { setEditing(null); setShowEditor(true); }}
              className="mt-3 text-xs text-[var(--color-primary)] hover:underline"
            >
              Create your first prompt →
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map((p) => {
            const vars: string[] = JSON.parse(p.variables || "[]");
            return (
              <div
                key={p.id}
                className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-primary)]/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{p.title}</h3>
                      {p.is_team ? (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20">
                          <Users className="w-2.5 h-2.5" />
                          team
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border text-[var(--color-muted-foreground)] border-[var(--color-border)]">
                          <User className="w-2.5 h-2.5" />
                          personal
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS.general}`}>
                        {p.category}
                      </span>
                    </div>

                    {/* Content preview */}
                    <p className="text-xs text-[var(--color-muted-foreground)] font-mono bg-[var(--color-secondary)] rounded-md px-3 py-2 leading-relaxed line-clamp-2 mb-2">
                      {p.content}
                    </p>

                    {/* Variables + meta */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {vars.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {vars.map((v) => (
                            <span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-mono border border-[var(--color-primary)]/20">
                              {"{{"}{v}{"}}"}
                            </span>
                          ))}
                        </div>
                      )}
                      {p.use_count > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)]">
                          <TrendingUp className="w-2.5 h-2.5" />
                          {p.use_count} use{p.use_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canEdit(p) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditing(p); setShowEditor(true); }}
                        className="p-1.5 rounded-md text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-secondary)] transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => del(p.id)}
                        disabled={deleting === p.id}
                        className="p-1.5 rounded-md text-[var(--color-muted-foreground)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor modal */}
      {showEditor && (
        <PromptEditor
          isAdmin={isAdmin}
          initial={editing ? {
            id: editing.id,
            title: editing.title,
            content: editing.content,
            category: editing.category,
            isTeam: !!editing.is_team,
          } : {}}
          onSave={() => { setShowEditor(false); setEditing(null); load(); }}
          onClose={() => { setShowEditor(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
