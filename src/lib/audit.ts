import { getDb } from "./db";
import { generateId } from "./metrics";

export type AuditAction =
  | "chat.created"
  | "session.created"
  | "session.deleted"
  | "document.uploaded"
  | "document.deleted"
  | "model.pulled"
  | "model.deleted"
  | "workspace.updated"
  | "data.cleared"
  | "prompt.created"
  | "prompt.updated"
  | "prompt.deleted"
  | "prompt.used"
  | "collection.created"
  | "collection.updated"
  | "collection.deleted"
  | "collection.doc_added"
  | "collection.doc_removed"
  | "apikey.created"
  | "apikey.revoked"
  | "apikey.used"
  | "benchmark.run";

export interface AuditEntry {
  id: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export function logAudit(
  action: AuditAction,
  opts: {
    resourceType: string;
    resourceId?: string;
    resourceName?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_log (id, action, resource_type, resource_id, resource_name, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        generateId(),
        action,
        opts.resourceType,
        opts.resourceId ?? null,
        opts.resourceName ?? null,
        opts.metadata ? JSON.stringify(opts.metadata) : null,
        Date.now()
      );
  } catch {
    // Never crash the main path due to audit failure
  }
}

export function getAuditLog(opts: {
  limit?: number;
  offset?: number;
  action?: string;
  search?: string;
}): { entries: AuditEntry[]; total: number } {
  const db = getDb();
  const { limit = 50, offset = 0, action, search } = opts;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (action) {
    conditions.push("action = ?");
    params.push(action);
  }
  if (search) {
    conditions.push("(resource_name LIKE ? OR action LIKE ? OR metadata LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = (
    db.prepare(`SELECT COUNT(*) as n FROM audit_log ${where}`).get(...params) as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Record<string, unknown>[];

  return {
    total,
    entries: rows.map((r) => ({
      id: r.id as string,
      action: r.action as AuditAction,
      resourceType: r.resource_type as string,
      resourceId: r.resource_id as string | undefined,
      resourceName: r.resource_name as string | undefined,
      metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
      createdAt: r.created_at as number,
    })),
  };
}

export function getAuditStats() {
  const db = getDb();
  const byAction = db
    .prepare(
      `SELECT action, COUNT(*) as count FROM audit_log GROUP BY action ORDER BY count DESC`
    )
    .all() as { action: string; count: number }[];

  const recent = db
    .prepare(`SELECT COUNT(*) as n FROM audit_log WHERE created_at > ?`)
    .get(Date.now() - 86_400_000) as { n: number };

  return { byAction, last24h: recent.n };
}
