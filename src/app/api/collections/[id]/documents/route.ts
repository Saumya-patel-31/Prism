import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { addDocToCollection, removeDocFromCollection, getCollection } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: collectionId } = await params;
  const { documentId } = await req.json();
  if (!documentId) return Response.json({ error: "documentId required" }, { status: 400 });

  const col = getCollection(collectionId);
  if (!col) return Response.json({ error: "Collection not found" }, { status: 404 });
  if (col.user_id !== user.userId && user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  addDocToCollection(collectionId, documentId);
  logAudit("collection.doc_added", { resourceType: "collection", resourceId: collectionId });
  return Response.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: collectionId } = await params;
  const documentId = req.nextUrl.searchParams.get("documentId");
  if (!documentId) return Response.json({ error: "documentId required" }, { status: 400 });

  const col = getCollection(collectionId);
  if (!col) return Response.json({ error: "Collection not found" }, { status: 404 });
  if (col.user_id !== user.userId && user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  removeDocFromCollection(collectionId, documentId);
  logAudit("collection.doc_removed", { resourceType: "collection", resourceId: collectionId });
  return Response.json({ success: true });
}
