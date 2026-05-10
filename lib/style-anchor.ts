import { getDb, id, nowIso } from "@/lib/db";

export interface StyleFeatures {
  wordPreferences: {
    highFreqWords: string[];
    forbiddenWords: string[];
  };
  sentencePatterns: {
    avgLength: number;
    dialogueRatio: number;
    paragraphLength: number;
  };
  emotionalIntensity: {
    tensionAvg: number;
    relaxationAvg: number;
  };
  narrativeRhythm: {
    actionDensity: number;
    descriptionDensity: number;
  };
}

export interface ConflictResult {
  level: "P0" | "P1" | "P2";
  conflictPoint: string;
  reason: string;
  rewriteSuggestions: string[];
  rewrittenInstruction: string;
}

export class StyleAnchor {
  /**
   * 从最近的对话历史中抽取文风特征
   */
  async extractStyle(storyId: string, recentMessages: { role: string; content: string }[]): Promise<StyleFeatures> {
    if (recentMessages.length === 0) {
      return this.getDefaultStyle();
    }

    const allText = recentMessages.map(m => m.content).join(" ");
    
    // 1. 抽取高频词（排除停用词）
    const highFreqWords = this.extractHighFreqWords(allText, 20);
    
    // 2. 分析句式模式
    const sentencePatterns = this.analyzeSentencePatterns(allText);
    
    // 3. 分析情感强度
    const emotionalIntensity = this.analyzeEmotionalIntensity(allText);
    
    // 4. 分析叙事节奏
    const narrativeRhythm = this.analyzeNarrativeRhythm(allText);
    
    const features: StyleFeatures = {
      wordPreferences: {
        highFreqWords,
        forbiddenWords: [],
      },
      sentencePatterns,
      emotionalIntensity,
      narrativeRhythm,
    };
    
    // 保存到数据库
    await this.saveStyleAnchor(storyId, features);
    
    return features;
  }

  /**
   * 将文风特征注入到基础 Prompt
   */
  injectStylePrompt(basePrompt: string, features: StyleFeatures): string {
    const styleInstructions = this.generateStyleInstructions(features);
    return `${basePrompt}\n\n## 文风约束\n${styleInstructions}`;
  }

  /**
   * 生成文风指令
   */
  private generateStyleInstructions(features: StyleFeatures): string {
    const instructions: string[] = [];
    
    // 词汇偏好
    if (features.wordPreferences.highFreqWords.length > 0) {
      instructions.push(
        `- 常用词汇：${features.wordPreferences.highFreqWords.slice(0, 10).join("、")}`
      );
    }
    
    if (features.wordPreferences.forbiddenWords.length > 0) {
      instructions.push(
        `- 避免词汇：${features.wordPreferences.forbiddenWords.join("、")}`
      );
    }
    
    // 句式模式
    instructions.push(
      `- 平均句长：${features.sentencePatterns.avgLength.toFixed(1)} 字`,
      `- 对话比例：${(features.sentencePatterns.dialogueRatio * 100).toFixed(0)}%`
    );
    
    // 情感强度
    if (features.emotionalIntensity.tensionAvg > 0.5) {
      instructions.push("- 情感基调：紧张、激烈");
    } else if (features.emotionalIntensity.relaxationAvg > 0.5) {
      instructions.push("- 情感基调：轻松、舒缓");
    }
    
    // 叙事节奏
    instructions.push(
      `- 动作密度：${(features.narrativeRhythm.actionDensity * 100).toFixed(0)}%`,
      `- 描写密度：${(features.narrativeRhythm.descriptionDensity * 100).toFixed(0)}%`
    );
    
    return instructions.join("\n");
  }

  /**
   * 抽取高频词
   */
  private extractHighFreqWords(text: string, limit: number): string[] {
    const stopWords = new Set([
      "的", "了", "是", "在", "我", "有", "和", "就", "不", "人", "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好", "自己", "这"
    ]);
    
    const words: Record<string, number> = {};
    const wordRegex = /[\u4e00-\u9fa5]{2,}/g;
    let match;
    
    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[0];
      if (!stopWords.has(word)) {
        words[word] = (words[word] || 0) + 1;
      }
    }
    
