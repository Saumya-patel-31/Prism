"use client";

import { useEffect, useState, useCallback } from "react";

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

const ACTION_OPTIONS = [
  "chat.created",
  "session.created",
  "session.deleted",
  "document.uploaded",
  "document.deleted",
  "model.pulled",
  "model.deleted",
  "workspace.updated",
  "data.cleared",
];

const ACTION_COLORS: Record<string, string> = {
  "chat.created": "text-blue-400",
  "session.created": "text-green-400",
  "session.deleted": "text-red-400",
  "document.uploaded": "text-emerald-400",
  "document.deleted": "text-red-400",
  "model.pulled": "text-purple-400",
  "model.deleted": "text-red-400",
  "workspace.updated": "text-yellow-400",
  "data.cleared": "text-red-500",
};

const PAGE_SIZE = 25;

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (action) params.set("action", action);
    if (search) params.set("search", search);
    const r = await fetch(`/api/audit?${params}`);
    const d = await r.json();
    setEntries(d.entries ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [page, action, search]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Reset to page 0 when filter changes
  useEffect(() => {
    setPage(0);
  }, [action, search]);

  function exportCsv() {
    const headers = ["id", "action", "resourceType", "resourceName", "resourceId", "createdAt"];
    const rows = entries.map((e) =>
      [e.id, e.action, e.resourceType, e.resourceName ?? "", e.resourceId ?? "", new Date(e.createdAt).toISOString()].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prism-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search…"
          className="px-3 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm w-52 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="px-3 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button
          onClick={exportCsv}
          className="ml-auto px-3 py-1.5 rounded-md border border-[var(--color-border)] text-sm text-[var(--color-foreground)] hover:bg-[var(--color-secondary)] transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-secondary)] text-[var(--color-muted-foreground)]">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Action</th>
              <th className="text-left px-4 py-2.5 font-medium">Resource</th>
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[var(--color-muted-foreground)]">
                  Loading…
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[var(--color-muted-foreground)]">
                  No audit events yet
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="hover:bg-[var(--color-secondary)] transition-colors">
                  <td className={`px-4 py-2.5 font-mono ${ACTION_COLORS[e.action] ?? "text-[var(--color-foreground)]"}`}>
                    {e.action}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-muted-foreground)]">{e.resourceType}</td>
                  <td className="px-4 py-2.5 text-[var(--color-foreground)] truncate max-w-[200px]">
                    {e.resourceName ?? e.resourceId ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-muted-foreground)] whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm text-[var(--color-muted-foreground)]">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-secondary)] disabled:opacity-40 transition-colors"
          >
            Prev
          </button>
          <span>Page {page + 1} of {totalPages} &middot; {total} events</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-secondary)] disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
