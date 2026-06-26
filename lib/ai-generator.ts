import { StyleFeatures } from "./style-anchor";
import { resolveProvider, streamChat, type ChatMessage } from "./ai-provider";
import { ModelManager } from "./model-manager";

export interface GenerationResult {
  content: string;
  tokenCount: number;
  model: string;
  timestamp: Date;
}

export interface RewriteRequest {
  content: string;
  styleFeatures?: StyleFeatures;
  instructions?: string;
  preserveStructure?: boolean;
  maxLength?: number;
}

export interface StyleInjectionOptions {
  preserveOriginal: boolean;
  injectType: "prefix" | "suffix" | "both";
  strength: "weak" | "medium" | "strong";
}

export class AIGenerator {
  /**
   * 使用用户配置的真实模型生成内容。
   * 需要用户在设置页或环境变量中配置 API Key，否则返回 null。
   */
  async generate(
    prompt: string,
    options?: {
      userId?: string;
      modelId?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<GenerationResult | null> {
    const userId = options?.userId;
    if (!userId) return null;

    const modelId = options?.modelId || (await ModelManager.getUserDefaultModel(userId));
    if (!modelId) return null;

    const modelConfig = await ModelManager.getModelConfig(modelId, userId);
    if (!modelConfig) return null;

    const provider = resolveProvider(modelConfig);
    if (!provider) return null;

    const messages: ChatMessage[] = [
      { role: "user", content: prompt },
    ];

    let content = "";
    for await (const delta of streamChat(provider, messages, {
      temperature: options?.temperature ?? modelConfig.defaultTemperature,
      maxTokens: options?.maxTokens ?? modelConfig.maxTokens,
    })) {
      content += delta;
    }

    return {
      content,
      tokenCount: content.length,
      model: modelConfig.modelName,
      timestamp: new Date(),
    };
  }

  injectStyle(
    prompt: string,
    features: StyleFeatures,
    options: StyleInjectionOptions = {
      preserveOriginal: true,
      injectType: "prefix",
      strength: "medium",
    }
  ): string {
    const styleInstructions = this.buildStyleInstructions(features, options.strength);

    if (options.injectType === "prefix") {
      return `${styleInstructions}\n\n${prompt}`;
    } else if (options.injectType === "suffix") {
      return `${prompt}\n\n${styleInstructions}`;
    } else {
      return `${styleInstructions}\n\n${prompt}\n\n${styleInstructions}`;
    }
  }

  private buildStyleInstructions(
    features: StyleFeatures,
    strength: "weak" | "medium" | "strong"
  ): string {
    const instructions: string[] = [];

    if (features.wordPreferences) {
      if (features.wordPreferences.highFreqWords && features.wordPreferences.highFreqWords.length > 0) {
        instructions.push(`使用以下高频词汇：${features.wordPreferences.highFreqWords.join('、')}`);
      }
      if (features.wordPreferences.forbiddenWords && features.wordPreferences.forbiddenWords.length > 0) {
        instructions.push(`避免使用以下词汇：${features.wordPreferences.forbiddenWords.join('、')}`);
      }
    }

    if (features.sentencePatterns) {
      const { avgLength, dialogueRatio } = features.sentencePatterns;
      if (avgLength < 15) {
        instructions.push("使用简短的句子结构");
      } else if (avgLength > 30) {
        instructions.push("使用较长的复合句");
      }
      if (dialogueRatio > 0.3) {
        instructions.push("增加对话内容");
      } else if (dialogueRatio < 0.1) {
        instructions.push("减少对话内容，增加叙述");
      }
    }

    if (features.emotionalIntensity) {
      const { tensionAvg, relaxationAvg } = features.emotionalIntensity;
      if (tensionAvg > 0.6) {
        instructions.push("营造紧张的氛围");
      } else if (relaxationAvg > 0.6) {
        instructions.push("营造轻松舒缓的氛围");
      }
    }

    if (features.narrativeRhythm) {
      const { actionDensity } = features.narrativeRhythm;
      if (actionDensity > 0.6) {
        instructions.push("增加动作描写密度");
      } else if (actionDensity < 0.3) {
        instructions.push("减少动作描写，增加细节描写");
      }
    }

    if (instructions.length === 0) {
      return "";
    }

    const strengthPrefix = {
      weak: "尽量",
      medium: "请",
      strong: "务必",
    };

    return `${strengthPrefix[strength]}遵循以下写作风格：\n${instructions.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`;
  }

  async rewrite(
    request: RewriteRequest,
    userId?: string
  ): Promise<GenerationResult | null> {
    let prompt = request.content;

    if (request.styleFeatures) {
      prompt = this.injectStyle(prompt, request.styleFeatures, {
        preserveOriginal: true,
        injectType: "prefix",
        strength: "medium",
      });
    }

    if (request.instructions) {
      prompt = `${request.instructions}\n\n${prompt}`;
    }

    if (request.preserveStructure) {
      prompt = `请重写以下内容，保持原有的段落结构和核心信息，但用更流畅的语言表达：\n\n${prompt}`;
    }

    const maxTokens = request.maxLength
      ? Math.min(request.maxLength * 2, 4000)
      : 2000;

    return this.generate(prompt, {
      userId,
      maxTokens,
      temperature: 0.8,
    });
  }

  async summarize(
    content: string,
    maxLength: number = 200,
    userId?: string
  ): Promise<GenerationResult | null> {
    const prompt = `请用不超过${maxLength}字总结以下内容，保持核心信息完整：\n\n${content}`;

    return this.generate(prompt, {
      userId,
      maxTokens: maxLength * 2,
      temperature: 0.3,
    });
  }

  async expand(
    content: string,
    targetLength: number,
    styleFeatures?: StyleFeatures,
    userId?: string
  ): Promise<GenerationResult | null> {
    let prompt = `请将以下内容扩展至约${targetLength}字，增加细节描写和背景信息：\n\n${content}`;

    if (styleFeatures) {
      prompt = this.injectStyle(prompt, styleFeatures, {
        preserveOriginal: true,
        injectType: "suffix",
        strength: "medium",
      });
    }

    return this.generate(prompt, {
      userId,
      maxTokens: targetLength * 2,
      temperature: 0.8,
    });
  }
}

let instance: AIGenerator | null = null;

export function getAIGenerator(): AIGenerator {
  if (!instance) {
    instance = new AIGenerator();
  }
  return instance;
}
