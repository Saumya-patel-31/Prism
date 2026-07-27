"use client";

import { useState } from "react";
import { X, Info } from "lucide-react";
import { isDemoMode } from "@/lib/demo/mockApi";

/* The fetch patch itself is installed by DemoInit from the root layout — it has
   to happen before any page component mounts. This component only renders the
   notice. */

export function DemoBoot() {
  const [dismissed, setDismissed] = useState(false);

  if (!isDemoMode() || dismissed) return null;

  return (
    <div className="shrink-0 flex items-start gap-2.5 px-4 py-2 border-b border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 text-xs">
      <Info className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 mt-px" />
      <p className="text-[var(--color-foreground)] leading-relaxed">
        <span className="font-medium">Interactive demo.</span>{" "}
        <span className="text-[var(--color-muted-foreground)]">
          Responses are recorded, not generated — there is no model running here.
          Everything else is the real interface. Ask about the rate limit, deploys,
          or the November incident to see retrieval with citations.
        </span>
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss demo notice"
        className="ml-auto shrink-0 p-1 -m-1 rounded text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
