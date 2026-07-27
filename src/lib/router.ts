import type { ModelCategory, ModelRouterConfig } from "@/types";

const DEFAULT_CONFIG: ModelRouterConfig = {
  codeModels: ["phind-codellama", "qwen2.5-coder", "deepseek-coder", "codellama", "starcoder2"],
  generalModels: ["llama3.1", "llama3", "mistral", "gemma2", "phi3", "llama2"],
  mathModels: ["deepseek-r1", "qwen2.5", "llama3.1"],
  domainModels: ["medllama2", "meditron", "lawllm"],
  defaultModel: "llama3.1",
};

const CODE_PATTERNS =
  /\b(code|function|class|implement|debug|fix|error|bug|script|program|algorithm|syntax|compile|run|execute|import|export|api|endpoint|sql|query|regex|typescript|javascript|python|rust|golang|java|cpp|html|css)\b/i;
const MATH_PATTERNS =
  /\b(calculate|compute|solve|equation|integral|derivative|matrix|probability|statistics|formula|math|algebra|geometry|proof|theorem)\b/i;
const DOMAIN_PATTERNS =
  /\b(medical|diagnosis|legal|contract|clinical|drug|symptom|liability|compliance|regulation|patient|law)\b/i;

export function classifyTask(prompt: string): ModelCategory {
  if (CODE_PATTERNS.test(prompt)) return "code";
  if (MATH_PATTERNS.test(prompt)) return "math";
  if (DOMAIN_PATTERNS.test(prompt)) return "domain";
  return "general";
}

export function selectModel(
  prompt: string,
  availableModels: string[],
  override?: string
): { model: string; category: ModelCategory; reason: string } {
  if (override && availableModels.includes(override)) {
    return { model: override, category: classifyTask(prompt), reason: "user override" };
  }

  const category = classifyTask(prompt);
  const config = DEFAULT_CONFIG;

  const preferredList =
    category === "code"
      ? config.codeModels
      : category === "math"
        ? config.mathModels
        : category === "domain"
          ? config.domainModels
          : config.generalModels;

  // Find the first preferred model that is actually installed
  const bestMatch = preferredList.find((preferred) =>
    availableModels.some(
      (m) => m.toLowerCase().includes(preferred.toLowerCase())
    )
  );

  if (bestMatch) {
    const actualModel = availableModels.find((m) =>
      m.toLowerCase().includes(bestMatch.toLowerCase())
    )!;
    return { model: actualModel, category, reason: `best for ${category}` };
  }

  // Fallback: pick any available model
  const fallback = availableModels[0] ?? config.defaultModel;
  return { model: fallback, category, reason: "fallback — install a preferred model" };
}

export function getRouterConfig(): ModelRouterConfig {
  return DEFAULT_CONFIG;
}
