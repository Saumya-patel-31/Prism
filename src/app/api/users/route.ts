import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { listUsers, createUser, deleteUser } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { generateId } from "@/lib/metrics";

export const runtime = "nodejs";

function requireAdmin(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return { error: "Not authenticated", status: 401, user: null };
  if (user.role !== "admin") return { error: "Admin only", status: 403, user: null };
  return { error: null, status: 200, user };
}

export async function GET(req: NextRequest) {
  const { error, status } = requireAdmin(req);
  if (error) return Response.json({ error }, { status });
  return Response.json({ users: listUsers() });
}

export async function POST(req: NextRequest) {
  const { error, status } = requireAdmin(req);
  if (error) return Response.json({ error }, { status });

  const { username, password, role } = await req.json();
  if (!username?.trim() || !password || password.length < 6) {
    return Response.json({ error: "Username and password (min 6 chars) required" }, { status: 400 });
  }
  const id = generateId();
  const passwordHash = await hashPassword(password);
  try {
    createUser({ id, username: username.trim(), passwordHash, role: role === "admin" ? "admin" : "user" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) return Response.json({ error: "Username already taken" }, { status: 409 });
    throw e;
  }
  return Response.json({ id, username: username.trim() });
}

export async function DELETE(req: NextRequest) {
  const { error, status, user } = requireAdmin(req);
  if (error) return Response.json({ error }, { status });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  if (id === user!.userId) return Response.json({ error: "Cannot delete your own account" }, { status: 400 });
  deleteUser(id);
  return Response.json({ success: true });
}
