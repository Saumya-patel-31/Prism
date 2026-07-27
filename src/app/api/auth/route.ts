import { NextRequest } from "next/server";
import {
  hashPassword,
  verifyPassword,
  signToken,
  getUserFromRequest,
  makeCookieHeader,
  clearCookieHeader,
} from "@/lib/auth";
import {
  countUsers,
  createUser,
  getUserByUsername,
  getUserById,
  updateUserPassword,
  getUserTokenVersion,
  incrementTokenVersion,
} from "@/lib/db";
import { generateId } from "@/lib/metrics";
import { rateLimit, resetRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

// GET — setup check or current user info
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  if (sp.get("me") === "1") {
    const user = getUserFromRequest(req);
    if (!user) return Response.json({ user: null }, { status: 401 });
    const row = getUserById(user.userId);
    return Response.json({ user: row });
  }

  const hasUsers = countUsers() > 0;
  return Response.json({ hasUsers });
}

export async function POST(req: NextRequest) {
  const { action, username, password, newPassword } = await req.json();

  // --- Register (first-time setup) ---
  if (action === "register") {
    if (countUsers() > 0) {
      return Response.json({ error: "Setup already complete. Ask an admin to add your account." }, { status: 403 });
    }
    if (!username?.trim() || !password || password.length < 6) {
      return Response.json({ error: "Username and password (min 6 chars) required" }, { status: 400 });
    }
    const id = generateId();
    const passwordHash = await hashPassword(password);
    createUser({ id, username: username.trim(), passwordHash, role: "admin" });
    const token = signToken({ userId: id, username: username.trim(), role: "admin", tokenVersion: 0 });
    return Response.json(
      { user: { id, username: username.trim(), role: "admin" } },
      { headers: { "Set-Cookie": makeCookieHeader(token) } }
    );
  }

  // --- Login ---
  if (action === "login") {
    if (!username?.trim() || !password) {
      return Response.json({ error: "Username and password required" }, { status: 400 });
    }

    // Rate-limit: max 10 attempts per username per 15 minutes
    const rlKey = `login:${username.trim().toLowerCase()}`;
    const rl = rateLimit(rlKey, 10, 15 * 60 * 1000);
    if (!rl.ok) {
      return Response.json(
        { error: `Too many login attempts. Try again in ${rl.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const row = getUserByUsername(username.trim());
    if (!row) return Response.json({ error: "Invalid username or password" }, { status: 401 });
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) return Response.json({ error: "Invalid username or password" }, { status: 401 });

    // Clear the rate limit bucket on successful login
    resetRateLimit(rlKey);

    const tokenVersion = getUserTokenVersion(row.id) ?? 0;
    const token = signToken({ userId: row.id, username: row.username, role: row.role, tokenVersion });
    return Response.json(
      { user: { id: row.id, username: row.username, role: row.role } },
      { headers: { "Set-Cookie": makeCookieHeader(token) } }
    );
  }

  // --- Logout ---
  if (action === "logout") {
    return Response.json(
      { success: true },
      { headers: { "Set-Cookie": clearCookieHeader() } }
    );
  }

  // --- Change password (own) ---
  if (action === "change_password") {
    const user = getUserFromRequest(req);
    if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
    if (!newPassword || newPassword.length < 6) {
      return Response.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }
    const newHash = await hashPassword(newPassword);
    updateUserPassword(user.userId, newHash);

    // Invalidate all other sessions by bumping the token version
    const newVersion = incrementTokenVersion(user.userId);
    // Re-issue a cookie with the new version so this session stays valid
    const token = signToken({ userId: user.userId, username: user.username, role: user.role, tokenVersion: newVersion });
    return Response.json(
      { success: true },
      { headers: { "Set-Cookie": makeCookieHeader(token) } }
    );
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
