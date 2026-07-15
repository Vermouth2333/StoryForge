"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Tooltip, message } from "antd";
import { useEffect, useState } from "react";
import CoverFileField from "@/components/CoverFileField";
import { replayHeaders } from "@/lib/replay-headers";
import { uploadWorkCover } from "@/lib/upload-cover";

type MyStoryItem = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  updated_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

export default function ComposePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: "story" | "character" | "world" =
    tabParam === "character" || tabParam === "world" ? tabParam : "story";
  const [createTab, setCreateTab] = useState<"story" | "character" | "world">(initialTab);
  const [storyTitle, setStoryTitle] = useState("");
  const [storySummary, setStorySummary] = useState("");
  const [storyTags, setStoryTags] = useState("");
  const [storyCoverFile, setStoryCoverFile] = useState<File | null>(null);
  const [storyBusy, setStoryBusy] = useState(false);
  const [storyId, setStoryId] = useState("");
  const [prompt, setPrompt] = useState("让强尼银手台词更暴躁，保持悬疑氛围。");
  const [streamText, setStreamText] = useState("");
  const [busy, setBusy] = useState(false);
  const [myStories, setMyStories] = useState<MyStoryItem[]>([]);
  const [myCharacters, setMyCharacters] = useState<{ id: string; name: string }[]>([]);
  const [myWorlds, setMyWorlds] = useState<{ id: string; name: string }[]>([]);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; modelName: string; provider: string }>>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  // 角色卡表单
  const [charName, setCharName] = useState("");
  const [charSummary, setCharSummary] = useState("");
  const [charPersonality, setCharPersonality] = useState("");
  const [charTags, setCharTags] = useState("");
  const [charCoverFile, setCharCoverFile] = useState<File | null>(null);
  const [charBusy, setCharBusy] = useState(false);
  // 世界卡表单
  const [worldName, setWorldName] = useState("");
  const [worldSummary, setWorldSummary] = useState("");
  const [worldSetting, setWorldSetting] = useState("");
  const [worldTags, setWorldTags] = useState("");
  const [worldCoverFile, setWorldCoverFile] = useState<File | null>(null);
  const [worldBusy, setWorldBusy] = useState(false);

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
      setStoryId(id);
      message.success("故事已创建");
      await loadMyStories();
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
      body: JSON.stringify({ name: charName.trim(), summary: charSummary, personality: charPersonality, tags }),
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
      body: JSON.stringify({ name: worldName.trim(), summary: worldSummary, setting_notes: worldSetting, tags }),
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

  async function publishStory() {
    if (!storyId) return;
    const res = await fetch(`/api/stories/${storyId}/publish`, { method: "POST", headers: replayHeaders() });
    const json = await res.json();
    if (json.code === 200) {
      message.success("发布成功");
    } else {
      message.error(json.msg || "发布失败");
    }
    await loadMyStories();
  }

  async function createSession() {
    await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "story",
        story_id: storyId || null,
        character_id: null,
        world_id: null,
        title: `${storyTitle}-会话`,
      }),
    });
  }

  async function generate() {
    if (busy) return;
    setBusy(true);
    setStreamText("");
    const sessionRes = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "story",
        story_id: storyId || null,
        title: `${storyTitle}-会话`,
        model_id: selectedModelId || undefined,
      }),
    });
    const sessionJson = await sessionRes.json();
    if (sessionJson.code !== 200) {
      setBusy(false);
      return;
    }
    const sessionId = sessionJson.data.session_id;
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: prompt }),
      });
      if (!res.body) {
        setBusy(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as { type?: string; content?: string };
          if (payload.type === "content") {
            setStreamText((t) => t + payload.content);
          }
        }
      }
    } catch {
    } finally {
      setBusy(false);
    }
  }

  async function stopGenerate() {
    const sessionRes = await fetch("/api/chat/sessions");
    const sessionJson = await sessionRes.json();
    if (sessionJson.code === 200 && sessionJson.data?.length > 0) {
      const lastSession = sessionJson.data[sessionJson.data.length - 1];
      await fetch(`/api/chat/sessions/${lastSession.id}/stop`, { method: "POST" });
    }
    setBusy(false);
  }

  async function loadMyStories() {
    const res = await fetch("/api/stories?mine=1");
    const json = await res.json();
    setMyStories(json.data ?? []);
  }

  async function loadMyCards() {
    const [charRes, worldRes, modelRes] = await Promise.all([
      fetch("/api/characters?mine=1"),
      fetch("/api/worlds?mine=1"),
      fetch("/api/models"),
    ]);
    const charJson = charRes.ok ? await charRes.json() : { data: [] };
    const worldJson = worldRes.ok ? await worldRes.json() : { data: [] };
    setMyCharacters((charJson.data ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    setMyWorlds((worldJson.data ?? []).map((w: { id: string; name: string }) => ({ id: w.id, name: w.name })));
    if (modelRes.ok) {
      const modelJson = await modelRes.json();
      if (modelJson.code === 200) {
        const enabled = (modelJson.data ?? []).filter((m: { enabled: boolean }) => m.enabled);
        setAvailableModels(enabled);
        if (modelJson.defaultModelId) setSelectedModelId(modelJson.defaultModelId);
        else if (enabled.length > 0) setSelectedModelId(enabled[0].id);
      }
    }
  }

  useEffect(() => {
    void loadMyStories();
    void loadMyCards();
  }, []);

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="section-title">创作工作台</h2>
          <p className="section-subtitle">创建故事、角色卡、世界卡，与 AI 对话，开启你的创作之旅</p>
        </div>
        {createTab === "story" && (
          <div className="flex gap-3">
            <Tooltip title={!storyId ? "请先创建或选择一个故事" : undefined}>
              <button
                className="sf-btn-secondary"
                onClick={publishStory}
                disabled={!storyId}
              >
                发布故事
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* 创建类型切换 Tab */}
      <div className="sf-card flex flex-wrap items-center gap-2 p-3">
        {([
          { key: "story", label: "📚 故事" },
          { key: "character", label: "🎭 角色卡" },
          { key: "world", label: "🌍 世界卡" },
        ] as const).map((t) => {
          const active = createTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setCreateTab(t.key)}
              aria-pressed={active}
              className={
                "sf-tag transition-all duration-150 " +
                (active
                  ? "bg-[#3f86f5] text-white border-[#3f86f5] shadow-[0_4px_12px_rgba(63,134,245,0.35)] font-medium scale-[1.03]"
                  : "hover:border-[#3f86f5] hover:text-[#3f86f5]")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 角色卡创建表单 */}
      {createTab === "character" && (
        <form onSubmit={createCharacter} className="sf-card space-y-5 p-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#5B9DFF]">创作</p>
            <h3 className="text-lg font-semibold text-[#1F2A44]">创建角色卡</h3>
            <p className="mt-1 text-sm text-[#5B6B8C]">创建独立的角色卡，可直接对话测试，也可引入到故事项目中。</p>
          </div>
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
            <p className="mt-1 text-sm text-[#5B6B8C]">填写基本信息与封面，创建后可继续编辑大纲与正文。</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">故事标题 <span className="text-red-500">*</span></label>
            <input className="sf-input w-full" placeholder="如：赛博朋克2077-初次相遇" value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">简介</label>
            <textarea className="sf-input w-full min-h-20 resize-y" placeholder="简要描述故事背景、核心冲突..." value={storySummary} onChange={(e) => setStorySummary(e.target.value)} maxLength={1000} />
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

      {/* 三栏布局 - 仅故事 Tab 显示 */}
      {createTab === "story" && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,320px)_1fr_minmax(280px,320px)]">
        {/* 左侧 - 章节大纲 */}
        <div className="rounded-2xl border border-[#dce9ff] bg-white p-5">
          <h3 className="text-base font-semibold text-[#1f2a44] mb-4 flex items-center gap-2">
            <span className="text-xl">📚</span> 章节大纲
          </h3>
          {storyId ? (
            <Link
              className="inline-flex items-center gap-2 text-sm font-medium text-[#3f86f5] hover:underline"
              href={`/stories/${storyId}/edit`}
            >
              <span>🔗</span> 打开大纲编辑器
            </Link>
          ) : (
            <p className="text-sm text-[#5b6b8c]">先创建故事后，可编辑树形章节节点。</p>
          )}
          <div className="mt-4 border-t border-dashed border-[#dce9ff] pt-4">
            <p className="text-xs font-medium text-[#1f2a44] mb-3">我的故事</p>
            <ul className="space-y-2">
              {myStories.slice(0, 5).map((story) => (
                <li
                  key={story.id}
                  className={`cursor-pointer rounded-lg p-2 text-sm transition-colors ${
                    storyId === story.id ? "bg-[#eef6ff]" : "bg-[#f8fbff] hover:bg-[#f0f6ff]"
                  }`}
                  onClick={() => setStoryId(story.id)}
                >
                  <p className="font-medium text-[#1f2a44] truncate">{story.title}</p>
                  <p className="text-xs text-[#5b6b8c]">状态: {STATUS_LABELS[story.status] ?? story.status}</p>
                </li>
              ))}
              {myStories.length === 0 && (
                <li className="text-xs text-[#5b6b8c] text-center py-4">暂无故事</li>
              )}
            </ul>
          </div>
        </div>

        {/* 中间 - 正文编辑区 */}
        <div className="rounded-2xl border border-[#dce9ff] bg-white p-5">
          <h3 className="text-base font-semibold text-[#1f2a44] mb-4 flex items-center gap-2">
            <span className="text-xl">✍️</span> 正文编辑区
          </h3>
          <textarea
            className="sf-input min-h-48 resize-none"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入你的创作指令..."
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {availableModels.length > 0 && (
              <select
                className="sf-input max-w-[200px] text-sm"
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                ))}
              </select>
            )}
            {availableModels.length === 0 && (
              <Link href="/settings" className="text-xs text-[#5B9DFF] hover:underline">
                前往设置添加 AI 模型
              </Link>
            )}
            <Tooltip title={availableModels.length === 0 ? "请先在设置中添加 AI 模型" : undefined}>
              <button
                className="sf-btn-primary flex items-center gap-2"
                onClick={generate}
                disabled={busy || availableModels.length === 0}
              >
                {busy ? (
                  <>
                    <span className="animate-pulse">⏳</span> 生成中...
                  </>
                ) : (
                  <>
                    <span>✨</span> AI 续写
                  </>
                )}
              </button>
            </Tooltip>
            <Tooltip title={!busy ? "当前没有正在生成的内容" : undefined}>
              <button
                className="sf-btn-secondary flex items-center gap-2"
                onClick={stopGenerate}
                disabled={!busy}
              >
                <span>⏹</span> 停止生成
              </button>
            </Tooltip>
            <Tooltip title={!storyId ? "请先创建或选择一个故事" : undefined}>
              <button
                className="sf-btn-secondary flex items-center gap-2"
                onClick={createSession}
                disabled={!storyId}
              >
                <span>💬</span> 创建会话
              </button>
            </Tooltip>
          </div>
          <div className="mt-5 rounded-xl bg-[#eef6ff] p-5 min-h-[300px]">
            <p className="font-semibold text-[#1f2a44] mb-2 flex items-center gap-2">
              <span>📤</span> 输出结果
            </p>
            <p className="text-sm text-[#1f2a44] whitespace-pre-wrap leading-relaxed">
              {streamText || "暂无输出，点击 AI 续写开始创作"}
            </p>
          </div>
        </div>

        {/* 右侧 - 角色与世界 */}
        <div className="rounded-2xl border border-[#dce9ff] bg-white p-5">
          <h3 className="text-base font-semibold text-[#1f2a44] mb-4 flex items-center gap-2">
            <span className="text-xl">🎭</span> 角色与世界
          </h3>

          {/* 角色卡列表：根据页面高度自适应展示数量 */}
          <div className="mb-4">
            <p className="text-xs font-medium text-[#1f2a44] mb-2">我的角色卡（{myCharacters.length}）</p>
            {myCharacters.length > 0 ? (
              <>
                <ul className="flex flex-wrap gap-2 max-h-[8.5rem] overflow-hidden">
                  {myCharacters.slice(0, 8).map((c) => (
                    <li key={c.id}>
                      <Link className="sf-tag" href={`/characters/${c.id}`}>{c.name}</Link>
                    </li>
                  ))}
                </ul>
                {myCharacters.length > 8 && (
                  <Link href="/my" className="mt-2 inline-block text-xs text-[#5B9DFF] hover:underline">
                    查看更多（{myCharacters.length - 8}）→
                  </Link>
                )}
              </>
            ) : (
              <span className="text-xs text-[#5b6b8c]">暂无角色</span>
            )}
          </div>

          {/* 世界卡列表 */}
          <div className="mb-4">
            <p className="text-xs font-medium text-[#1f2a44] mb-2">我的世界卡（{myWorlds.length}）</p>
            {myWorlds.length > 0 ? (
              <>
                <ul className="flex flex-wrap gap-2 max-h-[8.5rem] overflow-hidden">
                  {myWorlds.slice(0, 8).map((w) => (
                    <li key={w.id}>
                      <Link className="sf-tag" href={`/worlds/${w.id}`}>{w.name}</Link>
                    </li>
                  ))}
                </ul>
                {myWorlds.length > 8 && (
                  <Link href="/my" className="mt-2 inline-block text-xs text-[#5B9DFF] hover:underline">
                    查看更多（{myWorlds.length - 8}）→
                  </Link>
                )}
              </>
            ) : (
              <span className="text-xs text-[#5b6b8c]">暂无世界</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="sf-tag text-xs" onClick={() => setCreateTab("character")}>+ 新建角色</button>
            <button type="button" className="sf-tag text-xs" onClick={() => setCreateTab("world")}>+ 新建世界</button>
          </div>
          <div className="mt-4 border-t border-dashed border-[#dce9ff] pt-4">
            <p className="text-xs font-medium text-[#1f2a44] mb-3">快捷操作</p>
            <div className="space-y-2">
              <Tooltip title={!storyId ? "请先创建或选择一个故事" : undefined}>
                <button
                  className="w-full sf-tag text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={createSession}
                  disabled={!storyId}
                >
                  + 创建新会话
                </button>
              </Tooltip>
              {storyId && (
                <button className="w-full sf-tag text-left" onClick={publishStory}>
                  + 发布当前故事
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
