"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadState {
  status: "idle" | "uploading" | "done" | "error";
  progress: number;
  total: number;
  error?: string;
  filename?: string;
}

interface Props {
  onSuccess: () => void;
}

export function DocumentUpload({ onSuccess }: Props) {
  const [state, setState] = useState<UploadState>({ status: "idle", progress: 0, total: 0 });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setState({ status: "uploading", progress: 0, total: 0, filename: file.name });
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        setState({ status: "error", progress: 0, total: 0, error: err.error });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const chunk = JSON.parse(line.slice(6));
          if (chunk.type === "start") {
            setState((s) => ({ ...s, total: chunk.chunks }));
          } else if (chunk.type === "progress") {
            setState((s) => ({ ...s, progress: chunk.done, total: chunk.total }));
          } else if (chunk.type === "done") {
            setState({ status: "done", progress: chunk.chunks, total: chunk.chunks });
            onSuccess();
          } else if (chunk.type === "error") {
            setState({ status: "error", progress: 0, total: 0, error: chunk.error });
          }
        }
      }
    } catch (err) {
      setState({ status: "error", progress: 0, total: 0, error: String(err) });
    }
  }, [onSuccess]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    },
    [upload]
  );

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  };

  const reset = () => setState({ status: "idle", progress: 0, total: 0 });

  const pct = state.total > 0 ? Math.round((state.progress / state.total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => state.status === "idle" && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          dragging
            ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
            : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50",
          state.status === "idle" && "cursor-pointer"
        )}
      >
        <input ref={inputRef} type="file" className="hidden" onChange={handleFile}
          accept=".pdf,.txt,.md,.json,.csv,.py,.js,.ts,.tsx,.jsx,.html,.css" />

        {state.status === "idle" && (
          <>
            <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--color-muted-foreground)]" />
            <p className="text-sm text-[var(--color-foreground)] font-medium">
              Drop a file or click to upload
            </p>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
              PDF, TXT, MD, JSON, CSV, code files — max 20 MB
            </p>
          </>
        )}

        {state.status === "uploading" && (
          <div className="space-y-2">
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-[var(--color-primary)]" />
            <p className="text-sm text-[var(--color-foreground)]">
              Embedding <span className="font-medium">{state.filename}</span>…
            </p>
            <div className="h-1.5 w-full bg-[var(--color-secondary)] rounded-full overflow-hidden mx-auto max-w-xs">
              <div
                className="h-full bg-[var(--color-primary)] transition-all duration-300 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {state.progress} / {state.total} chunks embedded ({pct}%)
            </p>
          </div>
        )}

        {state.status === "done" && (
          <div className="space-y-1">
            <FileText className="w-6 h-6 mx-auto text-green-400" />
            <p className="text-sm text-green-400 font-medium">
              Embedded {state.total} chunks
            </p>
            <button onClick={(e) => { e.stopPropagation(); reset(); }}
              className="text-xs text-[var(--color-muted-foreground)] underline mt-1">
              Upload another
            </button>
          </div>
        )}

        {state.status === "error" && (
          <div className="space-y-1">
            <X className="w-6 h-6 mx-auto text-red-400" />
            <p className="text-sm text-red-400">{state.error}</p>
            <button onClick={(e) => { e.stopPropagation(); reset(); }}
              className="text-xs text-[var(--color-muted-foreground)] underline mt-1">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
