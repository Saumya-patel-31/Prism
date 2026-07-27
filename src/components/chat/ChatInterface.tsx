"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, StopCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageBubble } from "./MessageBubble";
import { SessionSidebar } from "./SessionSidebar";
import { DocumentPicker } from "./DocumentPicker";
import { Citations } from "./Citations";
import { PromptPicker } from "./PromptPicker";
import { CollectionPicker } from "./CollectionPicker";
import type { Message } from "@/types";
import type { CitationChunk } from "./Citations";

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface MessageWithCitations extends Message {
  citations?: CitationChunk[];
}

export function ChatInterface() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithCitations[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [routingMeta, setRoutingMeta] = useState<{
    model: string;
    category: string;
    reason: string;
    ragChunks?: CitationChunk[];
  } | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [modelOverride, setModelOverride] = useState<string>("");
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const justCreatedRef = useRef(false);

  // Deep links (/chat?session=…) and jumps from global search. Read from the
  // history API rather than useSearchParams so this tree never suspends.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("session");
    if (fromUrl) setSessionId(fromUrl);

    const onOpenSession = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) setSessionId(id);
    };
    window.addEventListener("prism:open-session", onOpenSession);
    return () => window.removeEventListener("prism:open-session", onOpenSession);
  }, []);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        setOllamaOk(d.healthy);
        setModels((d.models ?? []).map((m: { name: string }) => m.name));
      })
      .catch(() => setOllamaOk(false));
  }, []);

  useEffect(() => {
    if (!sessionId) { setMessages([]); return; }
    if (justCreatedRef.current) {
      justCreatedRef.current = false;
      return;
    }
    fetch(`/api/sessions?id=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        setMessages(
          (d.messages ?? []).map((m: Record<string, unknown>) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.created_at,
            modelUsed: m.model_used,
            tokensGenerated: m.tokens_generated,
            tokensPerSecond: m.tokens_per_second,
            latencyMs: m.latency_ms,
          }))
        );
      });
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createNewSession = useCallback(async () => {
    setSessionId(null);
    setMessages([]);
    setRoutingMeta(null);
    textareaRef.current?.focus();
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    let sid = sessionId;
    if (!sid) {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: text.slice(0, 60) }),
      });
      const data = await res.json();
      sid = data.id;
      justCreatedRef.current = true;
      setSessionId(sid);
    }

    setInput("");
    setIsStreaming(true);
    setRoutingMeta(null);

    const userMsg: MessageWithCitations = {
      id: generateId(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const asstId = generateId();
    setMessages((prev) => [...prev, {
      id: asstId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    }]);
    setStreamingId(asstId);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let pendingCitations: CitationChunk[] = [];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: sid,
          modelOverride: modelOverride || undefined,
          documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
        }),
        signal: ctrl.signal,
      });

      const reader = res.body!.getReader();
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

          if (chunk.type === "meta") {
            pendingCitations = chunk.ragChunks ?? [];
            setRoutingMeta({
              model: chunk.model,
              category: chunk.category,
              reason: chunk.reason,
              ragChunks: chunk.ragChunks,
            });
          } else if (chunk.type === "token") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId ? { ...m, content: m.content + chunk.content } : m
              )
            );
          } else if (chunk.type === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId
                  ? {
                      ...m,
                      id: chunk.messageId,
                      modelUsed: routingMeta?.model ?? "",
                      tokensGenerated: chunk.metrics?.tokensGenerated,
                      tokensPerSecond: chunk.metrics?.tokensPerSecond,
                      latencyMs: chunk.metrics?.latencyMs,
                      citations: pendingCitations.length > 0 ? pendingCitations : undefined,
                    }
                  : m
              )
            );
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstId ? { ...m, content: `Error: ${err.message}` } : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      setStreamingId(null);
      abortRef.current = null;
    }
  }, [input, isStreaming, sessionId, modelOverride, selectedDocIds, routingMeta?.model]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-full">
      <SessionSidebar
        activeId={sessionId}
        onSelect={(id) => setSessionId(id)}
        onNew={createNewSession}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Ollama status banner */}
        {ollamaOk === false && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs">
            Ollama is not running. Start it with{" "}
            <code className="font-mono">ollama serve</code>, then refresh.
          </div>
        )}

        {/* Routing + RAG meta bar */}
        {routingMeta && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-card)] flex-wrap">
            <Badge variant="outline" className="text-[10px] h-4">{routingMeta.category}</Badge>
            <span className="text-[10px] text-[var(--color-muted-foreground)]">
              routed to{" "}
              <span className="text-[var(--color-foreground)] font-medium">{routingMeta.model}</span>
              {" "}({routingMeta.reason})
            </span>
            {routingMeta.ragChunks && routingMeta.ragChunks.length > 0 && (
              <Badge variant="outline" className="text-[10px] h-4 border-[var(--color-primary)] text-[var(--color-primary)]">
                RAG: {routingMeta.ragChunks.length} chunks
              </Badge>
            )}
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-8">
              <div className="text-3xl mb-3 opacity-20">◈</div>
              <h2 className="text-lg font-semibold mb-1">Start a conversation</h2>
              <p className="text-sm text-[var(--color-muted-foreground)] max-w-sm">
                Your messages are processed locally. Nothing leaves your machine.
              </p>
              {models.length === 0 && ollamaOk && (
                <p className="text-xs text-[var(--color-muted-foreground)] mt-4 border border-dashed border-[var(--color-border)] rounded-lg px-4 py-2">
                  No models installed — go to{" "}
                  <a href="/models" className="underline text-[var(--color-primary)]">Models</a>{" "}
                  to pull one.
                </p>
              )}
            </div>
          ) : (
            <div className="py-4 space-y-1">
              {messages.map((m) => (
                <div key={m.id}>
                  <MessageBubble
                    message={m}
                    isStreaming={isStreaming && m.id === streamingId}
                  />
                  {m.citations && m.citations.length > 0 && (
                    <div className="px-4 pb-2">
                      <Citations chunks={m.citations} />
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {/* Model selector */}
            <div className="relative">
              <select
                value={modelOverride}
                onChange={(e) => setModelOverride(e.target.value)}
                className="text-xs bg-[var(--color-secondary)] border border-[var(--color-border)] rounded-md px-2.5 py-1 pr-6 appearance-none cursor-pointer text-[var(--color-foreground)] outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                <option value="">Auto (recommended)</option>
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-muted-foreground)] pointer-events-none" />
            </div>

            {/* Collection picker */}
            <CollectionPicker
              onCollectionChange={(docIds, name) => {
                setSelectedDocIds(docIds);
                setActiveCollection(name);
              }}
            />

            {/* Document picker — hidden when collection active */}
            {!activeCollection && (
              <DocumentPicker selectedIds={selectedDocIds} onChange={setSelectedDocIds} />
            )}

            {/* Prompt picker */}
            <PromptPicker onInsert={(text) => setInput((prev) => (prev ? prev + "\n" + text : text))} />

            <span className="text-[10px] text-[var(--color-muted-foreground)] ml-auto">
              Auto routes by task type
            </span>
          </div>

          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeCollection
                  ? `Ask about "${activeCollection}"…`
                  : selectedDocIds.length > 0
                  ? `Ask about your ${selectedDocIds.length} document${selectedDocIds.length > 1 ? "s" : ""}…`
                  : "Message… (Shift+Enter for new line)"
              }
              className="flex-1 min-h-[44px] max-h-[160px] resize-none bg-[var(--color-input)] border-[var(--color-border)] text-sm"
              rows={1}
              disabled={!ollamaOk}
            />
            {isStreaming ? (
              <Button size="icon" variant="outline" onClick={() => abortRef.current?.abort()} className="shrink-0">
                <StopCircle className="w-4 h-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={send} disabled={!input.trim() || !ollamaOk} className="shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
