import { logBasicSafe } from "@/lib/basic-logs";
import { consumeStop } from "@/lib/chat-state";
import { ModelManager, type ModelConfig } from "@/lib/model-manager";
import {
  resolveProvider,
  streamChat,
  type ChatMessage,
  type ResolvedProvider,
} from "@/lib/ai-provider";

/** 整体生成时长上限（文档建议长连接不宜无限挂起） */
export const MAX_STREAM_MS = 180_000;

/** 未配置真实模型时的占位流式输出片段 */
export const MOCK_CHUNKS = [
  "已收到你的创作指令，",
  "这是一个 MVP 版本的流式回复（未配置真实模型）。",
  "请在「设置 → 模型管理」页面配置 API Key 和模型，即可启用真实模型输出。",
  "\n\n[前往配置 API →](/settings#ai-model-settings)",
];

const MOCK_FAIL_CHUNKS = [
  "已配置的模型调用失败（请检查 API Key、额度与 Base URL）。",
  "DeepSeek 请确认 Base URL 为 https://api.deepseek.com/v1 。",
  "也可到「设置 → AI 模型管理」核对后重试。",
  "\n\n[前往配置 API →](/settings#ai-model-settings)",
];

export type ProviderChainItem = {
  config: ModelConfig;
  provider: ResolvedProvider;
};

export async function resolveSessionProviderChain(
  sessionId: string,
  userId: string,
): Promise<ProviderChainItem[]> {
  const primaryModelId = await ModelManager.getSessionModel(sessionId, userId);
  const fallbackIds = await ModelManager.getFallbackModelIds(primaryModelId, userId);
  const providerChain = (
    await Promise.all(
      fallbackIds.map(async (mid) => {
        const config = await ModelManager.getModelConfig(mid, userId);
        if (!config) return null;
        const provider = resolveProvider(config);
        return provider ? { config, provider } : null;
      }),
    )
  ).filter((x): x is ProviderChainItem => x !== null);
  return providerChain;
}

/** 按降级链流式产出助手文本；调用方负责写入 SSE 与落库。 */
export async function produceChatText(args: {
  sessionId: string;
  userId: string;
  contextMessages: ChatMessage[];
  providerChain: ProviderChainItem[];
  streamStarted: number;
  maxStreamMs?: number;
  emit: (part: string) => void;
  logCategory?: string;
}): Promise<{ usedModelName: string; stopped: boolean; timedOut: boolean }> {
  const maxMs = args.maxStreamMs ?? MAX_STREAM_MS;
  const category = args.logCategory ?? "chat_generate";
  let usedModelName = "mock-model";
  let stopped = false;
  let timedOut = false;
  let producedChars = 0;

  const emit = (part: string) => {
    producedChars += part.length;
    args.emit(part);
  };

  if (args.providerChain.length > 0) {
    let producedOutput = false;
    for (let i = 0; i < args.providerChain.length; i++) {
      if (stopped || timedOut || producedOutput) break;
      const { config, provider } = args.providerChain[i];
      usedModelName = config.modelName;
      const abort = new AbortController();
      const stopPoll = setInterval(() => {
        if (consumeStop(args.sessionId)) {
          stopped = true;
          abort.abort();
        }
        if (Date.now() - args.streamStarted > maxMs) {
          timedOut = true;
          abort.abort();
        }
      }, 500);
      try {
        for await (const delta of streamChat(provider, args.contextMessages, {
          temperature: config.defaultTemperature,
          maxTokens: config.maxTokens,
          signal: abort.signal,
        })) {
          emit(delta);
          producedOutput = true;
        }
      } catch (streamErr) {
        if (stopped || timedOut) break;
        await logBasicSafe("warn", "live model failed, trying fallback", {
          category,
          meta: {
            sessionId: args.sessionId,
            modelId: config.id,
            isLast: i === args.providerChain.length - 1,
            message: streamErr instanceof Error ? streamErr.message : String(streamErr),
          },
          user_id: args.userId,
        });
        if (producedChars > 0) {
          producedOutput = true;
          break;
        }
      } finally {
        clearInterval(stopPoll);
      }
    }

    if (!stopped && !timedOut && producedChars === 0) {
      await logBasicSafe("error", "all live models failed, fallback to mock", {
        category,
        meta: { sessionId: args.sessionId },
        user_id: args.userId,
      });
      usedModelName = "mock-model";
      for (const part of MOCK_FAIL_CHUNKS) {
        emit(part);
      }
    }
  } else {
    for (const part of MOCK_CHUNKS) {
      if (Date.now() - args.streamStarted > maxMs) {
        timedOut = true;
        break;
      }
      if (consumeStop(args.sessionId)) {
        stopped = true;
        break;
      }
      emit(part);
      await new Promise((resolve) => setTimeout(resolve, 280));
    }
  }

  return { usedModelName, stopped, timedOut };
}
