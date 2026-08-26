"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { message } from "antd";
import { useState } from "react";
import CoverFileField from "@/components/CoverFileField";
import { WorkTypeIcon } from "@/components/icons";
import { PageHero } from "@/components/PageHero";
import WorkImportPanel from "@/components/WorkImportPanel";
import { uploadWorkCover } from "@/lib/upload-cover";
import type { WorkImportFields } from "@/components/WorkImportPanel";

export default function ComposePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: "story" | "character" | "world" | "persona" =
    tabParam === "character" || tabParam === "world" || tabParam === "persona" ? tabParam : "story";
  const [createTab, setCreateTab] = useState<"story" | "character" | "world" | "persona">(initialTab);
  const [storyTitle, setStoryTitle] = useState("");
  const [storySummary, setStorySummary] = useState("");
  const [storyTags, setStoryTags] = useState("");
  const [storyGreeting, setStoryGreeting] = useState("");
  const [storyCoverFile, setStoryCoverFile] = useState<File | null>(null);
  const [storyBusy, setStoryBusy] = useState(false);
  // 角色卡表单
  const [charName, setCharName] = useState("");
  const [charSummary, setCharSummary] = useState("");
  const [charPersonality, setCharPersonality] = useState("");
  const [charGreeting, setCharGreeting] = useState("");
  const [charAppearance, setCharAppearance] = useState("");
  const [charBackground, setCharBackground] = useState("");
  const [charSpeechStyle, setCharSpeechStyle] = useState("");
  const [charLikesDislikes, setCharLikesDislikes] = useState("");
  const [charTags, setCharTags] = useState("");
  const [charCoverFile, setCharCoverFile] = useState<File | null>(null);
  const [charBusy, setCharBusy] = useState(false);
  // 世界卡表单
  const [worldName, setWorldName] = useState("");
  const [worldSummary, setWorldSummary] = useState("");
  const [worldSetting, setWorldSetting] = useState("");
  const [worldTags, setWorldTags] = useState("");
  const [worldGreeting, setWorldGreeting] = useState("");
  const [worldCoverFile, setWorldCoverFile] = useState<File | null>(null);
  const [worldBusy, setWorldBusy] = useState(false);
  const [personaName, setPersonaName] = useState("");
  const [personaSummary, setPersonaSummary] = useState("");
  const [personaAppearance, setPersonaAppearance] = useState("");
  const [personaPersonality, setPersonaPersonality] = useState("");
  const [personaBackground, setPersonaBackground] = useState("");
  const [personaSpeechStyle, setPersonaSpeechStyle] = useState("");
  const [personaTags, setPersonaTags] = useState("");
  const [personaBusy, setPersonaBusy] = useState(false);

  function applyImport(kind: "story" | "character" | "world" | "persona", data: WorkImportFields) {
    const tags = (data.tags ?? []).join(", ");
    if (kind === "story") {
      setStoryTitle(data.title);
      setStorySummary(data.summary);
      setStoryGreeting(data.greeting ?? "");
      setStoryTags(tags);
      return;
    }
    if (kind === "character") {
      setCharName(data.title);
      setCharSummary(data.summary);
      setCharPersonality(data.personality ?? "");
      setCharAppearance(data.appearance ?? "");
      setCharBackground(data.background ?? "");
      setCharSpeechStyle(data.speech_style ?? "");
      setCharLikesDislikes(data.likes_dislikes ?? "");
      setCharGreeting(data.greeting ?? "");
      setCharTags(tags);
      return;
    }
    if (kind === "persona") {
      setPersonaName(data.title);
      setPersonaSummary(data.summary);
      setPersonaAppearance(data.appearance ?? "");
      setPersonaPersonality(data.personality ?? "");
      setPersonaBackground(data.background ?? "");
      setPersonaSpeechStyle(data.speech_style ?? "");
      setPersonaTags(tags);
      return;
    }
    setWorldName(data.title);
    setWorldSummary(data.summary);
    setWorldSetting(data.setting_notes ?? "");
    setWorldGreeting(data.greeting ?? "");
    setWorldTags(tags);
  }

  async function createStory(e: React.FormEvent) {
    e.preventDefault();
    if (!storyTitle.trim()) {
      message.error("故事标题不能为空");
      return;
    }
    setStoryBusy(true);
    const tags = storyTags
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);
    const res = await fetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: storyTitle.trim(),
        summary: storySummary,
        greeting: storyGreeting,
        tags,
      }),
    });
    const json = await res.json();
    if (json.code === 200) {
      const id = json.data.id as string;
      if (storyCoverFile) {
        const upload = await uploadWorkCover(`/api/stories/${id}/cover`, storyCoverFile);
        if (!upload.ok) {
          message.warning(upload.msg ?? "故事已创建，但封面上传失败");
        }
      }
      message.success("故事已创建");
      router.push(`/stories/${id}/edit`);
    } else {
      message.error(json.msg ?? "创建故事失败");
    }
    setStoryBusy(false);
  }

  async function createCharacter(e: React.FormEvent) {
    e.preventDefault();
    if (!charName.trim()) {
      message.error("角色名称不能为空");
      return;
    }
    setCharBusy(true);
    const tags = charTags.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 10);
    const res = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: charName.trim(), summary: charSummary, personality: charPersonality,
        appearance: charAppearance, background: charBackground, speech_style: charSpeechStyle,
        likes_dislikes: charLikesDislikes, greeting: charGreeting, tags,
      }),
    });
    const json = await res.json();
    if (json.code === 200) {
      const id = json.data.id as string;
      if (charCoverFile) {
        const upload = await uploadWorkCover(`/api/characters/${id}/cover`, charCoverFile);
        if (!upload.ok) {
          message.warning(upload.msg ?? "角色已创建，但封面上传失败");
        }
      }
      message.success("角色卡创建成功");
      router.push(`/characters/${id}`);
    } else {
      message.error(json.msg ?? "创建失败");
    }
    setCharBusy(false);
  }

  async function createWorld(e: React.FormEvent) {
    e.preventDefault();
    if (!worldName.trim()) {
      message.error("世界名称不能为空");
      return;
    }
    setWorldBusy(true);
    const tags = worldTags.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 10);
    const res = await fetch("/api/worlds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: worldName.trim(), summary: worldSummary, setting_notes: worldSetting, greeting: worldGreeting, tags }),
    });
    const json = await res.json();
    if (json.code === 200) {
      const id = json.data.id as string;
      if (worldCoverFile) {
        const upload = await uploadWorkCover(`/api/worlds/${id}/cover`, worldCoverFile);
        if (!upload.ok) {
          message.warning(upload.msg ?? "世界已创建，但封面上传失败");
        }
      }
      message.success("世界卡创建成功");
      router.push(`/worlds/${id}`);
    } else {
      message.error(json.msg ?? "创建失败");
    }
    setWorldBusy(false);
  }

  async function createPersona(e: React.FormEvent) {
    e.preventDefault();
    if (!personaName.trim()) {
      message.error("面具名称不能为空");
      return;
    }
    setPersonaBusy(true);
    try {
      const tags = personaTags.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 10);
      const res = await fetch("/api/persona-masks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: personaName.trim(), summary: personaSummary, appearance: personaAppearance,
          personality: personaPersonality, background: personaBackground,
          speech_style: personaSpeechStyle, tags,
        }),
      });
      const json = await res.json();
      if (json.code === 200) {
        message.success("人设面具创建成功");
        router.push(json.data?.id ? `/persona-masks/${json.data.id}` : "/my");
      } else {
        message.error(json.msg ?? "创建失败");
      }
    } finally {
      setPersonaBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHero
        title="创作工作台"
        subtitle="创建故事、角色卡或世界卡，创建后进入对应编辑页继续完善"
      />

      {/* 创建类型切换 Tab */}
      <div className="sf-card flex flex-wrap items-center gap-2 p-3">
        {([
          { key: "story", label: "故事" },
          { key: "character", label: "角色卡" },
          { key: "world", label: "世界卡" },
          { key: "persona", label: "人设面具" },
        ] as const).map((t) => {
          const active = createTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setCreateTab(t.key)}
              aria-pressed={active}
              className={
                "sf-tag inline-flex items-center gap-1.5 transition-all duration-150 " +
                (active
                  ? "bg-[#3f86f5] text-white border-[#3f86f5] shadow-[0_4px_12px_rgba(63,134,245,0.35)] font-medium scale-[1.03]"
                  : "hover:border-[#3f86f5] hover:text-[#3f86f5]")
              }
            >
              <WorkTypeIcon type={t.key} size="sm" />
              {t.label}
            </button>
          );
        })}
      </div>

      {createTab === "persona" && (
        <form onSubmit={createPersona} className="sf-card space-y-5 p-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#5B9DFF]">私有身份</p>
            <h3 className="text-lg font-semibold text-[#1F2A44]">创建人设面具</h3>
            <p className="mt-1 text-sm text-[#5B6B8C]">面具代表你在互动中的身份，仅自己可见，不会上架市场。</p>
          </div>
          <WorkImportPanel kind="persona" onParsed={(data) => applyImport("persona", data)} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">名称 <span className="text-red-500">*</span></label>
            <input className="sf-input w-full" placeholder="如：旅人小羽" value={personaName} onChange={(e) => setPersonaName(e.target.value)} maxLength={120} />
          </div>
          {[
            ["简介", personaSummary, setPersonaSummary, "简要描述你扮演的身份与处境…"],
            ["外貌", personaAppearance, setPersonaAppearance, "描述外貌：身高、发型、穿着等…"],
            ["性格", personaPersonality, setPersonaPersonality, "描述性格特质、处事态度、优缺点…"],
            ["背景", personaBackground, setPersonaBackground, "描述过往经历、出身与关键记忆…"],
            ["说话风格", personaSpeechStyle, setPersonaSpeechStyle, "描述语气、口头禅、常用表达方式…"],
          ].map(([label, value, setter, ph]) => (
            <div key={label as string}>
              <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">{label as string}</label>
              <textarea
                className="sf-input min-h-24 w-full resize-y"
                placeholder={ph as string}
                value={value as string}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              />
            </div>
          ))}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">标签</label>
            <input className="sf-input w-full" placeholder="用逗号或空格分隔，如：旅人, 冷静, 观察者" value={personaTags} onChange={(e) => setPersonaTags(e.target.value)} />
          </div>
          <button type="submit" className="sf-btn-primary" disabled={personaBusy}>{personaBusy ? "创建中..." : "创建人设面具"}</button>
        </form>
      )}

      {/* 角色卡创建表单 */}
      {createTab === "character" && (
        <form onSubmit={createCharacter} className="sf-card space-y-5 p-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#5B9DFF]">创作</p>
            <h3 className="text-lg font-semibold text-[#1F2A44]">创建角色卡</h3>
            <p className="mt-1 text-sm text-[#5B6B8C]">创建独立的角色卡，可直接对话测试，也可引入到故事项目中。</p>
          </div>
          <WorkImportPanel kind="character" onParsed={(data) => applyImport("character", data)} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">角色名称 <span className="text-red-500">*</span></label>
            <input className="sf-input w-full" placeholder="如：林晓月" value={charName} onChange={(e) => setCharName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">简介</label>
            <textarea className="sf-input w-full min-h-20 resize-y" placeholder="简要描述角色的身份、特征..." value={charSummary} onChange={(e) => setCharSummary(e.target.value)} maxLength={1000} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">性格与动机</label>
            <textarea className="sf-input w-full min-h-28 resize-y" placeholder="描述角色的性格特质、说话风格、核心动机、内心冲突等..." value={charPersonality} onChange={(e) => setCharPersonality(e.target.value)} maxLength={8000} />
          </div>
          {[
            ["外貌", charAppearance, setCharAppearance, "描述角色的外貌特征：身高、体型、发色、穿着等…"],
            ["背景经历", charBackground, setCharBackground, "描述角色的过往经历、成长环境、关键记忆等…"],
            ["说话风格", charSpeechStyle, setCharSpeechStyle, "描述语气、口头禅、常用表达方式…"],
            ["喜好与厌恶", charLikesDislikes, setCharLikesDislikes, "描述角色喜欢什么、讨厌什么…"],
            ["开场语", charGreeting, setCharGreeting, "创建会话后由角色先说出的第一句话…"],
          ].map(([label, value, setter, ph]) => (
            <div key={label as string}>
              <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">{label as string}</label>
              <textarea
                className="sf-input min-h-24 w-full resize-y"
                placeholder={ph as string}
                value={value as string}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              />
            </div>
          ))}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">标签</label>
            <input className="sf-input w-full" placeholder="用逗号或空格分隔，如：剑客, 傲娇, 古风" value={charTags} onChange={(e) => setCharTags(e.target.value)} />
            <p className="mt-1 text-xs text-[#5B6B8C]">最多 10 个标签，每个最长 30 字</p>
          </div>
          <CoverFileField file={charCoverFile} onChange={setCharCoverFile} />
          <div className="flex gap-3 pt-2">
            <button type="submit" className="sf-btn-primary" disabled={charBusy}>{charBusy ? "创建中..." : "创建角色卡"}</button>
            <button type="button" className="sf-btn-secondary" onClick={() => { setCharName(""); setCharSummary(""); setCharPersonality(""); setCharTags(""); setCharCoverFile(null); }}>清空</button>
          </div>
        </form>
      )}

      {/* 世界卡创建表单 */}
      {createTab === "world" && (
        <form onSubmit={createWorld} className="sf-card space-y-5 p-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#5B9DFF]">创作</p>
            <h3 className="text-lg font-semibold text-[#1F2A44]">创建世界卡</h3>
            <p className="mt-1 text-sm text-[#5B6B8C]">创建独立的世界卡，定义世界观设定，可直接对话探索，也可引入到故事项目中。</p>
          </div>
          <WorkImportPanel kind="world" onParsed={(data) => applyImport("world", data)} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">世界名称 <span className="text-red-500">*</span></label>
            <input className="sf-input w-full" placeholder="如：赛博朋克夜之城" value={worldName} onChange={(e) => setWorldName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">简介</label>
            <textarea className="sf-input w-full min-h-20 resize-y" placeholder="简要描述世界的核心概念、时代背景..." value={worldSummary} onChange={(e) => setWorldSummary(e.target.value)} maxLength={1000} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">世界设定</label>
            <textarea className="sf-input w-full min-h-36 resize-y" placeholder="描述世界的核心规则、社会体系、科技水平、地理环境、历史大事件等..." value={worldSetting} onChange={(e) => setWorldSetting(e.target.value)} maxLength={8000} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">开场语</label>
            <textarea
              className="sf-input min-h-24 w-full resize-y"
              placeholder="创建会话后由世界先说出的第一句话…"
              value={worldGreeting}
              onChange={(e) => setWorldGreeting(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">标签</label>
            <input className="sf-input w-full" placeholder="用逗号或空格分隔，如：赛博朋克, 反乌托邦, 未来" value={worldTags} onChange={(e) => setWorldTags(e.target.value)} />
            <p className="mt-1 text-xs text-[#5B6B8C]">最多 10 个标签，每个最长 30 字</p>
          </div>
          <CoverFileField file={worldCoverFile} onChange={setWorldCoverFile} />
          <div className="flex gap-3 pt-2">
            <button type="submit" className="sf-btn-primary" disabled={worldBusy}>{worldBusy ? "创建中..." : "创建世界卡"}</button>
            <button type="button" className="sf-btn-secondary" onClick={() => { setWorldName(""); setWorldSummary(""); setWorldSetting(""); setWorldTags(""); setWorldCoverFile(null); }}>清空</button>
          </div>
        </form>
      )}

      {/* 故事创建表单 */}
      {createTab === "story" && (
        <form onSubmit={createStory} className="sf-card space-y-5 p-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#5B9DFF]">创作</p>
            <h3 className="text-lg font-semibold text-[#1F2A44]">创建故事</h3>
            <p className="mt-1 text-sm text-[#5B6B8C]">填写基本信息与封面，创建后进入编辑页完善大纲与角色设定。</p>
          </div>
          <WorkImportPanel kind="story" onParsed={(data) => applyImport("story", data)} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">故事标题 <span className="text-red-500">*</span></label>
            <input className="sf-input w-full" placeholder="如：赛博朋克2077-初次相遇" value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">简介</label>
            <textarea className="sf-input w-full min-h-20 resize-y" placeholder="简要描述故事背景、核心冲突..." value={storySummary} onChange={(e) => setStorySummary(e.target.value)} maxLength={1000} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">开场语</label>
            <textarea
              className="sf-input min-h-24 w-full resize-y"
              placeholder="创建会话后由故事先说出的第一句话…"
              value={storyGreeting}
              onChange={(e) => setStoryGreeting(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">标签</label>
            <input className="sf-input w-full" placeholder="用逗号或空格分隔，如：赛博朋克, 悬疑, 长篇" value={storyTags} onChange={(e) => setStoryTags(e.target.value)} />
            <p className="mt-1 text-xs text-[#5B6B8C]">最多 10 个标签，每个最长 30 字</p>
          </div>
          <CoverFileField file={storyCoverFile} onChange={setStoryCoverFile} />
          <div className="flex gap-3 pt-2">
            <button type="submit" className="sf-btn-primary" disabled={storyBusy}>{storyBusy ? "创建中..." : "创建故事"}</button>
            <button type="button" className="sf-btn-secondary" onClick={() => { setStoryTitle(""); setStorySummary(""); setStoryTags(""); setStoryCoverFile(null); }}>清空</button>
          </div>
        </form>
      )}
    </div>
  );
}
