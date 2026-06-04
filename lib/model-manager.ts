import { getDb, nowIso } from "@/lib/db";

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  baseUrl?: string;
  apiKey?: string;
  modelName: string;
  defaultTemperature?: number;
  maxTokens?: number;
  enabled: boolean;
}

export const defaultModels: ModelConfig[] = [
  {
    id: 'openai-gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    modelName: 'gpt-4',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    enabled: true,
  },
  {
    id: 'openai-gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    modelName: 'gpt-3.5-turbo',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    enabled: true,
  },
  {
    id: 'anthropic-claude-3',
    name: 'Claude 3',
    provider: 'anthropic',
    modelName: 'claude-3-opus-20240229',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    enabled: true,
  },
  {
    id: 'ollama-llama2',
    name: 'Llama 2 (Local)',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    modelName: 'llama2',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    enabled: false,
  },
];

export class ModelManager {
  static getAvailableModels(): ModelConfig[] {
    return defaultModels.filter(m => m.enabled);
  }

  static getModelConfig(modelId: string): ModelConfig | undefined {
    return defaultModels.find(m => m.id === modelId && m.enabled);
  }

  /**
   * 多模型降级链（见 docs/StoryForge_技术文档.md 5.8.5）：
   * 主模型在前，其余已启用模型按顺序作为备用，主模型失败时自动切换。
   */
  static getFallbackModelIds(primaryModelId: string): string[] {
    const ordered = [
      primaryModelId,
      ...defaultModels.filter(m => m.enabled).map(m => m.id),
    ];
    return Array.from(new Set(ordered)).filter(mid => !!this.getModelConfig(mid));
  }

  static async getUserDefaultModel(userId: string): Promise<string> {
    const db = await getDb();
    const row = await db.get<{ value: string }>(
      "SELECT value FROM user_settings WHERE user_id = ? AND key = 'default_model'",
      userId,
    );
    const modelId = row?.value;
    if (modelId && this.getModelConfig(modelId)) {
      return modelId;
    }
    return 'openai-gpt-4';
  }

  static async setUserDefaultModel(userId: string, modelId: string): Promise<boolean> {
    if (!this.getModelConfig(modelId)) return false;
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
    if (modelId && this.getModelConfig(modelId)) {
      return modelId;
    }
    return this.getUserDefaultModel(userId);
  }

  static async setSessionModel(sessionId: string, modelId: string): Promise<boolean> {
    if (!this.getModelConfig(modelId)) return false;
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
