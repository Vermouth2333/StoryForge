import { StyleFeatures } from "./style-anchor";

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
  async generate(
    prompt: string,
    options?: {
      modelId?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<GenerationResult> {
    const modelId = options?.modelId || "openai-gpt-4";

    const mockResponse = await this.mockGenerate(prompt, options);

    return {
      content: mockResponse.content,
      tokenCount: mockResponse.tokenCount,
      model: modelId,
      timestamp: new Date(),
    };
  }

  private async mockGenerate(
    prompt: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<{ content: string; tokenCount: number }> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const content = `根据您的提示，我已生成了相关内容。这是一个模拟响应，实际实现时会调用真实的 AI 模型。\n\n提示摘要: ${prompt.slice(0, 100)}...`;
    
    return {
      content,
      tokenCount: content.length,
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
    request: RewriteRequest
  ): Promise<GenerationResult> {
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
      maxTokens,
      temperature: 0.8,
    });
  }

  async summarize(
    content: string,
    maxLength: number = 200
  ): Promise<GenerationResult> {
    const prompt = `请用不超过${maxLength}字总结以下内容，保持核心信息完整：\n\n${content}`;

    return this.generate(prompt, {
      maxTokens: maxLength * 2,
      temperature: 0.3,
    });
  }

  async expand(
    content: string,
    targetLength: number,
    styleFeatures?: StyleFeatures
  ): Promise<GenerationResult> {
    let prompt = `请将以下内容扩展至约${targetLength}字，增加细节描写和背景信息：\n\n${content}`;

    if (styleFeatures) {
      prompt = this.injectStyle(prompt, styleFeatures, {
        preserveOriginal: true,
        injectType: "suffix",
        strength: "medium",
      });
    }

    return this.generate(prompt, {
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
