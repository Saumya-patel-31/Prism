export type ModelCategory = "code" | "general" | "domain" | "math";

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  details: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  modelUsed?: string;
  tokensGenerated?: number;
  tokensPerSecond?: number;
  latencyMs?: number;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  modelUsed?: string;
}

export interface MetricEntry {
  id: string;
  sessionId: string;
  messageId: string;
  model: string;
  tokensGenerated: number;
  tokensPerSecond: number;
  latencyMs: number;
  promptTokens: number;
  ramUsageMb: number;
  createdAt: number;
}

export interface ModelRouterConfig {
  codeModels: string[];
  generalModels: string[];
  mathModels: string[];
  domainModels: string[];
  defaultModel: string;
}

export interface ChatRequest {
  message: string;
  sessionId: string;
  modelOverride?: string;
  systemPrompt?: string;
  documentIds?: string[];
}

export interface MetricsSummary {
  avgTps: number;
  peakTps: number;
  totalMessages: number;
  totalTokens: number;
  avgLatencyMs: number;
  modelUsage: Record<string, number>;
  tpsSeries: { time: number; tps: number; model: string }[];
  ramSeries: { time: number; ram: number }[];
}
