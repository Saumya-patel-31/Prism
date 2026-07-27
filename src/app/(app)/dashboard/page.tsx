"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricsCards } from "@/components/dashboard/MetricsCards";
import { TpsChart } from "@/components/dashboard/TpsChart";
import type { MetricsSummary } from "@/types";

export default function DashboardPage() {
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/metrics");
      if (!res.ok) return; // expired session or server error — keep last good data
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-foreground)]">
              Telemetry Dashboard
            </h1>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
              Live performance metrics — refreshes every 10s
              {lastUpdated && (
                <>
                  {" "}· last update{" "}
                  {lastUpdated.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </>
              )}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={loading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="spectrum-line" aria-hidden="true" />

        <MetricsCards data={data} />
        <TpsChart data={data} />

        {/* Model breakdown table */}
        {data?.modelUsage && Object.keys(data.modelUsage).length > 0 && (
          <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--color-card)] border-b border-[var(--color-border)]">
              <span className="text-xs font-medium text-[var(--color-foreground)]">
                Model usage breakdown
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                  <th className="text-left px-4 py-2 font-medium text-[var(--color-muted-foreground)]">Model</th>
                  <th className="text-right px-4 py-2 font-medium text-[var(--color-muted-foreground)]">Requests</th>
                  <th className="text-right px-4 py-2 font-medium text-[var(--color-muted-foreground)]">Share</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.modelUsage)
                  .sort((a, b) => b[1] - a[1])
                  .map(([model, count]) => (
                    <tr
                      key={model}
                      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-muted)] transition-colors"
                    >
                      <td className="px-4 py-2.5 text-[var(--color-foreground)] font-mono">
                        {model}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[var(--color-foreground)]">
                        {count}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[var(--color-muted-foreground)]">
                        {Math.round((count / data.totalMessages) * 100)}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
