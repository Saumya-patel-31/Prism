import { NextRequest } from "next/server";
import {
  createDocument,
  deleteDocument,
  insertChunk,
  listDocuments,
  updateDocumentChunkCount,
} from "@/lib/db";
import { chunkText } from "@/lib/chunker";
import { embedBatch, packEmbedding, resolveEmbedModel } from "@/lib/embeddings";
import { listModels } from "@/lib/ollama";
import { generateId } from "@/lib/metrics";
import { logAudit } from "@/lib/audit";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const docs = listDocuments(user.userId);
  return Response.json({ documents: docs });
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });

  const allowedTypes = [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "application/json",
    "text/csv",
    "text/x-python",
    "text/javascript",
    "text/typescript",
    "text/html",
    "text/css",
  ];

  const isText = file.type.startsWith("text/") || file.type === "application/json";
  const isPdf = file.type === "application/pdf";

  if (!isText && !isPdf) {
    return Response.json(
      { error: `Unsupported file type: ${file.type}. Supported: PDF, TXT, MD, JSON, CSV, code files.` },
      { status: 400 }
    );
  }

  if (file.size > 20 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 20 MB)" }, { status: 400 });
  }

  // Resolve embedding model
  let models: string[] = [];
  try {
    const modelList = await listModels();
    models = modelList.map((m) => m.name);
  } catch {
    return Response.json(
      { error: "Ollama not running — cannot embed documents" },
      { status: 503 }
    );
  }

  const embedModel = await resolveEmbedModel(models);
  if (!embedModel) {
    return Response.json(
      { error: "No models installed — pull a model first (e.g. nomic-embed-text or llama3.1)" },
      { status: 503 }
    );
  }

  // Extract text
  let text = "";
  const bytes = Buffer.from(await file.arrayBuffer());

  if (isPdf) {
    try {
      // pdf-parse ships both CJS and ESM builds; .default may or may not exist
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await import("pdf-parse") as any;
      const pdfParse = (mod.default ?? mod) as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(bytes);
      text = result.text;
    } catch (err) {
      return Response.json({ error: `PDF parsing failed: ${err}` }, { status: 400 });
    }
  } else {
    text = bytes.toString("utf-8");
  }

  if (!text.trim()) {
    return Response.json({ error: "File appears to be empty or unreadable" }, { status: 400 });
  }

  // Chunk
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return Response.json({ error: "Could not extract any text chunks" }, { status: 400 });
  }

  // Create document record
  const docId = generateId();
  createDocument({
    id: docId,
    filename: file.name,
    mimetype: file.type || "text/plain",
    sizeBytes: file.size,
    embedModel,
    userId: user.userId,
  });

  // Stream progress back as SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "start",
              docId,
              chunks: chunks.length,
              model: embedModel,
            })}\n\n`
          )
        );

        // Embed in batches of 10
        const BATCH_SIZE = 10;
        let done = 0;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch = chunks.slice(i, i + BATCH_SIZE);
          const embeddings = await embedBatch(
            batch.map((c) => c.content),
            embedModel
          );

          for (let j = 0; j < batch.length; j++) {
            insertChunk({
              id: generateId(),
              documentId: docId,
              content: batch[j].content,
              chunkIndex: batch[j].index,
              embedding: packEmbedding(embeddings[j]),
            });
          }

          done += batch.length;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "progress", done, total: chunks.length })}\n\n`
            )
          );
        }

        updateDocumentChunkCount(docId, chunks.length);
        logAudit("document.uploaded", {
          resourceType: "document",
          resourceId: docId,
          resourceName: file.name,
          metadata: { chunks: chunks.length, sizeBytes: file.size, embedModel },
        });

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", docId, chunks: chunks.length })}\n\n`
          )
        );
      } catch (err) {
        // Clean up failed document
        try { deleteDocument(docId); } catch {}
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  deleteDocument(id, user.userId);
  logAudit("document.deleted", { resourceType: "document", resourceId: id });
  return Response.json({ success: true });
}
