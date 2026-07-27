import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), ".prism");
const DB_PATH = path.join(DB_DIR, "prism.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      model_used TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      model_used TEXT,
      tokens_generated INTEGER DEFAULT 0,
      tokens_per_second REAL DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      model TEXT NOT NULL,
      tokens_generated INTEGER NOT NULL DEFAULT 0,
      tokens_per_second REAL NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      ram_usage_mb REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      embed_model TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      embedding TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      resource_name TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace (
      id TEXT PRIMARY KEY DEFAULT 'default',
      name TEXT NOT NULL DEFAULT 'My Workspace',
      default_system_prompt TEXT NOT NULL DEFAULT '',
      default_model TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    INSERT OR IGNORE INTO workspace (id, name, default_system_prompt, default_model, created_at, updated_at)
    VALUES ('default', 'My Workspace', '', '', unixepoch() * 1000, unixepoch() * 1000);

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_metrics_created ON metrics(created_at);
    CREATE INDEX IF NOT EXISTS idx_metrics_model ON metrics(model);
    CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
  `);

  // Migration v1: multi-user support + ollama_host
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (user_version < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
        created_at INTEGER NOT NULL
      );
    `);
    for (const sql of [
      "ALTER TABLE sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE documents ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE workspace ADD COLUMN ollama_host TEXT NOT NULL DEFAULT ''",
    ]) {
      try { db.exec(sql); } catch {}
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
    `);
    db.pragma("user_version = 1");
  }

  // Migration v2: prompt library
  const { user_version: v2 } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (v2 < 2) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        variables TEXT NOT NULL DEFAULT '[]',
        is_team INTEGER NOT NULL DEFAULT 0,
        user_id TEXT NOT NULL DEFAULT '',
        use_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_prompts_user ON prompts(user_id);
      CREATE INDEX IF NOT EXISTS idx_prompts_team ON prompts(is_team);
      CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
    `);
    // Seed starter team prompts
    const now = Date.now();
    const seeds = [
      { id: "seed-1", title: "Explain this code", content: "Explain the following code step by step, including what it does and any potential issues:\n\n{{code}}", category: "coding" },
      { id: "seed-2", title: "Find bugs", content: "Review the following code for bugs, edge cases, and security issues. Be specific:\n\n{{code}}", category: "coding" },
      { id: "seed-3", title: "Write a professional email", content: "Write a professional email with a {{tone}} tone about the following topic:\n\n{{topic}}", category: "writing" },
      { id: "seed-4", title: "Summarize in bullet points", content: "Summarize the following text in {{num_bullets}} concise bullet points:\n\n{{text}}", category: "summarize" },
      { id: "seed-5", title: "Translate text", content: "Translate the following text to {{language}}. Keep the tone and meaning intact:\n\n{{text}}", category: "writing" },
      { id: "seed-6", title: "SQL query helper", content: "Write an optimized SQL query for the following requirement. Include comments explaining each part:\n\n{{requirement}}", category: "data" },
      { id: "seed-7", title: "Analyze data", content: "Analyze the following data and provide key insights, trends, and recommendations:\n\n{{data}}", category: "analysis" },
      { id: "seed-8", title: "Research summary", content: "Provide a comprehensive research summary on the following topic, including key findings and sources:\n\n{{topic}}", category: "research" },
    ];
    const ins = db.prepare(`INSERT OR IGNORE INTO prompts (id,title,content,category,variables,is_team,user_id,use_count,created_at,updated_at) VALUES (?,?,?,?,?,1,'system',0,?,?)`);
    for (const s of seeds) {
      const vars = JSON.stringify([...s.content.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i));
      ins.run(s.id, s.title, s.content, s.category, vars, now, now);
    }
    db.pragma("user_version = 2");
  }

  // Migration v3: knowledge collections
  const { user_version: v3 } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (v3 < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        user_id TEXT NOT NULL DEFAULT '',
        is_team INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS collection_documents (
        collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (collection_id, document_id)
      );
      CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);
      CREATE INDEX IF NOT EXISTS idx_collections_team ON collections(is_team);
      CREATE INDEX IF NOT EXISTS idx_col_docs_collection ON collection_documents(collection_id);
    `);
    db.pragma("user_version = 3");
  }

  // Migration v4: API keys
  const { user_version: v4 } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (v4 < 4) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        key_hash TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        last_used_at INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    `);
    db.pragma("user_version = 4");
  }

  // Migration v5: token versioning for session invalidation on password change
  const { user_version: v5 } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (v5 < 5) {
    try { db.exec("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0"); } catch {}
    db.pragma("user_version = 5");
  }
}

