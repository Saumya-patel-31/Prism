"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetricsSummary } from "@/types";

interface Props {
  data: MetricsSummary | null;
}

const COLORS = [
  "#818cf8", "#34d399", "#f59e0b", "#f87171", "#a78bfa",
  "#38bdf8", "#fb923c", "#4ade80",
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TpsChart({ data }: Props) {
  if (!data || data.tpsSeries.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <EmptyCard title="Tokens/second" />
        <EmptyCard title="RAM Usage" />
        <EmptyCard title="Model Usage" />
      </div>
    );
  }

  const modelUsageEntries = Object.entries(data.modelUsage).map(
    ([model, count], i) => ({
      model: model.split(":")[0].slice(0, 18),
      count,
      fill: COLORS[i % COLORS.length],
    })
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Tok/s over time */}
      <Card className="bg-[var(--color-card)] border-[var(--color-border)]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-[var(--color-foreground)]">
            Tokens / second
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.tpsSeries}>
              <defs>
                <linearGradient id="tpsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "var(--color-foreground)",
                }}
                formatter={(v) => [`${v} tok/s`, "Speed"]}
                labelFormatter={(ts) => formatTime(ts as number)}
              />
              <Area
                type="monotone"
                dataKey="tps"
                stroke="#818cf8"
                strokeWidth={1.5}
                fill="url(#tpsGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* RAM over time */}
      <Card className="bg-[var(--color-card)] border-[var(--color-border)]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-[var(--color-foreground)]">
            RAM Usage (MB)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.ramSeries}>
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "var(--color-foreground)",
                }}
                formatter={(v) => [`${v} MB`, "RAM"]}
                labelFormatter={(ts) => formatTime(ts as number)}
              />
              <Line
                type="monotone"
                dataKey="ram"
                stroke="#34d399"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Model distribution */}
      {modelUsageEntries.length > 0 && (
        <Card className="bg-[var(--color-card)] border-[var(--color-border)] lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-[var(--color-foreground)]">
              Requests by Model
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={modelUsageEntries} layout="vertical">
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="model"
                  tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    fontSize: 11,
                    color: "var(--color-foreground)",
                  }}
                  formatter={(v) => [v, "requests"]}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {modelUsageEntries.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyCard({ title }: { title: string }) {
  return (
    <Card className="bg-[var(--color-card)] border-[var(--color-border)]">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-[var(--color-foreground)]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center h-[180px]">
        <p className="text-xs text-[var(--color-muted-foreground)]">
          No data yet — send some messages first
        </p>
      </CardContent>
    </Card>
  );
}
