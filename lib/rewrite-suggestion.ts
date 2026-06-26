import { getAIGenerator } from "./ai-generator";

export interface RewriteSuggestion {
  id: string;
  originalText: string;
  rewrittenText: string;
  suggestion: string;
  confidence: number;
  type: "grammar" | "style" | "clarity" | "conciseness" | "vocabulary";
}

export interface ConflictRewriteRequest {
  content: string;
  conflictDetails: {
    conflictPoint: string;
    reason: string;
    characterId?: string;
    worldId?: string;
  };
}

export interface ConflictRewriteResult {
  rewrittenText: string;
  instructions: string;
  suggestions: RewriteSuggestion[];
}

export class RewriteSuggestionEngine {
  private aiGenerator = getAIGenerator();

  async generateSuggestions(
    text: string,
    options?: {
      userId?: string;
      maxSuggestions?: number;
      focusAreas?: string[];
    }
  ): Promise<RewriteSuggestion[]> {
    const maxSuggestions = options?.maxSuggestions || 5;
    const focusAreas = options?.focusAreas || ["grammar", "style", "clarity", "conciseness"];

    const focusPrompt = focusAreas.map((area) => {
      switch (area) {
        case "grammar":
          return "语法正确性";
        case "style":
          return "写作风格";
        case "clarity":
          return "表达清晰度";
        case "conciseness":
          return "简洁性";
        case "vocabulary":
          return "词汇选择";
        default:
          return area;
      }
    }).join("、");

    const prompt = `请分析以下文本，从${focusPrompt}等方面提供最多${maxSuggestions}个改写建议：

文本：${text}

请以JSON格式返回，包含以下字段：
- suggestions: 建议数组，每个元素包含：
  - originalText: 原始片段
  - rewrittenText: 改写后片段
  - suggestion: 修改说明
  - confidence: 置信度(0-1)
  - type: 类型(grammar/style/clarity/conciseness/vocabulary)`;

    const result = await this.aiGenerator.generate(prompt, {
      userId: options?.userId,
      maxTokens: 2000,
      temperature: 0.3,
    });

    if (!result) return [];

    try {
      const data = JSON.parse(result.content);
      return data.suggestions || [];
    } catch {
      return this.parseFallbackSuggestions(result.content);
    }
  }

  private parseFallbackSuggestions(text: string): RewriteSuggestion[] {
    const suggestions: RewriteSuggestion[] = [];
    const lines = text.split("\n").filter((line) => line.trim());

    let currentSuggestion: Partial<RewriteSuggestion> = {};

    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        if (currentSuggestion.originalText) {
          suggestions.push({
            id: Math.random().toString(36).substr(2, 9),
            originalText: currentSuggestion.originalText || "",
            rewrittenText: currentSuggestion.rewrittenText || "",
            suggestion: currentSuggestion.suggestion || "",
            confidence: currentSuggestion.confidence || 0.8,
            type: currentSuggestion.type || "style",
          });
        }
        currentSuggestion = {};
      } else if (line.includes("原始:")) {
        currentSuggestion.originalText = line.replace(/^原始:\s*/, "").trim();
      } else if (line.includes("改写:")) {
        currentSuggestion.rewrittenText = line.replace(/^改写:\s*/, "").trim();
      } else if (line.includes("说明:")) {
        currentSuggestion.suggestion = line.replace(/^说明:\s*/, "").trim();
      } else if (line.includes("置信度:")) {
        currentSuggestion.confidence = parseFloat(line.replace(/^置信度:\s*/, "").trim());
      } else if (line.includes("类型:")) {
        const type = line.replace(/^类型:\s*/, "").trim().toLowerCase();
        currentSuggestion.type = (type as RewriteSuggestion["type"]) || "style";
      }
    }

    if (currentSuggestion.originalText) {
      suggestions.push({
        id: Math.random().toString(36).substr(2, 9),
        originalText: currentSuggestion.originalText,
        rewrittenText: currentSuggestion.rewrittenText || "",
        suggestion: currentSuggestion.suggestion || "",
        confidence: currentSuggestion.confidence || 0.8,
        type: currentSuggestion.type || "style",
      });
    }

    return suggestions;
  }

  async rewriteForConflict(
    request: ConflictRewriteRequest,
    userId?: string
  ): Promise<ConflictRewriteResult> {
    const { content, conflictDetails } = request;

    const prompt = `请根据以下冲突信息，重写文本以解决冲突：

冲突点：${conflictDetails.conflictPoint}
冲突原因：${conflictDetails.reason}

原始文本：${content}

请提供：
1. 改写后的文本（保持原意，但解决冲突）
2. 修改说明（详细解释如何解决冲突）
3. 具体的改写建议

以JSON格式返回，包含：
- rewrittenText: 改写后的文本
- instructions: 修改说明
- suggestions: 改写建议数组`;

    const result = await this.aiGenerator.generate(prompt, {
      userId,
      maxTokens: 3000,
      temperature: 0.6,
    });

    if (!result) {
      return {
        rewrittenText: content,
        instructions: "未配置 AI 模型，无法生成改写建议",
        suggestions: [],
      };
    }

    try {
      const data = JSON.parse(result.content);
      return {
        rewrittenText: data.rewrittenText || content,
        instructions: data.instructions || "",
        suggestions: data.suggestions || [],
      };
    } catch {
      return {
        rewrittenText: content,
        instructions: "未能生成改写建议",
        suggestions: [],
      };
    }
  }

  async improveClarity(text: string, userId?: string): Promise<RewriteSuggestion[]> {
    return this.generateSuggestions(text, {
      userId,
      maxSuggestions: 5,
      focusAreas: ["clarity"],
    });
  }

  async improveStyle(text: string, userId?: string): Promise<RewriteSuggestion[]> {
    return this.generateSuggestions(text, {
      userId,
      maxSuggestions: 5,
      focusAreas: ["style", "vocabulary"],
    });
  }

  async improveConciseness(text: string, userId?: string): Promise<RewriteSuggestion[]> {
    return this.generateSuggestions(text, {
      userId,
      maxSuggestions: 5,
      focusAreas: ["conciseness"],
    });
  }
}

let instance: RewriteSuggestionEngine | null = null;

export function getRewriteSuggestionEngine(): RewriteSuggestionEngine {
  if (!instance) {
    instance = new RewriteSuggestionEngine();
  }
  return instance;
}
