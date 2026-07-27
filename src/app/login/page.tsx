"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setIsSetup(d.hasUsers));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    const action = isSetup ? "login" : "register";
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, username: username.trim(), password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.push(searchParams.get("next") ?? "/chat");
    router.refresh();
  }

  if (isSetup === null) return null;

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <Shield className="w-6 h-6 text-[var(--color-primary)]" />
          <span className="text-xl font-semibold text-[var(--color-foreground)]">Prism</span>
          <span className="text-xs text-[var(--color-muted-foreground)] font-mono border border-[var(--color-border)] rounded px-1.5 py-0.5">
            local
          </span>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h1 className="text-base font-semibold text-[var(--color-foreground)] mb-0.5">
            {isSetup ? "Sign in" : "Create admin account"}
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mb-5">
            {isSetup
              ? "Welcome back. Your data stays on this machine."
              : "First launch — this account will be the workspace admin."}
          </p>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1">
                Username
              </label>
              <input
                autoFocus
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-input)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                placeholder="e.g. alice"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-input)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                placeholder="••••••••"
                autoComplete={isSetup ? "current-password" : "new-password"}
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity mt-1"
            >
              {loading ? "Please wait…" : isSetup ? "Sign in" : "Create account & sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-[var(--color-muted-foreground)] mt-4">
          All data is stored locally. Zero cloud calls.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
