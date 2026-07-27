"use client";

import { useEffect, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";

interface UserRow {
  id: string;
  username: string;
  role: "admin" | "user";
  created_at: number;
}

export function UserManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const r = await fetch("/api/users");
    const d = await r.json();
    setUsers(d.users ?? []);
  }

  useEffect(() => { load(); }, []);

  async function createUser() {
    if (!newUsername.trim() || !newPassword) return;
    setCreating(true);
    setError("");
    const r = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
    });
    const d = await r.json();
    setCreating(false);
    if (!r.ok) { setError(d.error ?? "Failed to create user"); return; }
    setNewUsername("");
    setNewPassword("");
    setNewRole("user");
    load();
  }

  async function deleteUser(id: string) {
    if (id === currentUserId) { setError("You cannot delete your own account"); return; }
    await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      {/* User list */}
      <div>
        <h3 className="text-sm font-medium text-[var(--color-foreground)] mb-3">
          Members ({users.length})
        </h3>
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] last:border-b-0"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-foreground)]">{u.username}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                    u.role === "admin"
                      ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  }`}>
                    {u.role}
                  </span>
                  {u.id === currentUserId && (
                    <span className="text-[10px] text-[var(--color-muted-foreground)]">(you)</span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                  Joined {new Date(u.created_at).toLocaleDateString()}
                </p>
              </div>
              {u.id !== currentUserId && (
                <button
                  onClick={() => deleteUser(u.id)}
                  className="p-1.5 rounded text-[var(--color-muted-foreground)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add user */}
      <div>
        <h3 className="text-sm font-medium text-[var(--color-foreground)] mb-3">Add member</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <input
              type="password"
              placeholder="Password (min 6)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "user" | "admin")}
              className="px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <button
            onClick={createUser}
            disabled={creating || !newUsername.trim() || !newPassword}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <UserPlus className="w-4 h-4" />
            {creating ? "Creating…" : "Add member"}
          </button>
        </div>
      </div>
    </div>
  );
}
