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
  private static userDefaultModels: Map<string, string> = new Map();
  private static sessionModels: Map<string, string> = new Map();

  static getAvailableModels(): ModelConfig[] {
    return defaultModels.filter(m => m.enabled);
  }

  static getModelConfig(modelId: string): ModelConfig | undefined {
    return defaultModels.find(m => m.id === modelId && m.enabled);
  }

  static getUserDefaultModel(userId: string): string {
    return this.userDefaultModels.get(userId) || 'openai-gpt-4';
  }

  static setUserDefaultModel(userId: string, modelId: string): void {
    if (this.getModelConfig(modelId)) {
      this.userDefaultModels.set(userId, modelId);
    }
  }

  static getSessionModel(sessionId: string, userId: string): string {
    return this.sessionModels.get(sessionId) || this.getUserDefaultModel(userId);
  }

  static setSessionModel(sessionId: string, modelId: string): void {
    if (this.getModelConfig(modelId)) {
      this.sessionModels.set(sessionId, modelId);
    }
  }
}
