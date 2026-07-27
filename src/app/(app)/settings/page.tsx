"use client";

import { useEffect, useState } from "react";
import { WorkspaceConfig } from "@/components/settings/WorkspaceConfig";
import { AuditLog } from "@/components/settings/AuditLog";
import { UserManagement } from "@/components/settings/UserManagement";
import { ApiKeys } from "@/components/settings/ApiKeys";

interface DbStats {
  sizeBytes: number;
  tableRows: Record<string, number>;
}

export default function SettingsPage() {
  const [models, setModels] = useState<string[]>([]);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [clearing, setClearing] = useState(false);
  const [tab, setTab] = useState<"workspace" | "users" | "apikeys" | "audit" | "storage">("workspace");
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => setModels((d.models ?? []).map((m: { name: string }) => m.name)));
    fetch("/api/settings?stats=1")
      .then((r) => r.json())
      .then(setStats);
    fetch("/api/auth?me=1")
      .then((r) => r.json())
      .then((d) => { if (d.user) setCurrentUser(d.user); });
  }, []);

  async function clearData() {
    if (!confirm("This will permanently delete all sessions, messages, metrics, documents, and audit logs. Continue?")) return;
    setClearing(true);
    await fetch("/api/settings?action=clear", { method: "DELETE" });
    setClearing(false);
    setStats(null);
    fetch("/api/settings?stats=1").then((r) => r.json()).then(setStats);
  }

  const TABS = [
    { id: "workspace", label: "Workspace", adminOnly: false },
    { id: "users", label: "Users", adminOnly: true },
    { id: "apikeys", label: "API Keys", adminOnly: false },
    { id: "audit", label: "Audit Log", adminOnly: false },
    { id: "storage", label: "Storage & Danger", adminOnly: true },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-6 py-4">
        <h1 className="text-xl font-semibold text-[var(--color-foreground)]">Settings</h1>
        <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5">
          Workspace configuration, audit trail, and data management
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-6 pt-4 border-b border-[var(--color-border)]">
        {TABS.filter((t) => !t.adminOnly || currentUser?.role === "admin").map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              tab === t.id
                ? "bg-[var(--color-surface)] border border-b-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-foreground)] -mb-px"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {tab === "workspace" && (
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold text-[var(--color-foreground)] mb-4">
              Workspace Configuration
            </h2>
            <WorkspaceConfig models={models} />
          </div>
        )}

        {tab === "users" && currentUser && (
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold text-[var(--color-foreground)] mb-4">
              Team Members
            </h2>
            <UserManagement currentUserId={currentUser.id} />
          </div>
        )}

        {tab === "apikeys" && (
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold text-[var(--color-foreground)] mb-1">API Keys</h2>
            <p className="text-sm text-[var(--color-muted-foreground)] mb-6">
              Generate keys to call Prism from scripts, CI pipelines, and automation tools. Keys are personal — they act as your identity.
            </p>
            <ApiKeys />
          </div>
        )}

        {tab === "audit" && (
          <div>
            <h2 className="text-base font-semibold text-[var(--color-foreground)] mb-4">
              Audit Log
            </h2>
            <AuditLog />
          </div>
        )}

        {tab === "storage" && (
          <div className="max-w-xl space-y-8">
            {/* Storage stats */}
            <div>
              <h2 className="text-base font-semibold text-[var(--color-foreground)] mb-4">
                Database
              </h2>
              {stats ? (
                <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                  <div className="px-4 py-3 flex justify-between bg-[var(--color-secondary)] text-sm text-[var(--color-muted-foreground)]">
                    <span>File size</span>
                    <span className="font-mono text-[var(--color-foreground)]">
                      {(stats.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  {Object.entries(stats.tableRows).map(([table, count]) => (
                    <div
                      key={table}
                      className="px-4 py-2.5 flex justify-between border-t border-[var(--color-border)] text-sm"
                    >
                      <span className="text-[var(--color-muted-foreground)] font-mono">{table}</span>
                      <span className="text-[var(--color-foreground)] font-mono">{count.toLocaleString()} rows</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-muted-foreground)]">Loading…</p>
              )}
            </div>

            {/* Danger zone */}
            <div className="rounded-lg border border-red-500/30 p-5">
              <h3 className="text-sm font-semibold text-red-400 mb-1">Danger zone</h3>
              <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
                Permanently delete all sessions, messages, metrics, uploaded documents, and audit logs.
                This cannot be undone.
              </p>
              <button
                onClick={clearData}
                disabled={clearing}
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {clearing ? "Clearing…" : "Clear all data"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
