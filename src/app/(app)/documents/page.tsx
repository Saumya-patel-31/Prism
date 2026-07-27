"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Trash2, MessageSquare, Hash } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentUpload } from "@/components/documents/DocumentUpload";

interface Doc {
  id: string;
  filename: string;
  mimetype: string;
  size_bytes: number;
  chunk_count: number;
  embed_model: string;
  created_at: number;
}

function formatBytes(b: number) {
  if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${Math.round(b / 1024)} KB`;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/documents");
    const data = await res.json();
    setDocs(data.documents ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function del(id: string) {
    setDeleting(id);
    await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-foreground)]">
              Document Workspace
            </h1>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
              Upload files — chat against them with automatic source citations
            </p>
          </div>
          {docs.length > 0 && (
            <Link href="/chat">
              <Button size="sm" className="gap-2 text-xs">
                <MessageSquare className="w-3.5 h-3.5" />
                Go to Chat
              </Button>
            </Link>
          )}
        </div>

        {/* How it works */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <h2 className="text-xs font-medium text-[var(--color-foreground)] mb-2">How it works</h2>
          <ol className="space-y-1 text-xs text-[var(--color-muted-foreground)] list-decimal list-inside">
            <li>Upload a file here — it gets chunked and embedded locally via Ollama</li>
            <li>Open Chat, click the <strong className="text-[var(--color-foreground)]">paperclip</strong> icon and select your documents</li>
            <li>Ask questions — the model cites which source chunks it used</li>
          </ol>
        </div>

        {/* Upload */}
        <DocumentUpload onSuccess={load} />

        {/* Document list */}
        {docs.length > 0 && (
          <div>
            <h2 className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider mb-2">
              Uploaded Documents ({docs.length})
            </h2>
            <div className="space-y-2">
              {docs.map((doc) => (
                <Card key={doc.id} className="bg-[var(--color-card)] border-[var(--color-border)]">
                  <CardContent className="flex items-center gap-3 p-3">
                    <FileText className="w-8 h-8 shrink-0 text-[var(--color-primary)] opacity-80" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[var(--color-foreground)] truncate">
                          {doc.filename}
                        </span>
                        <Badge variant="secondary" className="text-[10px] h-4 shrink-0">
                          {formatBytes(doc.size_bytes)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)]">
                          <Hash className="w-3 h-3" />
                          {doc.chunk_count} chunks
                        </span>
                        {doc.embed_model && (
                          <span className="text-[10px] text-[var(--color-muted-foreground)]">
                            via {doc.embed_model.split(":")[0]}
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--color-muted-foreground)]">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => del(doc.id)}
                      disabled={deleting === doc.id}
                      className="w-7 h-7 shrink-0 text-[var(--color-muted-foreground)] hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {docs.length === 0 && (
          <p className="text-center text-xs text-[var(--color-muted-foreground)] py-4">
            No documents yet — upload one above to get started.
          </p>
        )}
      </div>
    </div>
  );
}
