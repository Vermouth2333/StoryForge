import { getDb, id, nowIso } from "@/lib/db";

export interface ConsistencyViolation {
  type: "character" | "timeline" | "location" | "fact";
  severity: "error" | "warning" | "info";
  message: string;
  location?: string;
  suggestion: string;
}

export class ConsistencyChecker {
  /**
   * 检查故事一致性
   */
  async checkStory(storyId: string): Promise<ConsistencyViolation[]> {
    const violations: ConsistencyViolation[] = [];
    const db = await getDb();
    
    // 1. 获取故事信息
    const story = await db.get("SELECT * FROM stories WHERE id = ?", [storyId]);
    if (!story) return violations;
    
    // 2. 获取章节内容
    const chapters = await db.all(
      "SELECT * FROM story_outline_nodes WHERE story_id = ? ORDER BY sort_order",
      [storyId]
    );
    
    // 3. 获取角色信息
    const characters = await db.all(
      "SELECT * FROM characters WHERE author_id = ?",
      [story.author_id]
    );
    
    // 4. 获取世界信息
    const world = story.world_id 
      ? await db.get("SELECT * FROM worlds WHERE id = ?", [story.world_id])
      : null;
    
    // 执行各类检查
    violations.push(...this.checkCharacterConsistency(chapters, characters));
    violations.push(...this.checkTimelineConsistency(chapters));
    violations.push(...this.checkLocationConsistency(chapters));
    
    if (world) {
      violations.push(...this.checkWorldConsistency(chapters, world));
    }
    
    // 保存检查日志
    await this.saveConsistencyLogs(storyId, violations);
    
    return violations;
  }

