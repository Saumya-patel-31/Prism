import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { listPrompts, createPrompt, updatePrompt, deletePrompt, incrementPromptUse } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { generateId } from "@/lib/metrics";

export const runtime = "nodejs";

function extractVars(content: string): string {
  const vars = [...content.matchAll(/\{\{(\w+)\}\}/g)]
    .map((m) => m[1])
    .filter((v, i, a) => a.indexOf(v) === i);
  return JSON.stringify(vars);
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const prompts = listPrompts(user.userId);
  return Response.json({ prompts });
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Track usage
  if (body.action === "use" && body.id) {
    incrementPromptUse(body.id);
    logAudit("prompt.used", { resourceType: "prompt", resourceId: body.id, resourceName: body.title });
    return Response.json({ success: true });
  }

  const { title, content, category, isTeam } = body;
  if (!title?.trim() || !content?.trim()) {
    return Response.json({ error: "title and content required" }, { status: 400 });
  }
  if (isTeam && user.role !== "admin") {
    return Response.json({ error: "Only admins can create team prompts" }, { status: 403 });
  }

  const id = generateId();
  createPrompt({
    id, title: title.trim(), content: content.trim(),
    category: category ?? "general",
    variables: extractVars(content),
    isTeam: !!isTeam,
    userId: user.userId,
  });
  logAudit("prompt.created", { resourceType: "prompt", resourceId: id, resourceName: title.trim() });
  return Response.json({ id });
}

export async function PATCH(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, content, category, isTeam } = await req.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  if (isTeam && user.role !== "admin") {
    return Response.json({ error: "Only admins can publish team prompts" }, { status: 403 });
  }

  updatePrompt(id, user.userId, {
    title, content, category,
    variables: content ? extractVars(content) : undefined,
    isTeam,
  });
  logAudit("prompt.updated", { resourceType: "prompt", resourceId: id });
  return Response.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  deletePrompt(id, user.userId);
  logAudit("prompt.deleted", { resourceType: "prompt", resourceId: id });
  return Response.json({ success: true });
}