// Sessions
export function createSession(id: string, title: string, userId = ""): void {
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO sessions (id, title, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, title, userId, now, now);
}

export function getSessions(userId: string) {
  return getDb()
    .prepare(
      `SELECT s.*, COUNT(m.id) as message_count
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       WHERE s.user_id = ?
       GROUP BY s.id
       ORDER BY s.updated_at DESC
       LIMIT 50`
    )
    .all(userId);
}

export function getSession(id: string, userId?: string) {
  if (userId !== undefined) {
    return getDb().prepare("SELECT * FROM sessions WHERE id = ? AND user_id = ?").get(id, userId);
  }
  return getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id);
}

export function updateSessionTitle(id: string, title: string): void {
  getDb()
    .prepare("UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?")
    .run(title, Date.now(), id);
}

export function deleteSession(id: string, userId?: string): void {
  if (userId !== undefined) {
    getDb().prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?").run(id, userId);
  } else {
    getDb().prepare("DELETE FROM sessions WHERE id = ?").run(id);
  }
}

// Messages
export function addMessage(msg: {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelUsed?: string;
  tokensGenerated?: number;
  tokensPerSecond?: number;
  latencyMs?: number;
}): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO messages
        (id, session_id, role, content, model_used, tokens_generated, tokens_per_second, latency_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      msg.id,
      msg.sessionId,
      msg.role,
      msg.content,
      msg.modelUsed ?? null,
      msg.tokensGenerated ?? 0,
      msg.tokensPerSecond ?? 0,
      msg.latencyMs ?? 0,
      now
    );
  getDb()
    .prepare("UPDATE sessions SET updated_at = ? WHERE id = ?")
    .run(now, msg.sessionId);
}

export function getMessages(sessionId: string) {
  return getDb()
    .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId);
}

