/** Shared illustration look for stills and videos so they stay in the same family. */

export const SCENE_ILLUSTRATION_STYLE =
  "高质量中文网络小说场景插画，二次元绘本或厚涂插画质感，统一角色外形与配色，精致细节，不要真人写实摄影、不要文字水印字幕或对话框";

export const VIDEO_NEGATIVE_PROMPT =
  "photorealistic, live-action, real human, documentary, cinematic live footage, watermark, subtitle, text, logo, UI overlay";

/** Wan clips are ~5s each; 6 beats ≈ 30s after concat. */
export const VIDEO_BEAT_COUNT = 6;

const CAMERA_BEATS = [
  "开场远景建立，缓慢推进，交代人物站位、光线与环境。",
  "推近到角色上半身，眼神与微表情开始变化。",
  "角色做出与对白对应的动作，衣褶与发丝随动作轻动。",
  "镜头略侧移，带过道具或环境细节，气氛继续推进。",
  "角色反应加大一档，动作与气息更明确。",
  "收束：镜头略拉远或定住，表情落到这段互动的结束态。",
];

function padBeats(chunks: string[], maxBeats: number, source: string): string[] {
  const beats = chunks.filter(Boolean);
  const hint = source.slice(0, 240);
  while (beats.length < maxBeats) {
    const cam = CAMERA_BEATS[beats.length % CAMERA_BEATS.length];
    beats.push(`${cam}情节：${hint}`);
  }
  return beats.slice(0, maxBeats);
}

export function splitSceneBeats(reply: string, maxBeats = VIDEO_BEAT_COUNT): string[] {
  const cleaned = reply.replace(/\s+/g, " ").trim() || "角色在场景中缓慢活动，表情与气息随情节变化";
  const sentences = cleaned
    .split(/(?<=[。！？!?；;])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const units = sentences.length ? sentences : [cleaned];

  if (units.length >= maxBeats) {
    const size = Math.ceil(units.length / maxBeats);
    const grouped: string[] = [];
    for (let i = 0; i < maxBeats; i++) {
      const chunk = units.slice(i * size, (i + 1) * size).join("");
      if (chunk) grouped.push(chunk);
    }
    return padBeats(grouped, maxBeats, cleaned);
  }

  return padBeats(units, maxBeats, cleaned);
}

export function buildIllustrationImagePrompt(reply: string) {
  const cleaned = reply.replace(/\s+/g, " ").trim().slice(0, 800);
  return `${SCENE_ILLUSTRATION_STYLE}。\n场景内容：${cleaned}`;
}

export function buildIllustrationT2vPrompt(reply: string, beatIndex = 0, beatCount = 1) {
  const cleaned = reply.replace(/\s+/g, " ").trim().slice(0, 700);
  const part =
    beatCount > 1
      ? `这是第${beatIndex + 1}/${beatCount}段，约5秒，请把本段情节完整演完，动作连贯、表情有变化。`
      : "把场景情节完整表现出来，动作与表情有起承转合。";
  return `${SCENE_ILLUSTRATION_STYLE}风格短视频。${part}画面保持插画质感，运镜稍缓以便看清对话情节。场景：${cleaned}`;
}

export function buildIllustrationI2vPrompt(reply: string, beatIndex = 0, beatCount = 1) {
  const cleaned = reply.replace(/\s+/g, " ").trim().slice(0, 600);
  const part =
    beatCount > 1
      ? `这是第${beatIndex + 1}/${beatCount}段动态。${
          beatIndex === 0
            ? "从参考图起始姿态开始演这段情节。"
            : "承接前一段动作继续往下演，不要跳戏或换成别人。"
        }`
      : "完整演绎这段对话情节，动作与表情有起承转合。";
  return `严格保持参考图的插画风格、角色外形、服饰与配色。${part}运镜稍缓，不要变成真人写实，不要字幕水印。动态内容：${cleaned}`;
}
