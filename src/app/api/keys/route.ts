import { NextRequest } from "next/server";
import { getUserFromRequest, generateApiKey, hashApiKey } from "@/lib/auth";
import { listApiKeys, createApiKey, revokeApiKey } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { generateId } from "@/lib/metrics";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ keys: listApiKeys(user.userId) });
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return Response.json({ error: "name required" }, { status: 400 });

  const rawKey = generateApiKey();
  const id = generateId();
  createApiKey({ id, keyHash: hashApiKey(rawKey), name: name.trim(), userId: user.userId });
  logAudit("apikey.created", { resourceType: "api_key", resourceId: id, resourceName: name.trim() });

  // Return raw key once — never stored in DB
  return Response.json({ id, key: rawKey, name: name.trim() });
}

export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  revokeApiKey(id, user.userId);
  logAudit("apikey.revoked", { resourceType: "api_key", resourceId: id });
  return Response.json({ success: true });
}
