import { logBasicSafe } from "@/lib/basic-logs";
import { consumeStop } from "@/lib/chat-state";
import { type ModelConfig } from "@/lib/model-manager";
import {
  resolvePlatformChatProvider,
  streamChat,
  type ChatMessage,
  type ResolvedProvider,
} from "@/lib/ai-provider";

/** 整体生成时长上限（文档建议长连接不宜无限挂起） */
export const MAX_STREAM_MS = 180_000;

/** 未配置真实模型时的占位流式输出片段 */
export const MOCK_CHUNKS = [
  "创作服务暂时不可用。",
  "请稍后再试，或到「积分」页确认余额后重试。",
  "\n\n[前往积分 →](/credits)",
];

const MOCK_FAIL_CHUNKS = [
  "模型调用失败，请稍后重试。",
  "若多次失败，请联系开发者检查平台服务配置。",
  "\n\n[前往积分 →](/credits)",
];

export type ProviderChainItem = {
  config: ModelConfig;
  provider: ResolvedProvider;
};

export async function resolveSessionProviderChain(
  _sessionId: string,
  _userId: string,
): Promise<ProviderChainItem[]> {
  const provider = resolvePlatformChatProvider();
  if (!provider) return [];
  const config: ModelConfig = {
    id: "platform-deepseek",
    name: "平台 DeepSeek",
    provider: "deepseek",
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    modelName: provider.modelName,
    defaultTemperature: 0.7,
    maxTokens: 4096,
    enabled: true,
  };
  return [{ config, provider }];
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
