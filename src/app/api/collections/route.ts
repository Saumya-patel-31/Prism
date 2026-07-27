import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  listCollections, createCollection, updateCollection, deleteCollection,
  getCollectionDocs,
} from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { generateId } from "@/lib/metrics";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const docs = getCollectionDocs(id);
    return Response.json({ docs });
  }

  const collections = listCollections(user.userId);
  return Response.json({ collections });
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, isTeam } = await req.json();
  if (!name?.trim()) return Response.json({ error: "name required" }, { status: 400 });
  if (isTeam && user.role !== "admin") {
    return Response.json({ error: "Only admins can create team collections" }, { status: 403 });
  }

  const id = generateId();
  createCollection({ id, name: name.trim(), description: description ?? "", userId: user.userId, isTeam: !!isTeam });
  logAudit("collection.created", { resourceType: "collection", resourceId: id, resourceName: name.trim() });
  return Response.json({ id });
}

export async function PATCH(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, description, isTeam } = await req.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  if (isTeam && user.role !== "admin") {
    return Response.json({ error: "Only admins can publish team collections" }, { status: 403 });
  }

  updateCollection(id, user.userId, { name, description, isTeam });
  logAudit("collection.updated", { resourceType: "collection", resourceId: id });
  return Response.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  deleteCollection(id, user.userId);
  logAudit("collection.deleted", { resourceType: "collection", resourceId: id });
  return Response.json({ success: true });
}