  /**
   * 检查角色一致性
   */
  private checkCharacterConsistency(
    chapters: any[],
    characters: any[]
  ): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];
    
    if (characters.length === 0) return violations;
    
    // 建立角色性格关键词索引
    const characterKeywords: Record<string, string[]> = {};
    for (const char of characters) {
      if (char.personality) {
        characterKeywords[char.id] = char.personality
          .split(/[,，、]/)
          .map((k: string) => k.trim())
          .filter((k: string) => k.length >= 2);
      }
    }
    
    // 简单检查：每个章节都应该提到角色（根据上下文简化）
    // 实际应该分析每个章节的具体内容
    const mentionedCharacters = new Set<string>();
    
    for (const chapter of chapters) {
      const content = (chapter.content || "").toLowerCase();
      for (const [charId, keywords] of Object.entries(characterKeywords)) {
        for (const keyword of keywords as string[]) {
          if (content.includes(keyword)) {
            mentionedCharacters.add(charId);
          }
        }
      }
    }
    
    // 检查是否有角色从未被提及
    for (const char of characters) {
      if (!mentionedCharacters.has(char.id) && chapters.length > 3) {
        violations.push({
          type: "character",
          severity: "warning",
          message: `角色 "${char.name}" 在 ${chapters.length} 个章节中均未明确提及`,
          suggestion: `考虑在故事中适当加入对角色 ${char.name} 的描写，或在角色关系中明确其定位`,
        });
      }
    }
    
    return violations;
  }

  /**
   * 检查时间线一致性
   */
  private checkTimelineConsistency(chapters: any[]): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];
    
    // 检测季节混用
    const seasons: Record<string, string[]> = {
      spring: ["春天", "春暖花开", "春雨", "春风吹"],
      summer: ["夏天", "烈日", "酷暑", "蝉鸣"],
      autumn: ["秋天", "秋风", "落叶", "金黄"],
      winter: ["冬天", "大雪", "寒冷", "冰封"],
    };
    
    const chapterSeasons: Record<number, Set<string>> = {};
    
    for (let i = 0; i < chapters.length; i++) {
      const content = chapters[i].content || "";
      chapterSeasons[i] = new Set();
      
      for (const [season, keywords] of Object.entries(seasons)) {
        for (const keyword of keywords) {
          if (content.includes(keyword)) {
            chapterSeasons[i].add(season);
          }
        }
      }
    }
    
    // 检测相邻章节季节突变
    for (let i = 1; i < chapters.length; i++) {
      const prev = chapterSeasons[i - 1];
      const curr = chapterSeasons[i];
      
      if (prev.size > 0 && curr.size > 0) {
        const hasOverlap = Array.from(prev).some(s => curr.has(s));
        if (!hasOverlap) {
          violations.push({
            type: "timeline",
            severity: "warning",
            message: `第 ${i + 1} 章与第 ${i} 章季节描写不一致`,
            location: `章节: ${chapters[i].title}`,
            suggestion: "考虑添加过渡描写说明时间跳转，或统一季节设定",
          });
        }
      }
    }
    
    return violations;
  }

  /**
   * 检查地点一致性
   */
  private checkLocationConsistency(chapters: any[]): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];
    
    // 检测地点关键词
    const locationKeywords = ["城市", "乡村", "森林", "海边", "山上", "房间", "街道"];
    
    const chapterLocations: Record<number, Set<string>> = {};
    
    for (let i = 0; i < chapters.length; i++) {
      const content = chapters[i].content || "";
      chapterLocations[i] = new Set();
      
      for (const keyword of locationKeywords) {
        if (content.includes(keyword)) {
          chapterLocations[i].add(keyword);
        }
      }
    }
    
    // 检测连续章节地点突变（简化版）
    for (let i = 1; i < chapters.length; i++) {
      const prev = chapterLocations[i - 1];
      const curr = chapterLocations[i];
      
      if (prev.size > 0 && curr.size > 0) {
        const hasOverlap = Array.from(prev).some(l => curr.has(l));
        if (!hasOverlap) {
          // 需要检查是否有"来到"、"到达"等转移词汇
          const content = chapters[i].content || "";
          const transitionWords = ["来到", "到达", "前往", "离开", "走进", "回到"];
          const hasTransition = transitionWords.some(w => content.includes(w));
          
          if (!hasTransition) {
            violations.push({
            type: "location",
            severity: "info",
            message: `第 ${i + 1} 章可能发生了地点切换但未明确说明`,
            location: `章节: ${chapters[i].title}`,
            suggestion: "添加地点转移的明确描写，如'来到...'、'穿过...'等",
          });
          }
        }
      }
    }
    
    return violations;
  }

  /**
   * 检查世界观一致性
   */
  private checkWorldConsistency(
    chapters: any[],
    world: any
  ): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];
    
    const settingNotes = world.setting_notes || "";
    
    // 检测魔法元素
    const magicKeywords = ["魔法", "法术", "咒语", "魔力", "施法"];
    const hasMagicSetting = magicKeywords.some(k => settingNotes.includes(k));
    
    // 检测科技元素
    const techKeywords = ["电脑", "手机", "互联网", "汽车", "飞机"];
    const hasTechSetting = techKeywords.some(k => settingNotes.includes(k));
    
    for (let i = 0; i < chapters.length; i++) {
      const content = chapters[i].content || "";
      
      // 检测无魔世界中的魔法元素
      if (!hasMagicSetting) {
        const foundMagic = magicKeywords.filter(k => content.includes(k));
        if (foundMagic.length > 0) {
          violations.push({
            type: "fact",
            severity: "error",
            message: `世界设定为无魔法，但章节中出现了: ${foundMagic.join(", ")}`,
            location: `章节: ${chapters[i].title}`,
            suggestion: "移除魔法元素或修改世界设定",
          });
        }
      }
      
      // 检测低科技世界中的高科技元素
      if (!hasTechSetting) {
        const foundTech = techKeywords.filter(k => content.includes(k));
        if (foundTech.length > 2) { // 容忍少量提及
          violations.push({
            type: "fact",
            severity: "warning",
            message: `世界设定中未明确存在高科技，但章节中频繁出现: ${foundTech.slice(0, 3).join(", ")}`,
            location: `章节: ${chapters[i].title}`,
            suggestion: "添加科技设定或调整描写方式",
          });
        }
      }
    }
    
    return violations;
  }

  /**
   * 保存一致性检查日志
   */
  private async saveConsistencyLogs(
    storyId: string,
    violations: ConsistencyViolation[]
  ): Promise<void> {
    if (violations.length === 0) return;
    
    const db = await getDb();
    
    const logId = id("consistency");
    
    await db.run(
      `INSERT INTO consistency_check_logs (id, story_id, violations_json, created_at) VALUES (?, ?, ?, ?)`,
      [logId, storyId, JSON.stringify(violations), nowIso()]
    );
  }
}

// 导出单例
export const consistencyChecker = new ConsistencyChecker();
