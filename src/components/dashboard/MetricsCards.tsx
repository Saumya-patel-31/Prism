"use client";

import { Zap, Clock, Hash, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MetricsSummary } from "@/types";

interface Props {
  data: MetricsSummary | null;
}

export function MetricsCards({ data }: Props) {
  const cards = [
    {
      label: "Avg speed",
      value: data ? `${data.avgTps}` : "—",
      unit: "tok/s",
      sub: data ? `peak ${data.peakTps} tok/s` : "no data yet",
      icon: Zap,
    },
    {
      label: "Avg latency",
      value: data ? `${data.avgLatencyMs}` : "—",
      unit: "ms",
      sub: "first token time",
      icon: Clock,
    },
    {
      label: "Total tokens",
      value: data ? data.totalTokens.toLocaleString() : "—",
      unit: "",
      sub: `${data?.totalMessages ?? 0} messages`,
      icon: Hash,
    },
    {
      label: "Top model",
      value: data
        ? Object.entries(data.modelUsage).sort((a, b) => b[1] - a[1])[0]?.[0]?.split(":")[0] ?? "—"
        : "—",
      unit: "",
      sub: "most used",
      icon: Activity,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, unit, sub, icon: Icon }) => (
        <Card key={label} className="bg-[var(--color-card)] border-[var(--color-border)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-3.5 h-3.5 text-[var(--color-muted-foreground)]" />
              <span className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                {label}
              </span>
            </div>
            <div className="text-xl font-semibold font-mono tabular-nums tracking-tight text-[var(--color-foreground)] truncate">
              {value}
              {unit && (
                <span className="text-xs font-sans text-[var(--color-muted-foreground)] ml-1">{unit}</span>
              )}
            </div>
            <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
