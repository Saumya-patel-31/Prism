"use client";

import { useEffect, useState } from "react";

interface Workspace {
  name: string;
  default_system_prompt: string;
  default_model: string;
  ollama_host: string;
}

export function WorkspaceConfig({ models }: { models: string[] }) {
  const [ws, setWs] = useState<Workspace>({
    name: "My Workspace",
    default_system_prompt: "",
    default_model: "",
    ollama_host: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setWs({ name: d.name, default_system_prompt: d.default_system_prompt, default_model: d.default_model, ollama_host: d.ollama_host ?? "" }));
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: ws.name,
        defaultSystemPrompt: ws.default_system_prompt,
        defaultModel: ws.default_model,
        ollamaHost: ws.ollama_host,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1.5">
          Workspace name
        </label>
        <input
          className="w-full max-w-sm px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          value={ws.name}
          onChange={(e) => setWs((p) => ({ ...p, name: e.target.value }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1.5">
          Default model
        </label>
        <select
          className="w-full max-w-sm px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          value={ws.default_model}
          onChange={(e) => setWs((p) => ({ ...p, default_model: e.target.value }))}
        >
          <option value="">Auto (smart router picks)</option>
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          When set, this model is used unless you override it per-chat.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1.5">
          Default system prompt
        </label>
        <textarea
          rows={5}
          className="w-full max-w-2xl px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          placeholder="You are a helpful AI assistant..."
          value={ws.default_system_prompt}
          onChange={(e) => setWs((p) => ({ ...p, default_system_prompt: e.target.value }))}
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Injected at the start of every new conversation.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1.5">
          Ollama server URL
        </label>
        <input
          className="w-full max-w-sm px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          value={ws.ollama_host}
          onChange={(e) => setWs((p) => ({ ...p, ollama_host: e.target.value }))}
          placeholder="http://192.168.1.50:11434"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Leave blank to use localhost. Point this at a shared GPU server so no one needs to install Ollama locally.
        </p>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
      </button>
    </div>
  );
}
