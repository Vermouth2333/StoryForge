import { serverEnv } from "@/lib/server-env";

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
  const apiKey = serverEnv("SILICONFLOW_API_KEY");
  if (!apiKey) {
    console.warn("[media] SILICONFLOW_API_KEY 未配置，配图/配视频不可用");
    return null;
  }
  const baseUrl = (serverEnv("SILICONFLOW_BASE_URL") || DEFAULT_IMAGE_BASE_URL).replace(/\/+$/, "");
  return {
    provider: "siliconflow",
    baseUrl,
    apiKey,
    modelName: serverEnv("SILICONFLOW_IMAGE_MODEL") || DEFAULT_IMAGE_MODEL,
    videoModelName: serverEnv("SILICONFLOW_VIDEO_MODEL") || DEFAULT_VIDEO_MODEL,
    videoI2vModelName: serverEnv("SILICONFLOW_VIDEO_I2V_MODEL") || DEFAULT_VIDEO_I2V_MODEL,
  };
}

/** @deprecated 平台统一密钥，忽略 userId */
export async function resolveImageModel(_userId?: string): Promise<ImageModelConfig | null> {
  return resolvePlatformMediaConfig();
}
