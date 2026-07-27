import { NextRequest } from "next/server";
import { getMetricsSummary } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!getUserFromRequest(req)) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { agg, modelUsage, tpsSeries, ramSeries } = getMetricsSummary();

  const modelUsageMap: Record<string, number> = {};
  for (const row of modelUsage) modelUsageMap[row.model] = row.count;

  return Response.json({
    avgTps: Math.round((agg.avg_tps ?? 0) * 10) / 10,
    peakTps: Math.round((agg.peak_tps ?? 0) * 10) / 10,
    totalMessages: agg.total_messages ?? 0,
    totalTokens: agg.total_tokens ?? 0,
    avgLatencyMs: Math.round(agg.avg_latency_ms ?? 0),
    modelUsage: modelUsageMap,
    tpsSeries,
    ramSeries,
  });
}
