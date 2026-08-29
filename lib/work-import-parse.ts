import { completeChat, resolveProvider, type ChatMessage } from "@/lib/ai-provider";
import type { ModelConfig } from "@/lib/model-manager";

export type WorkImportKind = "story" | "character" | "world" | "persona";

export type WorkImportResult = {
  title: string;
  summary: string;
  tags: string[];
  personality?: string;
  setting_notes?: string;
  appearance?: string;
  background?: string;
  speech_style?: string;
  likes_dislikes?: string;
  greeting?: string;
};

function buildSystemPrompt(kind: WorkImportKind): string {
  if (kind === "persona") {
    return `你是创作助手。请从用户提供的文本中提炼「人设面具」（用户扮演身份）字段，只输出一个 JSON 对象，不要 Markdown 代码块，不要解释。
字段要求：
- title: 面具/身份名称，字符串，不超过 120 字
- summary: 简介，字符串，不超过 1000 字
- appearance: 外貌与穿着气质，字符串，不超过 2000 字
- personality: 性格特质，字符串，不超过 8000 字
- background: 出身与经历背景，字符串，不超过 4000 字
- speech_style: 说话方式与口吻，字符串，不超过 2000 字
- tags: 字符串数组，最多 10 个，每个不超过 30 字
若原文信息不足，可合理概括，但不要编造与原文矛盾的内容。`;
  }
  if (kind === "character") {
    return `你是创作助手。请从用户提供的文本中提炼角色卡字段，只输出一个 JSON 对象，不要 Markdown 代码块，不要解释。
字段要求：
- title: 角色名称，字符串，不超过 120 字
- summary: 简介，字符串，不超过 1000 字
- personality: 性格与动机（性格特质、核心动机、内心冲突等），字符串，不超过 8000 字
- appearance: 外貌（相貌、体型、穿着、气质等），字符串，不超过 2000 字
- background: 背景经历（出身、过往经历、关键记忆等），字符串，不超过 4000 字
- speech_style: 说话风格（语气、口头禅、常用表达方式等），字符串，不超过 2000 字
- likes_dislikes: 喜好与厌恶（喜欢什么、讨厌什么等），字符串，不超过 2000 字
- greeting: 开场语（创建会话后由角色先说出的第一句话），字符串，不超过 1000 字
- tags: 字符串数组，最多 10 个，每个不超过 30 字
若原文信息不足，可合理概括，但不要编造与原文矛盾的内容；缺失字段输出空字符串即可。`;
  }
  if (kind === "world") {
    return `你是创作助手。请从用户提供的文本中提炼世界卡字段，只输出一个 JSON 对象，不要 Markdown 代码块，不要解释。
字段要求：
- title: 世界名称，字符串，不超过 120 字
- summary: 简介，字符串，不超过 1000 字
- setting_notes: 世界设定（规则、社会、科技、地理、历史等），字符串，不超过 8000 字
- greeting: 开场语（创建会话后由世界先说出的第一句话），字符串，不超过 1000 字
- tags: 字符串数组，最多 10 个，每个不超过 30 字
若原文信息不足，可合理概括，但不要编造与原文矛盾的内容；缺失字段输出空字符串即可。`;
  }
  return `你是创作助手。请从用户提供的文本中提炼故事字段，只输出一个 JSON 对象，不要 Markdown 代码块，不要解释。
字段要求：
- title: 故事标题，字符串，不超过 120 字
- summary: 简介，字符串，不超过 1000 字
- greeting: 开场语（创建会话后由故事先说出的第一句话），字符串，不超过 1000 字
- tags: 字符串数组，最多 10 个，每个不超过 30 字
若原文信息不足，可合理概括，但不要编造与原文矛盾的内容；缺失字段输出空字符串即可。`;
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function clamp(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => String(t ?? "").trim())
    .filter(Boolean)
    .map((t) => t.slice(0, 30))
    .slice(0, 10);
}

export function normalizeImportResult(kind: WorkImportKind, data: Record<string, unknown>): WorkImportResult {
  const title = clamp(String(data.title ?? data.name ?? "").trim(), 120);
  const summary = clamp(String(data.summary ?? "").trim(), 1000);
  const tags = normalizeTags(data.tags);
  const result: WorkImportResult = { title, summary, tags };
  if (kind === "character") {
    result.personality = clamp(String(data.personality ?? "").trim(), 8000);
    result.appearance = clamp(String(data.appearance ?? "").trim(), 2000);
    result.background = clamp(String(data.background ?? "").trim(), 4000);
    result.speech_style = clamp(String(data.speech_style ?? "").trim(), 2000);
    result.likes_dislikes = clamp(String(data.likes_dislikes ?? "").trim(), 2000);
    result.greeting = clamp(String(data.greeting ?? "").trim(), 1000);
  }
  if (kind === "world") {
    result.setting_notes = clamp(
      String(data.setting_notes ?? data.settingNotes ?? "").trim(),
      8000,
    );
    result.greeting = clamp(String(data.greeting ?? "").trim(), 1000);
  }
  if (kind === "story") {
    result.greeting = clamp(String(data.greeting ?? "").trim(), 1000);
  }
  if (kind === "persona") {
    result.appearance = clamp(String(data.appearance ?? "").trim(), 2000);
    result.personality = clamp(String(data.personality ?? "").trim(), 8000);
    result.background = clamp(String(data.background ?? "").trim(), 4000);
    result.speech_style = clamp(
      String(data.speech_style ?? data.speechStyle ?? "").trim(),
      2000,
    );
  }
  return result;
}

export async function parseWorkImportWithAi(
  kind: WorkImportKind,
  sourceText: string,
  model: ModelConfig,
): Promise<WorkImportResult> {
  const provider = resolveProvider(model);
  if (!provider) {
    throw new Error("创作服务暂不可用");
  }

  const text = sourceText.trim();
  if (!text) throw new Error("待解析文本为空");

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(kind) },
    {
      role: "user",
      content: `请解析以下文本并输出 JSON：\n\n${text}`,
    },
  ];

  const raw = await completeChat(provider, messages, {
    temperature: Math.min(model.defaultTemperature ?? 0.3, 0.5),
    maxTokens: Math.min(model.maxTokens ?? 4096, 4096),
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripCodeFence(raw)) as Record<string, unknown>;
  } catch {
    throw new Error("模型返回的内容不是有效 JSON，请重试");
  }

  const result = normalizeImportResult(kind, parsed);
  if (!result.title) {
    throw new Error("未能解析出标题/名称，请补充原文后重试");
  }
  return result;
}
