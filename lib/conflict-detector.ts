import { getDb, id, nowIso } from "@/lib/db";

export type ConflictLevel = "P0" | "P1" | "P2";

export interface ConflictResult {
  level: ConflictLevel;
  conflictPoint: string;
  reason: string;
  rewriteSuggestions: string[];
  rewrittenInstruction: string;
  detectedAt: string;
}

export class ConflictDetector {
  /**
   * 检测内容冲突
   */
  async detect(
    content: string,
    worldId: string | null,
    characterIds: string[],
    storyId?: string,
  ): Promise<ConflictResult[]> {
    const conflicts: ConflictResult[] = [];

    // 1. 检测角色冲突
    if (characterIds.length > 0) {
      const characterConflicts = await this.detectCharacterConflicts(content, characterIds);
      conflicts.push(...characterConflicts);
    }

    // 2. 检测世界观冲突
    if (worldId) {
      const worldConflicts = await this.detectWorldConflicts(content, worldId);
      conflicts.push(...worldConflicts);
    }

    // 3. 检测基本逻辑冲突
    const basicConflicts = this.detectBasicConflicts(content);
    conflicts.push(...basicConflicts);

    // 保存冲突日志（统一由 saveConflictLogs 写入，调用方无需再写）
    await this.saveConflictLogs(content, conflicts, worldId, characterIds, storyId);

    return conflicts;
  }

  /**
   * 检测角色冲突（同一角色在不同地方表现不一致）
   */
  private async detectCharacterConflicts(
    content: string,
    characterIds: string[]
  ): Promise<ConflictResult[]> {
    const conflicts: ConflictResult[] = [];
    const db = await getDb();
    
    for (const charId of characterIds) {
      const character = await db.get("SELECT * FROM characters WHERE id = ?", [charId]);
      if (!character) continue;
      
      // 检查角色性格关键词
      const personalityKeywords = (character.personality || "")
        .split(/[,，、]/)
        .map((k: string) => k.trim())
        .filter((k: string) => k.length >= 2);
      
      // 检测性格反转（如果内容中出现了与性格相反的描述）
      const oppositePatterns: Record<string, string[]> = {
        "勇敢": ["害怕", "恐惧", "退缩", "逃跑"],
        "善良": ["残忍", "邪恶", "冷酷", "恶意"],
        "聪明": ["愚蠢", "笨", "傻", "无知"],
        "诚实": ["撒谎", "欺骗", "虚伪", "隐瞒"],
        "开朗": ["抑郁", "悲伤", "沉默", "忧郁"],
      };
      
      for (const keyword of personalityKeywords) {
        const opposites = oppositePatterns[keyword];
        if (!opposites) continue;
        
        for (const opposite of opposites) {
          if (content.includes(opposite)) {
            conflicts.push({
              level: "P1",
              conflictPoint: `角色 ${character.name} 性格描述为"${keyword}"，但文本中出现了相反特征"${opposite}"`,
              reason: `角色性格一致性检测：角色设定为${keyword}，但行为表现出${opposite}`,
              rewriteSuggestions: [
                `保持角色${keyword}的性格特征，避免表现${opposite}的行为`,
                `如果需要表现角色的成长或复杂性，可以添加过渡描写`,
              ],
              rewrittenInstruction: `注意：角色 ${character.name} 的核心性格是"${keyword}"，确保所有行为和言语都符合这一设定`,
              detectedAt: nowIso(),
            });
            break;
          }
        }
      }
      
      // 检测角色名字拼写不一致
      const nameVariations = this.getNameVariations(character.name);
      for (const variation of nameVariations) {
        if (variation !== character.name && content.includes(variation)) {
          // 这不是冲突，只是名称多样性，可以接受
        }
      }
    }
    
    return conflicts;
  }

  /**
   * 检测世界观冲突
   */
  private async detectWorldConflicts(content: string, worldId: string): Promise<ConflictResult[]> {
    const conflicts: ConflictResult[] = [];
    const db = await getDb();
    
    // 获取世界设定
    const world = await db.get("SELECT * FROM worlds WHERE id = ?", [worldId]);
    if (!world) return conflicts;
    
    // 获取世界知识库
    const knowledge = await db.all(
      "SELECT * FROM knowledge_entries WHERE world_id = ? ORDER BY sort_order",
      [worldId]
    );
    
    // 检测是否违反了世界规则
    const settingNotes = world.setting_notes || "";
    
    // 简单的规则检测：魔法、科技等设定关键词
    const magicKeywords = ["魔法", "法术", "咒语", "魔力"];
    const techKeywords = ["科技", "机械", "电脑", "互联网"];
    
    const hasMagicSetting = magicKeywords.some(k => settingNotes.includes(k));
    const hasTechSetting = techKeywords.some(k => settingNotes.includes(k));
    
    // 如果世界设定是低魔法但出现了高科技
    if (!hasMagicSetting && content.includes("施放魔法")) {
      conflicts.push({
        level: "P0",
        conflictPoint: "内容中出现了魔法元素，但世界设定中没有魔法",
        reason: "世界观一致性检测：当前世界设定为无魔法世界",
        rewriteSuggestions: [
          "将魔法元素替换为符合世界观的科技或技能",
          "如果需要魔法元素，需要先在世界设定中添加说明",
        ],
        rewrittenInstruction: "警告：当前世界设定为无魔法/低科技世界，所有内容必须符合此设定",
        detectedAt: nowIso(),
      });
    }
    
    if (!hasTechSetting && content.includes("电脑") && content.includes("互联网")) {
      conflicts.push({
        level: "P2",
        conflictPoint: "内容中出现了高科技元素，但世界设定中未提及科技",
        reason: "世界观一致性检测：世界设定中未明确存在高科技",
        rewriteSuggestions: [
          "添加科技设定说明",
          "或者将科技元素替换为更符合设定的描述",
        ],
        rewrittenInstruction: "注意：如果需要引入科技元素，请确保世界观设定中已有说明",
        detectedAt: nowIso(),
      });
    }
    
    // 检测知识库中已建立的事实是否被否定
    for (const entry of knowledge) {
      if (entry.body && content.includes(entry.title)) {
        // 检查内容是否否定了知识库中的事实
        const negationWords = ["不是", "并非", "不是", "没有", "从不", "从未"];
        for (const neg of negationWords) {
          if (content.includes(`${entry.title}${neg}`)) {
            conflicts.push({
              level: "P1",
              conflictPoint: `内容似乎否定了知识库中的设定"${entry.title}"`,
              reason: `知识库一致性检测：知识库中定义"${entry.title}"为真实事实`,
              rewriteSuggestions: [
                "确保不与已建立的知识库事实冲突",
                "如果需要修改知识库，请先更新知识库词条",
              ],
              rewrittenInstruction: `重要：知识库中已定义"${entry.title}"为事实，请确保内容符合此设定`,
              detectedAt: nowIso(),
            });
            break;
          }
        }
      }
    }
    
    return conflicts;
  }

