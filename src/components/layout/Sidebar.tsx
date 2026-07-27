"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare, LayoutDashboard, Cpu, Shield, FolderOpen, Settings,
  LogOut, BookOpen, Layers, Search, Gauge, FlaskConical, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { SearchModal } from "@/components/search/SearchModal";

const NAV = [
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/documents", icon: FolderOpen, label: "Documents" },
  { href: "/collections", icon: Layers, label: "Collections" },
  { href: "/prompts", icon: BookOpen, label: "Prompts" },
  { href: "/benchmark", icon: Gauge, label: "Benchmark" },
  { href: "/evals", icon: FlaskConical, label: "Evals" },
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/models", icon: Cpu, label: "Models" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth?me=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user) setUser(d.user); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
      if (e.key === "Escape") setNavOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  const logout = useCallback(async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile top bar */}
      <div className="lg:hidden shrink-0 flex items-center gap-2 h-14 px-3 border-b border-[var(--color-border)] bg-[var(--color-sidebar)]">
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          aria-expanded={navOpen}
          className="p-2.5 -ml-1 rounded-md text-[var(--color-foreground)] hover:bg-[var(--color-secondary)] transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Shield className="w-5 h-5 text-[var(--color-primary)]" />
        <span className="font-semibold tracking-tight">Prism</span>
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="ml-auto p-2.5 -mr-1 rounded-md text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-secondary)] transition-colors cursor-pointer"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* Backdrop — mobile only, when the drawer is open */}
      {navOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] cursor-pointer"
        />
      )}

      <aside
        className={cn(
          "w-56 shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-sidebar)]",
          // Mobile: off-canvas drawer
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out",
          navOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: static column
          "lg:static lg:translate-x-0 lg:h-full lg:z-auto"
        )}
      >
        {/* Logo */}
        <div className="px-5 py-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
          <Link href="/" className="font-semibold text-[var(--color-foreground)] tracking-tight hover:opacity-80 transition-opacity cursor-pointer">
            Prism
          </Link>
          <span className="text-xs text-[var(--color-muted-foreground)] ml-auto font-mono hidden lg:inline">
            local
          </span>
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
            className="lg:hidden ml-auto p-2 -mr-1 rounded-md text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-secondary)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="spectrum-line mx-2" aria-hidden="true" />

        {/* Search trigger — desktop only; mobile uses the top bar icon */}
        <div className="px-2 pt-2 hidden lg:block">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] text-xs hover:text-[var(--color-foreground)] hover:border-[var(--color-primary)]/40 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="font-mono text-[9px] opacity-50">⌘K</kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-md text-sm transition-colors cursor-pointer",
                  active
                    ? "bg-[var(--color-primary)] text-white font-medium"
                    : "text-[var(--color-sidebar-foreground)] hover:bg-[var(--color-secondary)]"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-3 border-t border-[var(--color-border)]">
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--color-foreground)] truncate">{user.username}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">{user.role}</p>
              </div>
              <button
                onClick={logout}
                aria-label="Sign out"
                title="Sign out"
                className="p-2 rounded text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-secondary)] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-[var(--color-muted-foreground)]">Local · Zero cloud calls</p>
          )}
        </div>
      </aside>
    </>
  );
}
