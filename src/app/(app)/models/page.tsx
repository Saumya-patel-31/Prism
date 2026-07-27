"use client";

import { useEffect, useState } from "react";
import { Download, Trash2, CheckCircle, Circle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { OllamaModel } from "@/types";

interface ModelSuggestion {
  name: string;
  desc: string;
  category: string;
  size: string;
  note?: string;
}

const SUGGESTED_SECTIONS: { label: string; models: ModelSuggestion[] }[] = [
  {
    label: "⚡ Fast — CPU-friendly (under 2 GB)",
    models: [
      { name: "llama3.2:1b", desc: "Meta Llama 3.2 — ultra-fast, great for quick Q&A", category: "fast", size: "1B" },
      { name: "qwen2.5:0.5b", desc: "Alibaba Qwen 2.5 — smallest usable model", category: "fast", size: "0.5B" },
      { name: "qwen2.5:1.5b", desc: "Alibaba Qwen 2.5 — fast with decent quality", category: "fast", size: "1.5B" },
      { name: "smollm2:1.7b", desc: "HuggingFace SmolLM2 — tiny & surprisingly capable", category: "fast", size: "1.7B" },
      { name: "gemma2:2b", desc: "Google Gemma 2 — punches above its weight", category: "fast", size: "2B" },
      { name: "phi3.5", desc: "Microsoft Phi-3.5 Mini — compact 3.8B, very efficient", category: "fast", size: "3.8B" },
      { name: "llama3.2:3b", desc: "Meta Llama 3.2 — best quality in the fast tier", category: "fast", size: "3B" },
      { name: "starcoder2:3b", desc: "BigCode StarCoder2 — fast code completion", category: "fast", size: "3B" },
    ],
  },
  {
    label: "General Purpose",
    models: [
      { name: "llama3.1:8b", desc: "Meta Llama 3.1 — solid all-rounder", category: "general", size: "8B" },
      { name: "mistral:7b", desc: "Mistral AI — efficient 7B, strong instruction following", category: "general", size: "7B" },
      { name: "mistral-nemo", desc: "Mistral Nemo 12B — long context (128K), multilingual", category: "general", size: "12B" },
      { name: "gemma2:9b", desc: "Google Gemma 2 — excellent reasoning", category: "general", size: "9B" },
      { name: "qwen2.5:7b", desc: "Alibaba Qwen 2.5 — top-tier 7B", category: "general", size: "7B" },
      { name: "qwen2.5:14b", desc: "Alibaba Qwen 2.5 — near-GPT-4 quality", category: "general", size: "14B" },
      { name: "llama3.3:70b", desc: "Meta Llama 3.3 — best open model, needs GPU", category: "general", size: "70B", note: "GPU recommended" },
      { name: "command-r", desc: "Cohere Command-R — optimized for RAG & tool use", category: "general", size: "35B", note: "GPU recommended" },
    ],
  },
  {
    label: "Code",
    models: [
      { name: "qwen2.5-coder:7b", desc: "Alibaba — top coding model at 7B", category: "code", size: "7B" },
      { name: "qwen2.5-coder:14b", desc: "Alibaba — outstanding code generation", category: "code", size: "14B" },
      { name: "qwen2.5-coder:1.5b", desc: "Alibaba — fast code completion", category: "code", size: "1.5B" },
      { name: "codellama:7b", desc: "Meta CodeLlama — fill-in-the-middle, Python focus", category: "code", size: "7B" },
      { name: "codellama:13b", desc: "Meta CodeLlama 13B — stronger than 7B for code", category: "code", size: "13B" },
      { name: "deepseek-coder-v2:16b", desc: "DeepSeek — competitive with GPT-4 on coding", category: "code", size: "16B" },
      { name: "starcoder2:7b", desc: "BigCode — wide language support, 600+ languages", category: "code", size: "7B" },
      { name: "codegemma:7b", desc: "Google CodeGemma — infill & instruction code tasks", category: "code", size: "7B" },
    ],
  },
  {
    label: "Reasoning & Math",
    models: [
      { name: "deepseek-r1:1.5b", desc: "DeepSeek R1 — fast reasoning model", category: "math", size: "1.5B" },
      { name: "deepseek-r1:7b", desc: "DeepSeek R1 — strong math & logic", category: "math", size: "7B" },
      { name: "deepseek-r1:14b", desc: "DeepSeek R1 — near o1 reasoning quality", category: "math", size: "14B" },
      { name: "qwq:32b", desc: "Alibaba QwQ — chain-of-thought reasoning", category: "math", size: "32B", note: "GPU recommended" },
      { name: "phi4", desc: "Microsoft Phi-4 — exceptional STEM & reasoning", category: "math", size: "14B" },
      { name: "nemotron-mini", desc: "NVIDIA Nemotron Mini — math & science focus", category: "math", size: "4B" },
    ],
  },
  {
    label: "Embeddings (for RAG)",
    models: [
      { name: "nomic-embed-text", desc: "Best general-purpose embedding model — recommended", category: "embed", size: "137M" },
      { name: "mxbai-embed-large", desc: "MixedBread — state-of-the-art embeddings", category: "embed", size: "335M" },
      { name: "all-minilm", desc: "Lightweight sentence embeddings", category: "embed", size: "23M" },
      { name: "snowflake-arctic-embed2", desc: "Snowflake — enterprise-grade retrieval", category: "embed", size: "568M" },
    ],
  },
];

const CATEGORY_COLOR: Record<string, string> = {
  fast: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  general: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  code: "bg-green-500/10 text-green-400 border-green-500/20",
  math: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  embed: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

function formatSize(bytes: number) {
  const gb = bytes / 1e9;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`;
}

export default function ModelsPage() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [customModel, setCustomModel] = useState("");
  const [pulling, setPulling] = useState<Record<string, { status: string; percent: number }>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadModels() {
    const res = await fetch("/api/models");
    const data = await res.json();
    setHealthy(data.healthy);
    setModels(data.models ?? []);
  }

  useEffect(() => {
    loadModels();
  }, []);

  async function pullModel(name: string) {
    setPulling((p) => ({ ...p, [name]: { status: "Starting…", percent: 0 } }));
    const res = await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pull", model: name }),
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
        if (chunk.status === "done") {
          setPulling((p) => {
            const n = { ...p };
            delete n[name];
            return n;
          });
          loadModels();
        } else {
          setPulling((p) => ({
            ...p,
            [name]: { status: chunk.status ?? "Pulling…", percent: chunk.percent ?? 0 },
          }));
        }
      }
    }
  }

  async function deleteModel(name: string) {
    setDeleting(name);
    await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", model: name }),
    });
    setDeleting(null);
    loadModels();
  }

  const installedNames = new Set(models.map((m) => m.name));

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-foreground)]">Model Fleet</h1>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
            Manage your local Ollama models
          </p>
        </div>

        {/* Ollama status */}
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border ${
            healthy
              ? "bg-green-500/5 border-green-500/20 text-green-400"
              : "bg-red-500/5 border-red-500/20 text-red-400"
          }`}
        >
          {healthy === null ? (
            <Circle className="w-3.5 h-3.5 animate-pulse" />
          ) : healthy ? (
            <CheckCircle className="w-3.5 h-3.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5" />
          )}
          {healthy === null
            ? "Checking Ollama…"
            : healthy
              ? `Ollama running — ${models.length} model${models.length !== 1 ? "s" : ""} installed`
              : "Ollama not running. Run: ollama serve"}
        </div>

        {/* Pull custom model */}
        <div className="flex gap-2">
          <Input
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder="Custom model name (e.g. llama3.1:70b)"
            className="bg-[var(--color-input)] border-[var(--color-border)] text-sm"
            onKeyDown={(e) =>
              e.key === "Enter" && customModel.trim() && pullModel(customModel.trim())
            }
          />
          <Button
            onClick={() => {
              if (customModel.trim()) {
                pullModel(customModel.trim());
                setCustomModel("");
              }
            }}
            disabled={!customModel.trim() || !healthy}
            className="shrink-0 gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Pull
          </Button>
        </div>

        {/* Installed models */}
        {models.length > 0 && (
          <div>
            <h2 className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider mb-2">
              Installed
            </h2>
            <div className="space-y-2">
              {models.map((m) => (
                <Card
                  key={m.name}
                  className="bg-[var(--color-card)] border-[var(--color-border)]"
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-foreground)] font-mono">
                          {m.name}
                        </span>
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          {formatSize(m.size)}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                        {m.details?.family} · {m.details?.parameter_size} ·{" "}
                        {m.details?.quantization_level}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteModel(m.name)}
                      disabled={deleting === m.name}
                      className="w-7 h-7 text-[var(--color-muted-foreground)] hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Suggested model sections */}
        {SUGGESTED_SECTIONS.map((section) => (
          <div key={section.label}>
            <h2 className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider mb-2">
              {section.label}
            </h2>
            <div className="space-y-1.5">
              {section.models.map((s) => {
                const isInstalled = installedNames.has(s.name.split(":")[0]) ||
                  models.some((m) => m.name === s.name || m.name.startsWith(s.name + ":"));
                const isPulling = pulling[s.name];
                return (
                  <Card
                    key={s.name}
                    className="bg-[var(--color-card)] border-[var(--color-border)]"
                  >
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-[var(--color-foreground)] font-mono">
                            {s.name}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-4 ${CATEGORY_COLOR[s.category]}`}
                          >
                            {s.size}
                          </Badge>
                          {s.note && (
                            <span className="text-[10px] text-orange-400">{s.note}</span>
                          )}
                          {isInstalled && (
                            <Badge variant="secondary" className="text-[10px] h-4">
                              installed
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                          {s.desc}
                        </p>
                        {isPulling && (
                          <div className="mt-1.5">
                            <div className="text-[10px] text-[var(--color-muted-foreground)] mb-1">
                              {isPulling.status} {isPulling.percent > 0 && `(${isPulling.percent}%)`}
                            </div>
                            <div className="h-1 w-full bg-[var(--color-secondary)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[var(--color-primary)] transition-all duration-300"
                                style={{ width: `${isPulling.percent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {!isInstalled && !isPulling && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pullModel(s.name)}
                          disabled={!healthy}
                          className="shrink-0 gap-1.5 text-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Pull
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
