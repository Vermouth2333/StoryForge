export type AvatarStyle = 'anime' | 'realistic' | 'cartoon' | 'fantasy';

export interface AvatarGenerationOptions {
  style: AvatarStyle;
  description?: string;
}

export class AvatarGenerator {
  /**
   * 调用 OpenAI DALL-E 3 生成角色头像。
   * 需要配置 OPENAI_API_KEY 环境变量，否则返回 null。
   */
  static async generateAvatar(
    characterDescription: string,
    options: AvatarGenerationOptions
  ): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('Avatar generation skipped: OPENAI_API_KEY not configured');
      return null;
    }

    try {
      const prompt = this.buildPrompt(characterDescription, options);
      const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
      const imageModel = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";

      const res = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: imageModel,
          prompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
          response_format: "url",
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error('Avatar generation API error:', res.status, detail);
        return null;
      }

      const json = (await res.json()) as {
        data?: Array<{ url?: string; b64_json?: string }>;
      };

      const imageUrl = json.data?.[0]?.url;
      if (!imageUrl) {
        console.error('Avatar generation: no image URL in response');
        return null;
      }

      return imageUrl;
    } catch (error) {
      console.error('Avatar generation error:', error);
      return null;
    }
  }

  private static buildPrompt(
    description: string,
    options: AvatarGenerationOptions
  ): string {
    const stylePrompts: Record<AvatarStyle, string> = {
      anime: 'anime style, detailed, vibrant colors',
      realistic: 'realistic portrait, photorealistic, high detail',
      cartoon: 'cartoon style, simple, bold lines, vibrant',
      fantasy: 'fantasy illustration, detailed, magical, epic',
    };

    return `Character portrait: ${description}. ${stylePrompts[options.style]}. Portrait only, clear face, high quality.`;
  }

  static getAvailableStyles(): AvatarStyle[] {
    return ['anime', 'realistic', 'cartoon', 'fantasy'];
  }
}
