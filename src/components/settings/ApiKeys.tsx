"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, Terminal, AlertTriangle } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  user_id: string;
  last_used_at: number | null;
  created_at: number;
}

function timeSince(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ id: string; key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
    load();
  }, []);

  function load() {
    fetch("/api/keys").then((r) => r.json()).then((d) => setKeys(d.keys ?? []));
  }

  async function create() {
    if (!newName.trim()) return;
    setCreating(true);
    const r = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const d = await r.json();
    setCreating(false);
    if (r.ok) {
      setNewKey(d);
      setNewName("");
      load();
    }
  }

  async function revoke(id: string) {
    setRevoking(id);
    await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    setRevoking(null);
    if (newKey?.id === id) setNewKey(null);
    load();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const curlExample = newKey
    ? `curl -X POST ${baseUrl}/api/v1/chat \\
  -H "Authorization: Bearer ${newKey.key}" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!", "stream": false}'`
    : `curl -X POST ${baseUrl}/api/v1/chat \\
  -H "Authorization: Bearer prism_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!", "stream": false}'`;

  return (
    <div className="space-y-6">
      {/* New key shown once banner */}
      {newKey && (
        <div className="rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-4">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-foreground)]">Save your key — it won't be shown again</p>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                Copy it now. The full key is never stored in the database.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2">
            <code className="flex-1 text-sm font-mono text-[var(--color-foreground)] truncate">
              {visible ? newKey.key : `prism_${"•".repeat(40)}`}
            </code>
            <button
              onClick={() => setVisible((v) => !v)}
              className="p-1 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              title={visible ? "Hide" : "Show"}
            >
              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={() => copy(newKey.key)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--color-primary)] text-white text-xs font-medium hover:opacity-90"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Key name (e.g. CI Pipeline, n8n Workflow)"
          className="flex-1 px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
        <button
          onClick={create}
          disabled={creating || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          {creating ? "Creating…" : "Create key"}
        </button>
      </div>

      {/* Keys list */}
      {keys.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-[var(--color-border)] rounded-lg">
          <Key className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm text-[var(--color-muted-foreground)]">No API keys yet</p>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-1">Create a key to call Prism from scripts and automations.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
          {keys.map((k, i) => (
            <div
              key={k.id}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-[var(--color-border)]" : ""} ${newKey?.id === k.id ? "bg-[var(--color-primary)]/5" : ""}`}
            >
              <Key className="w-4 h-4 text-[var(--color-muted-foreground)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-foreground)]">{k.name}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">
                  Created {timeSince(k.created_at)}
                  {k.last_used_at ? ` · Last used ${timeSince(k.last_used_at)}` : " · Never used"}
                </p>
              </div>
              <span className="text-[10px] font-mono text-[var(--color-muted-foreground)] bg-[var(--color-secondary)] px-2 py-0.5 rounded">
                prism_••••••••
              </span>
              <button
                onClick={() => revoke(k.id)}
                disabled={revoking === k.id}
                className="p-1.5 rounded text-[var(--color-muted-foreground)] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                title="Revoke key"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Usage docs */}
      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--color-secondary)] border-b border-[var(--color-border)] flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[var(--color-muted-foreground)]" />
          <span className="text-xs font-medium text-[var(--color-foreground)]">Usage</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-[var(--color-muted-foreground)]">
            POST to <code className="text-[var(--color-foreground)] bg-[var(--color-secondary)] px-1 py-0.5 rounded">{baseUrl}/api/v1/chat</code>
          </p>
          <div className="relative">
            <pre className="text-[11px] font-mono text-[var(--color-foreground)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 overflow-x-auto leading-relaxed">
              {curlExample}
            </pre>
            <button
              onClick={() => copy(curlExample)}
              className="absolute top-2 right-2 p-1.5 rounded bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              title="Copy"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <div className="text-xs text-[var(--color-muted-foreground)] space-y-1">
            <p><span className="text-[var(--color-foreground)] font-medium">Body params:</span></p>
            <p><code className="text-[var(--color-foreground)]">message</code> — required string</p>
            <p><code className="text-[var(--color-foreground)]">model</code> — optional, defaults to first available</p>
            <p><code className="text-[var(--color-foreground)]">stream</code> — boolean (default true = SSE, false = JSON)</p>
            <p><code className="text-[var(--color-foreground)]">system</code> — optional system prompt override</p>
            <p><code className="text-[var(--color-foreground)]">history</code> — optional array of <code>&#123;"role","content"&#125;</code> messages</p>
          </div>
        </div>
      </div>
    </div>
  );
}
