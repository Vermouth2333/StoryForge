/** Shared illustration look for stills and videos so they stay in the same family. */

export const SCENE_ILLUSTRATION_STYLE =
  "高质量中文网络小说场景插画，二次元绘本或厚涂插画质感，统一角色外形与配色，精致细节，不要真人写实摄影、不要文字水印字幕或对话框";

export const VIDEO_NEGATIVE_PROMPT =
  "photorealistic, live-action, real human, documentary, cinematic live footage, watermark, subtitle, text, logo, UI overlay, hard cut, jump cut, scene change, different character, costume change, new location";

/** Wan clips are ~5s each; 6 beats ≈ 30s after concat. */
export const VIDEO_BEAT_COUNT = 6;

const CAMERA_BEATS = [
  "同一构图下缓缓活动，交代人物呼吸与眼神。",
  "动作接着上一拍继续，不要换景换人。",
  "手势或姿态再推进一点，镜头跟着角色走。",
  "情绪加深，衣褶与发丝随动作轻动，仍在同一场景。",
  "互动到最明确的一拍，运镜连续。",
  "动作放缓，停在这段互动的结束姿态。",
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
    return chainBeatContext(padBeats(grouped, maxBeats, cleaned));
  }

  return chainBeatContext(padBeats(units, maxBeats, cleaned));
}

function chainBeatContext(beats: string[]): string[] {
  return beats.map((beat, i) => {
    if (i === 0) return beat;
    const prev = beats[i - 1].replace(/\s+/g, " ").trim().slice(-80);
    return `承接上一镜（${prev}），继续：${beat}`;
  });
}

export function buildIllustrationImagePrompt(reply: string) {
  const cleaned = reply.replace(/\s+/g, " ").trim().slice(0, 800);
  return `${SCENE_ILLUSTRATION_STYLE}。\n场景内容：${cleaned}`;
}

export function buildIllustrationT2vPrompt(reply: string, beatIndex = 0, beatCount = 1, storyArc = "") {
  const cleaned = reply.replace(/\s+/g, " ").trim().slice(0, 500);
  const arc = storyArc.replace(/\s+/g, " ").trim().slice(0, 180);
  const part =
    beatCount > 1
      ? `这是一条连贯短片的第${beatIndex + 1}/${beatCount}镜，必须接上上一镜，同一角色同一场景同一服装，不要硬切或重开一场。`
      : "把场景情节完整表现出来，动作与表情有起承转合。";
  const overview = arc ? `整段剧情提要：${arc}。` : "";
  return `${SCENE_ILLUSTRATION_STYLE}风格短视频。${overview}${part}画面保持插画质感，运镜连续稍缓。本镜：${cleaned}`;
}

export function buildIllustrationI2vPrompt(reply: string, beatIndex = 0, beatCount = 1, storyArc = "") {
  const cleaned = reply.replace(/\s+/g, " ").trim().slice(0, 480);
  const arc = storyArc.replace(/\s+/g, " ").trim().slice(0, 180);
  const overview = arc ? `整段剧情提要：${arc}。` : "";
  const part =
    beatCount > 1
      ? beatIndex === 0
        ? "从参考图起始姿态开始演第一镜，为后续镜头留下可接续的结束动作。"
        : "参考图是上一镜的最后一帧。必须从该姿态无缝接续，同一插画风格、同一角色外形服饰配色、同一场景光线，禁止换人换装换景，禁止硬切重开。"
      : "完整演绎这段对话情节，动作与表情有起承转合。";
  return `严格保持参考图的插画风格、角色外形、服饰与配色。${overview}${part}运镜连续稍缓，不要真人写实，不要字幕水印。本镜动态：${cleaned}`;
}