  /**
   * 检测基本逻辑冲突
   */
  private detectBasicConflicts(content: string): ConflictResult[] {
    const conflicts: ConflictResult[] = [];
    
    // 检测时间线冲突
    const timeConflicts = this.detectTimelineConflicts(content);
    conflicts.push(...timeConflicts);
    
    // 检测基本逻辑冲突
    const basicLogicConflicts = this.detectBasicLogicConflicts(content);
    conflicts.push(...basicLogicConflicts);
    
    return conflicts;
  }

  /**
   * 检测时间线冲突
   */
  private detectTimelineConflicts(content: string): ConflictResult[] {
    const conflicts: ConflictResult[] = [];
    
    // 简单的季节冲突检测
    const springKeywords = ["春天", "春暖花开", "万物复苏"];
    const winterKeywords = ["冬天", "大雪", "寒冷", "冰封"];
    
    const hasSpring = springKeywords.some(k => content.includes(k));
    const hasWinter = winterKeywords.some(k => content.includes(k));
    
    if (hasSpring && hasWinter) {
      conflicts.push({
        level: "P2",
        conflictPoint: "文本同时出现了春天和冬天的描写",
        reason: "时间一致性检测：同一场景中季节描述矛盾",
        rewriteSuggestions: [
          "统一季节描写，选择一个主要季节",
          "如果是穿越或特殊场景，需要明确说明",
        ],
        rewrittenInstruction: "注意：保持季节描写的一致性，避免同时出现矛盾的季节特征",
        detectedAt: nowIso(),
      });
    }
    
    return conflicts;
  }

  /**
   * 检测基本逻辑冲突
   */
  private detectBasicLogicConflicts(content: string): ConflictResult[] {
    const conflicts: ConflictResult[] = [];
    
    // 检测死亡后又行动的冲突
    if ((content.includes("死了") || content.includes("死亡") || content.includes("断气")) 
        && (content.includes("站起来") || content.includes("走向") || content.includes("说话"))) {
      // 需要更复杂的上下文判断，这里简单检测
      const deathPatterns = [/已经死了/, /已经断气/, /已经没有呼吸/];
      const actionPatterns = [/站起来/, /走向/, /继续说话/, /睁开眼睛/];
      
      for (const deathPat of deathPatterns) {
        if (deathPat.test(content)) {
          for (const actionPat of actionPatterns) {
            if (actionPat.test(content)) {
              conflicts.push({
                level: "P0",
                conflictPoint: "文本中角色已经死亡，但又进行了行动",
                reason: "基本逻辑冲突：死人不能自主行动",
                rewriteSuggestions: [
                  "如果角色复活，需要明确说明",
                  "如果是对话中的描述，需要调整表达方式",
                ],
                rewrittenInstruction: "警告：如果角色已经死亡，不能自主行动。如需复活，请明确说明",
                detectedAt: nowIso(),
              });
              break;
            }
          }
        }
      }
    }
    
    return conflicts;
  }

  /**
   * 获取名字的可能变体
   */
  private getNameVariations(name: string): string[] {
    if (!name) return [];
    return [
      name,
      name.replace(/·/g, ""),
      name.replace(/·/g, " "),
      name.charAt(0), // 只保留姓氏
    ];
  }

  /**
   * 保存冲突日志
   */
  private async saveConflictLogs(
    content: string,
    conflicts: ConflictResult[],
    worldId: string | null,
    characterIds: string[],
    storyId?: string,
  ): Promise<void> {
    if (conflicts.length === 0) return;

    const db = await getDb();

    for (const conflict of conflicts) {
      const logId = id("conflict");

      await db.run(
        `INSERT INTO conflict_detection_logs
         (id, story_id, world_id, content, conflict_level, conflict_details_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          logId,
          storyId ?? null,
          worldId,
          content.slice(0, 500), // 只保存前500字
          conflict.level,
          JSON.stringify({ ...conflict, characterIds, storyId }),
          nowIso(),
        ]
      );
    }
  }

  /**
   * 生成解释式改写建议
   */
  generateRewriteSuggestions(conflict: ConflictResult): string {
    if (conflict.rewriteSuggestions.length === 0) {
      return "";
    }
    
    const suggestions = conflict.rewriteSuggestions
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n");
    
    return `【改写建议】\n${suggestions}\n\n【修改指令】\n${conflict.rewrittenInstruction}`;
  }
}

// 导出单例
export const conflictDetector = new ConflictDetector();
