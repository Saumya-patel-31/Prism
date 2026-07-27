import { NextRequest } from "next/server";
import { getWorkspace, updateWorkspace, getDbStats, clearAllData } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  if (sp.get("stats") === "1") {
    return Response.json(getDbStats());
  }

  return Response.json(getWorkspace());
}

export async function PATCH(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user || user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });
  const body = await req.json();
  const { name, defaultSystemPrompt, defaultModel, ollamaHost } = body;
  updateWorkspace({ name, defaultSystemPrompt, defaultModel, ollamaHost });
  logAudit("workspace.updated", {
    resourceType: "workspace",
    resourceId: "default",
    metadata: { fields: Object.keys(body) },
  });
  return Response.json(getWorkspace());
}

export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("action") !== "clear") {
    return Response.json({ error: "action=clear required" }, { status: 400 });
  }
  clearAllData();
  logAudit("data.cleared", { resourceType: "workspace", resourceId: "default" });
  return Response.json({ success: true });
}
