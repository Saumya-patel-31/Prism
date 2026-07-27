import { NextRequest } from "next/server";
import { getAuditLog, getAuditStats } from "@/lib/audit";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

  const sp = req.nextUrl.searchParams;

  if (sp.get("stats") === "1") {
    return Response.json(getAuditStats());
  }

  const limit = Math.min(Number(sp.get("limit") ?? 50), 200);
  const offset = Number(sp.get("offset") ?? 0);
  const action = sp.get("action") ?? undefined;
  const search = sp.get("search") ?? undefined;

  return Response.json(getAuditLog({ limit, offset, action, search }));
}
