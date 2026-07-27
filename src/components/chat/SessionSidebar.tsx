"use client";

import { useEffect, useState } from "react";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Session } from "@/types";

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function SessionSidebar({ activeId, onSelect, onNew }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);

  async function load() {
    const res = await fetch("/api/sessions");
    const data = await res.json();
    setSessions(
      (data.sessions ?? []).map((s: Record<string, unknown>) => ({
        id: s.id,
        title: s.title,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        messageCount: s.message_count ?? 0,
        modelUsed: s.model_used,
      }))
    );
  }

  useEffect(() => {
    load();
  }, [activeId]);

  async function deleteSession(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await fetch(`/api/sessions?id=${id}`, { method: "DELETE" });
    load();
    if (activeId === id) onNew();
  }

  return (
    <div className="w-52 shrink-0 flex flex-col h-full border-r border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="p-2 border-b border-[var(--color-border)]">
        <Button size="sm" className="w-full gap-2 text-xs" onClick={onNew}>
          <Plus className="w-3.5 h-3.5" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {sessions.length === 0 && (
            <p className="text-xs text-[var(--color-muted-foreground)] px-3 py-4 text-center">
              No chats yet
            </p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={cn(
                "w-full text-left flex items-start gap-2 px-2.5 py-2 rounded-md text-xs transition-colors group",
                activeId === s.id
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-foreground)] hover:bg-[var(--color-secondary)]"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
              <span className="flex-1 line-clamp-2 leading-tight">{s.title}</span>
              <Trash2
                className={cn(
                  "w-3 h-3 shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 mt-0.5 transition-opacity",
                  activeId === s.id && "text-white"
                )}
                onClick={(e) => deleteSession(e, s.id)}
              />
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
