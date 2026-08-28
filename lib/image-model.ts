export const DEFAULT_IMAGE_BASE_URL = "https://api.siliconflow.cn/v1";
export const DEFAULT_IMAGE_MODEL = "Kwai-Kolors/Kolors";
export const DEFAULT_VIDEO_MODEL = "Wan-AI/Wan2.2-T2V-A14B";
export const DEFAULT_VIDEO_I2V_MODEL = "Wan-AI/Wan2.2-I2V-A14B";

export type ImageModelConfig = {
  provider: "siliconflow";
  baseUrl: string;
  apiKey: string;
  modelName: string;
  videoModelName: string;
  videoI2vModelName: string;
};

export function resolvePlatformMediaConfig(): ImageModelConfig | null {
  const apiKey = (process.env.SILICONFLOW_API_KEY ?? "").trim();
  if (!apiKey) return null;
  const baseUrl = (process.env.SILICONFLOW_BASE_URL || DEFAULT_IMAGE_BASE_URL).replace(/\/+$/, "");
  return {
    provider: "siliconflow",
    baseUrl,
    apiKey,
    modelName: (process.env.SILICONFLOW_IMAGE_MODEL || DEFAULT_IMAGE_MODEL).trim(),
    videoModelName: (process.env.SILICONFLOW_VIDEO_MODEL || DEFAULT_VIDEO_MODEL).trim(),
    videoI2vModelName: (process.env.SILICONFLOW_VIDEO_I2V_MODEL || DEFAULT_VIDEO_I2V_MODEL).trim(),
  };
}

/** @deprecated 平台统一密钥，忽略 userId */
export async function resolveImageModel(_userId?: string): Promise<ImageModelConfig | null> {
  return resolvePlatformMediaConfig();
}
