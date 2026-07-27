import { NextRequest } from "next/server";
import {
  createSession,
  deleteSession,
  getMessages,
  getSessions,
  updateSessionTitle,
} from "@/lib/db";
import { generateId } from "@/lib/metrics";
import { logAudit } from "@/lib/audit";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get("id");
  if (sessionId) {
    const messages = getMessages(sessionId);
    return Response.json({ messages });
  }
  const sessions = getSessions(user.userId);
  return Response.json({ sessions });
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = generateId();
  const title = body.title ?? "New Chat";
  createSession(id, title, user.userId);
  logAudit("session.created", { resourceType: "session", resourceId: id, resourceName: title });
  return Response.json({ id });
}

export async function PATCH(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, title } = await req.json();
  if (!id || !title) return Response.json({ error: "id and title required" }, { status: 400 });
  updateSessionTitle(id, title);
  return Response.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  deleteSession(id, user.userId);
  logAudit("session.deleted", { resourceType: "session", resourceId: id });
  return Response.json({ success: true });
}