// Metrics
export function addMetric(m: {
  id: string;
  sessionId: string;
  messageId: string;
  model: string;
  tokensGenerated: number;
  tokensPerSecond: number;
  latencyMs: number;
  promptTokens: number;
  ramUsageMb: number;
}): void {
  getDb()
    .prepare(
      `INSERT INTO metrics
        (id, session_id, message_id, model, tokens_generated, tokens_per_second,
         latency_ms, prompt_tokens, ram_usage_mb, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      m.id,
      m.sessionId,
      m.messageId,
      m.model,
      m.tokensGenerated,
      m.tokensPerSecond,
      m.latencyMs,
      m.promptTokens,
      m.ramUsageMb,
      Date.now()
    );
}

export function getMetricsSummary() {
  const db = getDb();
  const agg = db
    .prepare(
      `SELECT
        AVG(tokens_per_second) as avg_tps,
        MAX(tokens_per_second) as peak_tps,
        COUNT(*) as total_messages,
        SUM(tokens_generated) as total_tokens,
        AVG(latency_ms) as avg_latency_ms
       FROM metrics`
    )
    .get() as Record<string, number>;

  const modelUsage = db
    .prepare(
      `SELECT model, COUNT(*) as count FROM metrics GROUP BY model ORDER BY count DESC`
    )
    .all() as { model: string; count: number }[];

  const tpsSeries = db
    .prepare(
      `SELECT created_at as time, tokens_per_second as tps, model
       FROM metrics ORDER BY created_at DESC LIMIT 100`
    )
    .all() as { time: number; tps: number; model: string }[];

  const ramSeries = db
    .prepare(
      `SELECT created_at as time, ram_usage_mb as ram
       FROM metrics ORDER BY created_at DESC LIMIT 100`
    )
    .all() as { time: number; ram: number }[];

  return { agg, modelUsage, tpsSeries: tpsSeries.reverse(), ramSeries: ramSeries.reverse() };
}

// Documents
export function createDocument(doc: {
  id: string;
  filename: string;
  mimetype: string;
  sizeBytes: number;
  embedModel: string;
  userId?: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO documents (id, filename, mimetype, size_bytes, chunk_count, embed_model, user_id, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
    )
    .run(doc.id, doc.filename, doc.mimetype, doc.sizeBytes, doc.embedModel, doc.userId ?? "", Date.now());
}

export function updateDocumentChunkCount(id: string, count: number): void {
  getDb()
    .prepare("UPDATE documents SET chunk_count = ? WHERE id = ?")
    .run(count, id);
}

export function listDocuments(userId?: string) {
  if (userId !== undefined) {
    return getDb().prepare("SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  }
  return getDb().prepare("SELECT * FROM documents ORDER BY created_at DESC").all();
}

export function deleteDocument(id: string, userId?: string): void {
  if (userId !== undefined) {
    getDb().prepare("DELETE FROM documents WHERE id = ? AND user_id = ?").run(id, userId);
  } else {
    getDb().prepare("DELETE FROM documents WHERE id = ?").run(id);
  }
}

// Chunks
export function insertChunk(chunk: {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  embedding: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO chunks (id, document_id, content, chunk_index, embedding, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(chunk.id, chunk.documentId, chunk.content, chunk.chunkIndex, chunk.embedding, Date.now());
}

export function getChunksByDocuments(documentIds: string[]) {
  if (documentIds.length === 0) return [];
  const placeholders = documentIds.map(() => "?").join(",");
  return getDb()
    .prepare(
      `SELECT c.*, d.filename
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.document_id IN (${placeholders})`
    )
    .all(...documentIds);
}

// Workspace
export interface WorkspaceRow {
  id: string;
  name: string;
  default_system_prompt: string;
  default_model: string;
  ollama_host: string;
  created_at: number;
  updated_at: number;
}

export function getWorkspace(): WorkspaceRow {
  return getDb().prepare("SELECT * FROM workspace WHERE id = 'default'").get() as WorkspaceRow;
}

export function updateWorkspace(fields: {
  name?: string;
  defaultSystemPrompt?: string;
  defaultModel?: string;
  ollamaHost?: string;
}): void {
  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [Date.now()];
  if (fields.name !== undefined) { sets.push("name = ?"); vals.push(fields.name); }
  if (fields.defaultSystemPrompt !== undefined) { sets.push("default_system_prompt = ?"); vals.push(fields.defaultSystemPrompt); }
  if (fields.defaultModel !== undefined) { sets.push("default_model = ?"); vals.push(fields.defaultModel); }
  if (fields.ollamaHost !== undefined) { sets.push("ollama_host = ?"); vals.push(fields.ollamaHost); }
  vals.push("default");
  getDb().prepare(`UPDATE workspace SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function getOllamaHost(): string {
  try {
    const ws = getWorkspace();
    if (ws?.ollama_host) return ws.ollama_host;
  } catch {}
  return process.env.OLLAMA_HOST ?? "http://localhost:11434";
}

export function getDbStats(): { sizeBytes: number; tableRows: Record<string, number> } {
  const db = getDb();
  const tables = ["sessions", "messages", "metrics", "documents", "chunks", "audit_log"];
  const tableRows: Record<string, number> = {};
  for (const t of tables) {
    tableRows[t] = (db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get() as { n: number }).n;
  }
  // SQLite page_count * page_size gives DB file size
  const { page_count } = db.prepare("PRAGMA page_count").get() as { page_count: number };
  const { page_size } = db.prepare("PRAGMA page_size").get() as { page_size: number };
  return { sizeBytes: page_count * page_size, tableRows };
}

export function clearAllData(): void {
  const db = getDb();
  db.exec(`
    DELETE FROM audit_log;
    DELETE FROM chunks;
    DELETE FROM documents;
    DELETE FROM metrics;
    DELETE FROM messages;
    DELETE FROM sessions;
  `);
}

// Prompts
export interface PromptRow {
  id: string;
  title: string;
  content: string;
  category: string;
  variables: string; // JSON array
  is_team: number;   // 0 | 1
  user_id: string;
  use_count: number;
  created_at: number;
  updated_at: number;
}

export function listPrompts(userId: string): PromptRow[] {
  return getDb()
    .prepare(`SELECT * FROM prompts WHERE user_id = ? OR is_team = 1 ORDER BY use_count DESC, created_at DESC`)
    .all(userId) as PromptRow[];
}

export function createPrompt(p: {
  id: string; title: string; content: string; category: string;
  variables: string; isTeam: boolean; userId: string;
}): void {
  const now = Date.now();
  getDb().prepare(`INSERT INTO prompts (id,title,content,category,variables,is_team,user_id,use_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,0,?,?)`)
    .run(p.id, p.title, p.content, p.category, p.variables, p.isTeam ? 1 : 0, p.userId, now, now);
}

export function updatePrompt(id: string, userId: string, fields: {
  title?: string; content?: string; category?: string; variables?: string; isTeam?: boolean;
}): void {
  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [Date.now()];
  if (fields.title !== undefined) { sets.push("title = ?"); vals.push(fields.title); }
  if (fields.content !== undefined) { sets.push("content = ?"); vals.push(fields.content); }
  if (fields.category !== undefined) { sets.push("category = ?"); vals.push(fields.category); }
  if (fields.variables !== undefined) { sets.push("variables = ?"); vals.push(fields.variables); }
  if (fields.isTeam !== undefined) { sets.push("is_team = ?"); vals.push(fields.isTeam ? 1 : 0); }
  vals.push(id, userId);
  getDb().prepare(`UPDATE prompts SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).run(...vals);
}

export function deletePrompt(id: string, userId: string): void {
  getDb().prepare("DELETE FROM prompts WHERE id = ? AND user_id = ?").run(id, userId);
}

export function incrementPromptUse(id: string): void {
  getDb().prepare("UPDATE prompts SET use_count = use_count + 1 WHERE id = ?").run(id);
}

// Users
export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: "admin" | "user";
  created_at: number;
}

export function countUsers(): number {
  return (getDb().prepare("SELECT COUNT(*) as n FROM users").get() as { n: number }).n;
}

export function createUser(user: {
  id: string;
  username: string;
  passwordHash: string;
  role: "admin" | "user";
}): void {
  getDb()
    .prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(user.id, user.username, user.passwordHash, user.role, Date.now());
}

export function getUserByUsername(username: string): UserRow | null {
  return (getDb().prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow) ?? null;
}

export function getUserById(id: string): Omit<UserRow, "password_hash"> | null {
  return (getDb().prepare("SELECT id, username, role, created_at FROM users WHERE id = ?").get(id) as Omit<UserRow, "password_hash">) ?? null;
}

export function listUsers(): Omit<UserRow, "password_hash">[] {
  return getDb().prepare("SELECT id, username, role, created_at FROM users ORDER BY created_at ASC").all() as Omit<UserRow, "password_hash">[];
}

export function deleteUser(id: string): void {
  getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function updateUserPassword(id: string, passwordHash: string): void {
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

export function getUserTokenVersion(id: string): number | null {
  const row = getDb()
    .prepare("SELECT token_version FROM users WHERE id = ?")
    .get(id) as { token_version: number } | undefined;
  return row?.token_version ?? null;
}

export function incrementTokenVersion(id: string): number {
  getDb().prepare("UPDATE users SET token_version = token_version + 1 WHERE id = ?").run(id);
  const row = getDb()
    .prepare("SELECT token_version FROM users WHERE id = ?")
    .get(id) as { token_version: number };
  return row.token_version;
}

// Collections
export interface CollectionRow {
  id: string;
  name: string;
  description: string;
  user_id: string;
  is_team: number;
  created_at: number;
  updated_at: number;
  doc_count?: number;
}

export interface CollectionDocRow {
  id: string;
  filename: string;
  mimetype: string;
  size_bytes: number;
  chunk_count: number;
  created_at: number;
  user_id: string;
}

export function listCollections(userId: string): CollectionRow[] {
  return getDb()
    .prepare(`
      SELECT c.*, COUNT(cd.document_id) as doc_count
      FROM collections c
      LEFT JOIN collection_documents cd ON cd.collection_id = c.id
      WHERE c.user_id = ? OR c.is_team = 1
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `)
    .all(userId) as CollectionRow[];
}

export function getCollection(id: string): CollectionRow | null {
  return (getDb().prepare("SELECT * FROM collections WHERE id = ?").get(id) as CollectionRow) ?? null;
}

export function createCollection(c: {
  id: string; name: string; description: string; userId: string; isTeam: boolean;
}): void {
  const now = Date.now();
  getDb()
    .prepare("INSERT INTO collections (id, name, description, user_id, is_team, created_at, updated_at) VALUES (?,?,?,?,?,?,?)")
    .run(c.id, c.name, c.description, c.userId, c.isTeam ? 1 : 0, now, now);
}

export function updateCollection(id: string, userId: string, fields: {
  name?: string; description?: string; isTeam?: boolean;
}): void {
  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [Date.now()];
  if (fields.name !== undefined) { sets.push("name = ?"); vals.push(fields.name); }
  if (fields.description !== undefined) { sets.push("description = ?"); vals.push(fields.description); }
  if (fields.isTeam !== undefined) { sets.push("is_team = ?"); vals.push(fields.isTeam ? 1 : 0); }
  vals.push(id, userId);
  getDb().prepare(`UPDATE collections SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).run(...vals);
}

export function deleteCollection(id: string, userId: string): void {
  getDb().prepare("DELETE FROM collections WHERE id = ? AND user_id = ?").run(id, userId);
}

export function getCollectionDocs(collectionId: string): CollectionDocRow[] {
  return getDb()
    .prepare(`
      SELECT d.id, d.filename, d.mimetype, d.size_bytes, d.chunk_count, d.created_at, d.user_id
      FROM documents d
      JOIN collection_documents cd ON cd.document_id = d.id
      WHERE cd.collection_id = ?
      ORDER BY cd.added_at DESC
    `)
    .all(collectionId) as CollectionDocRow[];
}

export function addDocToCollection(collectionId: string, documentId: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO collection_documents (collection_id, document_id, added_at) VALUES (?,?,?)")
    .run(collectionId, documentId, Date.now());
  getDb().prepare("UPDATE collections SET updated_at = ? WHERE id = ?").run(Date.now(), collectionId);
}

export function removeDocFromCollection(collectionId: string, documentId: string): void {
  getDb()
    .prepare("DELETE FROM collection_documents WHERE collection_id = ? AND document_id = ?")
    .run(collectionId, documentId);
  getDb().prepare("UPDATE collections SET updated_at = ? WHERE id = ?").run(Date.now(), collectionId);
}

// API Keys
export interface ApiKeyRow {
  id: string;
  key_hash: string;
  name: string;
  user_id: string;
  last_used_at: number | null;
  created_at: number;
}

export function listApiKeys(userId: string): Omit<ApiKeyRow, "key_hash">[] {
  return getDb()
    .prepare("SELECT id, name, user_id, last_used_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as Omit<ApiKeyRow, "key_hash">[];
}

export function createApiKey(key: { id: string; keyHash: string; name: string; userId: string }): void {
  getDb()
    .prepare("INSERT INTO api_keys (id, key_hash, name, user_id, created_at) VALUES (?,?,?,?,?)")
    .run(key.id, key.keyHash, key.name, key.userId, Date.now());
}

export function revokeApiKey(id: string, userId: string): void {
  getDb().prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?").run(id, userId);
}

export function getApiKeyByHash(keyHash: string): ApiKeyRow | null {
  return (getDb().prepare("SELECT * FROM api_keys WHERE key_hash = ?").get(keyHash) as ApiKeyRow) ?? null;
}

export function touchApiKey(id: string): void {
  getDb().prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(Date.now(), id);
}
