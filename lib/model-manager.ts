import { getDb, id, nowIso } from "@/lib/db";

export interface ModelConfig {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "ollama" | "custom";
  baseUrl?: string;
  apiKey?: string;
  modelName: string;
  defaultTemperature?: number;
  maxTokens?: number;
  enabled: boolean;
}

interface UserModelRow {
  id: string;
  user_id: string;
  name: string;
  provider: string;
  base_url: string | null;
  api_key_encrypted: string | null;
  model_name: string;
  default_temperature: number;
  max_tokens: number;
  enabled: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function rowToConfig(row: UserModelRow): ModelConfig {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as ModelConfig["provider"],
    baseUrl: row.base_url ?? undefined,
    apiKey: row.api_key_encrypted ?? undefined,
    modelName: row.model_name,
    defaultTemperature: row.default_temperature,
    maxTokens: row.max_tokens,
    enabled: row.enabled === 1,
  };
}

export class ModelManager {
  /** 获取用户所有已启用的模型 */
  static async getUserModels(userId: string): Promise<ModelConfig[]> {
    const db = await getDb();
    const rows = await db.all<UserModelRow[]>(
      "SELECT * FROM user_models WHERE user_id = ? ORDER BY sort_order, created_at",
      userId,
    );
    return rows.map(rowToConfig);
  }

  /** 获取用户所有模型（含禁用） */
  static async getAllUserModels(userId: string): Promise<ModelConfig[]> {
    const db = await getDb();
    const rows = await db.all<UserModelRow[]>(
      "SELECT * FROM user_models WHERE user_id = ? ORDER BY sort_order, created_at",
      userId,
    );
    return rows.map(rowToConfig);
  }

  /** 获取单个模型配置 */
  static async getModelConfig(modelId: string, userId: string): Promise<ModelConfig | undefined> {
    const db = await getDb();
    const row = await db.get<UserModelRow>(
      "SELECT * FROM user_models WHERE id = ? AND user_id = ?",
      modelId,
      userId,
    );
    return row ? rowToConfig(row) : undefined;
  }

  /** 创建用户模型 */
  static async createModel(
    userId: string,
    data: {
      name: string;
      provider: string;
      baseUrl?: string;
      apiKey?: string;
      modelName: string;
      defaultTemperature?: number;
      maxTokens?: number;
      enabled?: boolean;
    },
  ): Promise<ModelConfig> {
    const db = await getDb();
    const modelId = id("model");
    const now = nowIso();
    await db.run(
      `INSERT INTO user_models (id, user_id, name, provider, base_url, api_key_encrypted, model_name, default_temperature, max_tokens, enabled, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      modelId,
      userId,
      data.name,
      data.provider,
      data.baseUrl ?? null,
      data.apiKey ?? null,
      data.modelName,
      data.defaultTemperature ?? 0.7,
      data.maxTokens ?? 4096,
      data.enabled !== false ? 1 : 0,
      now,
      now,
    );
    return (await this.getModelConfig(modelId, userId))!;
  }

  /** 更新用户模型 */
  static async updateModel(
    modelId: string,
    userId: string,
    data: {
      name?: string;
      provider?: string;
      baseUrl?: string;
      apiKey?: string;
      modelName?: string;
      defaultTemperature?: number;
      maxTokens?: number;
      enabled?: boolean;
    },
  ): Promise<ModelConfig | undefined> {
    const db = await getDb();
    const existing = await this.getModelConfig(modelId, userId);
    if (!existing) return undefined;

    const sets: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { sets.push("name = ?"); values.push(data.name); }
    if (data.provider !== undefined) { sets.push("provider = ?"); values.push(data.provider); }
    if (data.baseUrl !== undefined) { sets.push("base_url = ?"); values.push(data.baseUrl || null); }
    if (data.apiKey !== undefined) { sets.push("api_key_encrypted = ?"); values.push(data.apiKey || null); }
    if (data.modelName !== undefined) { sets.push("model_name = ?"); values.push(data.modelName); }
    if (data.defaultTemperature !== undefined) { sets.push("default_temperature = ?"); values.push(data.defaultTemperature); }
    if (data.maxTokens !== undefined) { sets.push("max_tokens = ?"); values.push(data.maxTokens); }
    if (data.enabled !== undefined) { sets.push("enabled = ?"); values.push(data.enabled ? 1 : 0); }

    if (sets.length > 0) {
      sets.push("updated_at = ?");
      values.push(nowIso());
      values.push(modelId, userId);
      await db.run(`UPDATE user_models SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, ...values);
    }

    return this.getModelConfig(modelId, userId);
  }

  /** 删除用户模型 */
  static async deleteModel(modelId: string, userId: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.run(
      "DELETE FROM user_models WHERE id = ? AND user_id = ?",
      modelId,
      userId,
    );
    return (result.changes ?? 0) > 0;
  }

  /**
   * 多模型降级链（见 docs/StoryForge_技术文档.md 5.8.5）：
   * 主模型在前，其余已启用模型按顺序作为备用，主模型失败时自动切换。
   */
  static async getFallbackModelIds(primaryModelId: string, userId: string): Promise<string[]> {
    const models = await this.getUserModels(userId);
    const enabled = models.filter((m) => m.enabled);
    const ordered = [
      primaryModelId,
      ...enabled.map((m) => m.id),
    ];
    return Array.from(new Set(ordered)).filter((mid) => enabled.some((m) => m.id === mid));
  }

  static async getUserDefaultModel(userId: string): Promise<string> {
    const db = await getDb();
    const row = await db.get<{ value: string }>(
      "SELECT value FROM user_settings WHERE user_id = ? AND key = 'default_model'",
      userId,
    );
    const modelId = row?.value;
    if (modelId && (await this.getModelConfig(modelId, userId))) {
      return modelId;
    }
    // 返回用户第一个已启用的模型
    const models = await this.getUserModels(userId);
    return models.find((m) => m.enabled)?.id ?? "";
  }

  static async setUserDefaultModel(userId: string, modelId: string): Promise<boolean> {
    const model = await this.getModelConfig(modelId, userId);
    if (!model) return false;
    const db = await getDb();
    await db.run(
      `INSERT INTO user_settings (user_id, key, value, updated_at)
       VALUES (?, 'default_model', ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      userId,
      modelId,
      nowIso(),
    );
    return true;
  }

  static async getSessionModel(sessionId: string, userId: string): Promise<string> {
    const db = await getDb();
    const row = await db.get<{ model_id: string | null }>(
      "SELECT model_id FROM chat_sessions WHERE id = ?",
      sessionId,
    );
    const modelId = row?.model_id ?? undefined;
    if (modelId && (await this.getModelConfig(modelId, userId))) {
      return modelId;
    }
    return this.getUserDefaultModel(userId);
  }

  static async setSessionModel(sessionId: string, modelId: string, userId: string): Promise<boolean> {
    const model = await this.getModelConfig(modelId, userId);
    if (!model) return false;
    const db = await getDb();
    await db.run(
      "UPDATE chat_sessions SET model_id = ?, updated_at = ? WHERE id = ?",
      modelId,
      nowIso(),
      sessionId,
    );
    return true;
  }
}
