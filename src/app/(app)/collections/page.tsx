"use client";

import { useEffect, useState } from "react";
import {
  Layers, Plus, Pencil, Trash2, FileText, Users, User,
  X, Check, FolderPlus, Search,
} from "lucide-react";

interface Collection {
  id: string;
  name: string;
  description: string;
  user_id: string;
  is_team: number;
  doc_count: number;
  created_at: number;
  updated_at: number;
}

interface Doc {
  id: string;
  filename: string;
  mimetype: string;
  size_bytes: number;
  chunk_count: number;
  user_id: string;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ── Create/Edit modal ────────────────────────────────────────────────────────
function CollectionForm({
  isAdmin,
  initial,
  onSave,
  onClose,
}: {
  isAdmin: boolean;
  initial?: { id?: string; name?: string; description?: string; isTeam?: boolean };
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isTeam, setIsTeam] = useState(initial?.isTeam ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!initial?.id;

  async function save() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    const r = await fetch("/api/collections", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit
        ? { id: initial!.id, name, description, isTeam }
        : { name, description, isTeam }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { setError(d.error ?? "Failed"); return; }
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
            {isEdit ? "Edit collection" : "New collection"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-secondary)] text-[var(--color-muted-foreground)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 Research, Backend Docs"
              className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1">Description <span className="font-normal opacity-60">(optional)</span></label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What documents does this collection contain?"
              className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>
          {isAdmin && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                onClick={() => setIsTeam((p) => !p)}
                className={`w-8 h-4 rounded-full transition-colors relative ${isTeam ? "bg-[var(--color-primary)]" : "bg-[var(--color-secondary)]"}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isTeam ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm text-[var(--color-foreground)]">Shared with team</span>
            </label>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-secondary)]">Cancel</button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Document management panel ────────────────────────────────────────────────
function DocPanel({
  collection,
  isAdmin,
  currentUserId,
  onClose,
}: {
  collection: Collection;
  isAdmin: boolean;
  currentUserId: string;
  onClose: () => void;
}) {
  const [colDocs, setColDocs] = useState<Doc[]>([]);
  const [allDocs, setAllDocs] = useState<Doc[]>([]);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const canEdit = isAdmin || collection.user_id === currentUserId;

  async function load() {
    const [cd, ad] = await Promise.all([
      fetch(`/api/collections?id=${collection.id}`).then((r) => r.json()),
      fetch("/api/documents").then((r) => r.json()),
    ]);
    setColDocs(cd.docs ?? []);
    setAllDocs(ad.documents ?? []);
  }

  useEffect(() => { load(); }, []);

  const colDocIds = new Set(colDocs.map((d) => d.id));
  const available = allDocs.filter(
    (d) => !colDocIds.has(d.id) &&
      (!search || d.filename.toLowerCase().includes(search.toLowerCase()))
  );

  async function addDoc(docId: string) {
    setAdding(docId);
    await fetch(`/api/collections/${collection.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: docId }),
    });
    setAdding(null);
    load();
  }

  async function removeDoc(docId: string) {
    setRemoving(docId);
    await fetch(`/api/collections/${collection.id}/documents?documentId=${docId}`, { method: "DELETE" });
    setRemoving(null);
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-sm font-semibold text-[var(--color-foreground)]">{collection.name}</span>
            <span className="text-xs text-[var(--color-muted-foreground)]">· {colDocs.length} doc{colDocs.length !== 1 ? "s" : ""}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-secondary)] text-[var(--color-muted-foreground)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Docs in collection */}
          <div className="flex-1 border-r border-[var(--color-border)] flex flex-col min-h-0">
            <p className="px-4 py-2.5 text-xs font-medium text-[var(--color-muted-foreground)] bg-[var(--color-secondary)] shrink-0">
              In this collection
            </p>
            <div className="overflow-y-auto flex-1">
              {colDocs.length === 0 ? (
                <p className="text-xs text-[var(--color-muted-foreground)] text-center py-8">No documents yet</p>
              ) : (
                colDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-secondary)]/50">
                    <FileText className="w-3.5 h-3.5 text-[var(--color-muted-foreground)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--color-foreground)] truncate">{doc.filename}</p>
                      <p className="text-[10px] text-[var(--color-muted-foreground)]">
                        {fmtSize(doc.size_bytes)} · {doc.chunk_count} chunks
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => removeDoc(doc.id)}
                        disabled={removing === doc.id}
                        className="p-1 rounded text-[var(--color-muted-foreground)] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors shrink-0"
                        title="Remove from collection"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Available docs to add */}
          {canEdit && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-2.5 bg-[var(--color-secondary)] border-b border-[var(--color-border)] shrink-0">
                <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Add documents</p>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">
                  <Search className="w-3 h-3 text-[var(--color-muted-foreground)]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter…"
                    className="flex-1 text-xs bg-transparent text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] outline-none"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {available.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted-foreground)] text-center py-8">
                    {allDocs.length === 0 ? "No documents uploaded yet" : "All documents already in collection"}
                  </p>
                ) : (
                  available.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-secondary)]/50">
                      <FileText className="w-3.5 h-3.5 text-[var(--color-muted-foreground)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--color-foreground)] truncate">{doc.filename}</p>
                        <p className="text-[10px] text-[var(--color-muted-foreground)]">{fmtSize(doc.size_bytes)}</p>
                      </div>
                      <button
                        onClick={() => addDoc(doc.id)}
                        disabled={adding === doc.id}
                        className="p-1 rounded text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:opacity-50 transition-colors shrink-0"
                        title="Add to collection"
                      >
                        {adding === doc.id ? <span className="text-[10px]">…</span> : <Check className="w-3 h-3" />}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [docPanel, setDocPanel] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    const [cr, me] = await Promise.all([
      fetch("/api/collections").then((r) => r.json()),
      fetch("/api/auth?me=1").then((r) => r.json()),
    ]);
    setCollections(cr.collections ?? []);
    if (me.user) {
      setIsAdmin(me.user.role === "admin");
      setCurrentUserId(me.user.id);
    }
  }

  useEffect(() => { load(); }, []);

  async function del(id: string) {
    setDeleting(id);
    await fetch(`/api/collections?id=${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  const canEdit = (c: Collection) => isAdmin || c.user_id === currentUserId;
  const teamCount = collections.filter((c) => c.is_team).length;
  const totalDocs = collections.reduce((sum, c) => sum + (c.doc_count ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Layers className="w-5 h-5 text-[var(--color-primary)]" />
            <h1 className="text-xl font-semibold text-[var(--color-foreground)]">Knowledge Collections</h1>
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Group documents into project folders. Select a collection in chat to load all its docs into context at once.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="w-4 h-4" />
          New collection
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Collections", value: collections.length, icon: Layers },
          { label: "Team collections", value: teamCount, icon: Users },
          { label: "Total documents", value: totalDocs, icon: FileText },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-3.5 h-3.5 text-[var(--color-muted-foreground)]" />
              <span className="text-xs text-[var(--color-muted-foreground)]">{label}</span>
            </div>
            <span className="text-2xl font-bold text-[var(--color-foreground)]">{value}</span>
          </div>
        ))}
      </div>

      {/* Collection grid */}
      {collections.length === 0 ? (
        <div className="text-center py-20 text-[var(--color-muted-foreground)]">
          <FolderPlus className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium mb-1">No collections yet</p>
          <p className="text-xs max-w-xs mx-auto mb-4">
            Create a collection to group related documents — then pick it in chat to give the model full project context.
          </p>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            Create your first collection →
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {collections.map((col) => (
            <div
              key={col.id}
              className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-primary)]/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[var(--color-primary)]/10 shrink-0">
                  <Layers className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{col.name}</h3>
                    {col.is_team ? (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20">
                        <Users className="w-2.5 h-2.5" /> team
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border text-[var(--color-muted-foreground)] border-[var(--color-border)]">
                        <User className="w-2.5 h-2.5" /> personal
                      </span>
                    )}
                  </div>
                  {col.description && (
                    <p className="text-xs text-[var(--color-muted-foreground)] mb-2">{col.description}</p>
                  )}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setDocPanel(col)}
                      className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      {col.doc_count ?? 0} document{(col.doc_count ?? 0) !== 1 ? "s" : ""}
                      <span className="text-[var(--color-primary)] ml-1">Manage →</span>
                    </button>
                  </div>
                </div>

                {canEdit(col) && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditing(col); setShowForm(true); }}
                      className="p-1.5 rounded-md text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-secondary)] transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => del(col.id)}
                      disabled={deleting === col.id}
                      className="p-1.5 rounded-md text-[var(--color-muted-foreground)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <CollectionForm
          isAdmin={isAdmin}
          initial={editing ? { id: editing.id, name: editing.name, description: editing.description, isTeam: !!editing.is_team } : {}}
          onSave={() => { setShowForm(false); setEditing(null); load(); }}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
      {docPanel && (
        <DocPanel
          collection={docPanel}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onClose={() => setDocPanel(null)}
        />
      )}
    </div>
  );
}
