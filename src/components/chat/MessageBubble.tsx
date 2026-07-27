"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Message } from "@/types";

interface Props {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold",
          isUser
            ? "bg-[var(--color-primary)] text-white"
            : "bg-[var(--color-secondary)] text-[var(--color-foreground)]"
        )}
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Bubble */}
      <div className={cn("flex flex-col gap-1.5 max-w-[75%]", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-[var(--color-primary)] text-white rounded-tr-sm"
              : "bg-[var(--color-card)] text-[var(--color-foreground)] rounded-tl-sm border border-[var(--color-border)]"
          )}
        >
          <div
            className="message-content whitespace-pre-wrap"
            dangerouslySetInnerHTML={{
              __html: formatContent(message.content),
            }}
          />
          {isStreaming && <span className="stream-cursor" />}
        </div>

        {/* Metrics */}
        {!isUser && message.tokensPerSecond !== undefined && message.tokensPerSecond > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {message.modelUsed && (
              <Badge variant="secondary" className="text-[10px] py-0 h-4">
                {message.modelUsed.split(":")[0]}
              </Badge>
            )}
            <span className="text-[10px] text-[var(--color-muted-foreground)]">
              {message.tokensPerSecond} tok/s
            </span>
            {message.latencyMs !== undefined && (
              <span className="text-[10px] text-[var(--color-muted-foreground)]">
                {message.latencyMs}ms
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatContent(content: string): string {
  // Escape HTML first
  let html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks
  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_m, lang, code) =>
      `<pre><code class="language-${lang}">${code.trim()}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return html;
}
