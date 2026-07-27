import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

function snippet(text: string, query: string, maxLen = 120): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? "…" : "");
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 80);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ sessions: [], messages: [], documents: [], prompts: [], collections: [] });

  const db = getDb();
  const like = `%${q}%`;
  const uid = user.userId;

  // Sessions matching title
  const sessions = db.prepare(`
    SELECT id, title, updated_at FROM sessions
    WHERE user_id = ? AND title LIKE ?
    ORDER BY updated_at DESC LIMIT 5
  `).all(uid, like) as { id: string; title: string; updated_at: number }[];

  // Messages matching content (with session info)
  const messages = db.prepare(`
    SELECT m.id, m.session_id, m.content, m.role, m.created_at, s.title as session_title
    FROM messages m
    JOIN sessions s ON s.id = m.session_id
    WHERE s.user_id = ? AND m.role != 'system' AND m.content LIKE ?
    ORDER BY m.created_at DESC LIMIT 8
  `).all(uid, like) as {
    id: string; session_id: string; content: string;
    role: string; created_at: number; session_title: string;
  }[];

  // Documents
  const documents = db.prepare(`
    SELECT id, filename, mimetype, size_bytes, chunk_count, created_at FROM documents
    WHERE user_id = ? AND filename LIKE ?
    ORDER BY created_at DESC LIMIT 5
  `).all(uid, like) as {
    id: string; filename: string; mimetype: string;
    size_bytes: number; chunk_count: number; created_at: number;
  }[];

  // Prompts (own + team)
  const prompts = db.prepare(`
    SELECT id, title, content, category, is_team FROM prompts
    WHERE (user_id = ? OR is_team = 1) AND (title LIKE ? OR content LIKE ?)
    ORDER BY use_count DESC LIMIT 5
  `).all(uid, like, like) as {
    id: string; title: string; content: string;
    category: string; is_team: number;
  }[];

  // Collections (own + team)
  const collections = db.prepare(`
    SELECT c.id, c.name, c.description, c.is_team, COUNT(cd.document_id) as doc_count
    FROM collections c
    LEFT JOIN collection_documents cd ON cd.collection_id = c.id
    WHERE (c.user_id = ? OR c.is_team = 1) AND (c.name LIKE ? OR c.description LIKE ?)
    GROUP BY c.id
    ORDER BY c.updated_at DESC LIMIT 5
  `).all(uid, like, like) as {
    id: string; name: string; description: string;
    is_team: number; doc_count: number;
  }[];

  return Response.json({
    sessions: sessions.map((s) => ({ ...s, snippet: s.title })),
    messages: messages.map((m) => ({ ...m, snippet: snippet(m.content, q) })),
    documents,
    prompts: prompts.map((p) => ({ ...p, snippet: snippet(p.content, q) })),
    collections,
  });
}