    return Object.entries(words)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word);
  }

  /**
   * 分析句式模式
   */
  private analyzeSentencePatterns(text: string): StyleFeatures["sentencePatterns"] {
    const sentences = text.split(/[。！？\n]/).filter(s => s.trim());
    const avgLength = sentences.length > 0 
      ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length 
      : 20;
    
    const dialogueMatches = text.match(/["""'']/g);
    const dialogueRatio = dialogueMatches ? dialogueMatches.length / text.length * 2 : 0.1;
    
    const paragraphs = text.split(/\n\n/).filter(p => p.trim());
    const paragraphLength = paragraphs.length > 0 
      ? paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length 
      : 100;
    
    return { avgLength, dialogueRatio: Math.min(dialogueRatio, 0.5), paragraphLength };
  }

  /**
   * 分析情感强度
   */
  private analyzeEmotionalIntensity(text: string): StyleFeatures["emotionalIntensity"] {
    const tensionWords = ["紧张", "危机", "战斗", "冲突", "危险", "恐惧", "愤怒", "争吵"];
    const relaxationWords = ["平静", "温馨", "幸福", "美好", "安宁", "轻松", "愉快"];
    
    let tensionCount = 0;
    let relaxationCount = 0;
    
    tensionWords.forEach(word => {
      if (text.includes(word)) tensionCount++;
    });
    
    relaxationWords.forEach(word => {
      if (text.includes(word)) relaxationCount++;
    });
    
    const total = tensionCount + relaxationCount || 1;
    
    return {
      tensionAvg: tensionCount / total,
      relaxationAvg: relaxationCount / total,
    };
  }

  /**
   * 分析叙事节奏
   */
  private analyzeNarrativeRhythm(text: string): StyleFeatures["narrativeRhythm"] {
    const actionWords = ["打", "跑", "跳", "飞", "冲", "踢", "拳", "攻击"];
    const descriptionWords = ["看", "见", "感觉", "仿佛", "如同", "像是", "颜色", "声音"];
    
    let actionCount = 0;
    let descriptionCount = 0;
    
    actionWords.forEach(word => {
      const regex = new RegExp(word, "g");
      const matches = text.match(regex);
      actionCount += matches ? matches.length : 0;
    });
    
    descriptionWords.forEach(word => {
      const regex = new RegExp(word, "g");
      const matches = text.match(regex);
      descriptionCount += matches ? matches.length : 0;
    });
    
    const total = actionCount + descriptionCount || 1;
    
    return {
      actionDensity: actionCount / total,
      descriptionDensity: descriptionCount / total,
    };
  }

  /**
   * 获取默认文风
   */
  private getDefaultStyle(): StyleFeatures {
    return {
      wordPreferences: {
        highFreqWords: [],
        forbiddenWords: [],
      },
      sentencePatterns: {
        avgLength: 20,
        dialogueRatio: 0.2,
        paragraphLength: 100,
      },
      emotionalIntensity: {
        tensionAvg: 0.5,
        relaxationAvg: 0.5,
      },
      narrativeRhythm: {
        actionDensity: 0.5,
        descriptionDensity: 0.5,
      },
    };
  }

  /**
   * 保存文风锚点到数据库
   */
  private async saveStyleAnchor(storyId: string, features: StyleFeatures): Promise<void> {
    const db = await getDb();
    const anchorId = id("styleanchor");
    const now = nowIso();
    
    // 检查是否已存在
    const existing = await db.get("SELECT id FROM story_style_anchors WHERE story_id = ?", [storyId]);
    
    if (existing) {
      await db.run(
        "UPDATE story_style_anchors SET features_json = ?, updated_at = ? WHERE story_id = ?",
        [JSON.stringify(features), now, storyId]
      );
    } else {
      await db.run(
        "INSERT INTO story_style_anchors (id, story_id, features_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [anchorId, storyId, JSON.stringify(features), now, now]
      );
    }
  }

  /**
   * 获取故事的文风锚点
   */
  async getStyleAnchor(storyId: string): Promise<StyleFeatures | null> {
    const db = await getDb();
    const anchor = await db.get(
      "SELECT features_json FROM story_style_anchors WHERE story_id = ?",
      [storyId]
    );
    
    if (!anchor) return null;
    
    try {
      return JSON.parse(anchor.features_json) as StyleFeatures;
    } catch {
      return null;
    }
  }
}

// 导出单例
export const styleAnchor = new StyleAnchor();
