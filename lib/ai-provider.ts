import type { ModelConfig } from "./model-manager";

/**
 * 真实模型接入层（OpenAI 兼容协议）。
 *
 * 设计原则（见 docs/StoryForge_技术文档.md 5.8.5 多模型适配）：
 * - 统一抽象：所有 provider 走 OpenAI 兼容的 `/chat/completions` 流式接口；
 * - 渐进增强：未配置密钥时返回 null，调用方回退到内置 MVP 占位输出；
 * - 安全：仅接受 http(s) 端点，绝不记录或回传 API Key。
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ResolvedProvider {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

function sanitizeBaseUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return raw.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/**
 * 将模型配置 + 环境变量解析为可用的 provider 凭据。
 * 未配置（缺少 Key 或端点）时返回 null，调用方应回退到占位输出。
 */
export function resolveProvider(config: ModelConfig): ResolvedProvider | null {
  const env = process.env;

  let baseUrlRaw: string | undefined;
  let apiKey: string | undefined;

  // 优先使用用户在模型配置中存储的凭据，其次回退到环境变量
  switch (config.provider) {
    case "openai":
      baseUrlRaw = config.baseUrl ?? env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
      apiKey = config.apiKey ?? env.OPENAI_API_KEY;
      break;
    case "anthropic":
      baseUrlRaw = config.baseUrl ?? env.ANTHROPIC_BASE_URL;
      apiKey = config.apiKey ?? env.ANTHROPIC_API_KEY;
      break;
    case "ollama":
      baseUrlRaw = config.baseUrl
        ? `${config.baseUrl.replace(/\/+$/, "")}/v1`
        : env.OLLAMA_BASE_URL;
      apiKey = config.apiKey ?? env.OLLAMA_API_KEY ?? "ollama";
      break;
    case "custom":
    default:
      baseUrlRaw = config.baseUrl ?? env.CUSTOM_AI_BASE_URL;
      apiKey = config.apiKey ?? env.CUSTOM_AI_API_KEY;
      break;
  }

  if (!baseUrlRaw || !apiKey) return null;
  const baseUrl = sanitizeBaseUrl(baseUrlRaw);
  if (!baseUrl) return null;

  return { baseUrl, apiKey, modelName: config.modelName };
}

/** 是否已配置可用的真实模型（用于决定走真实流式还是占位输出）。 */
export function isLiveModelConfigured(config: ModelConfig): boolean {
  return resolveProvider(config) !== null;
}

export interface StreamOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * 以 OpenAI 兼容协议流式生成，逐段产出增量文本。
 * 任意网络/协议错误都会抛出，由调用方决定回退策略。
 */
export async function* streamChat(
  provider: ResolvedProvider,
  messages: ChatMessage[],
  options: StreamOptions = {},
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.modelName,
      messages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }),
    signal: options.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`模型服务返回 ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // 跳过无法解析的保活/部分帧
      }
    }
  }
}
