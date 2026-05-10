"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type StoryDetail = {
  id: string;
  author_id: string;
  author_display?: string;
  title: string;
  summary: string;
  cover_asset_id: string | null;
  status: string;
  tags_json: string;
  like_count: number;
  favorite_count: number;
  publish_at: string | null;
  updated_at: string;
};

type CharacterItem = {
  id: string;
  name: string;
  avatar_url: string | null;
  summary: string;
};

type MessageItem = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  created_at: string;
};

export default function StoryPlayPage() {
  const params = useParams<{ id: string }>();
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // 对话状态
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");

  useEffect(() => {
    void (async () => {
      const id = params.id;
      if (!id) return;
      const res = await fetch(`/api/stories/${id}`);
      const json = await res.json();
      if (json.code === 200) {
        setStory(json.data);
        // 获取故事关联的角色
        const charRes = await fetch(`/api/stories/${id}/relations`);
        const charJson = await charRes.json();
        if (charJson.code === 200) {
          setCharacters(charJson.data?.characters ?? []);
        }
      } else {
        setError(json.msg ?? "加载失败");
      }
      setLoading(false);
    })();
  }, [params.id]);

  async function startExperience() {
    if (!selectedCharacter) return;
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "story",
        story_id: params.id,
        character_id: selectedCharacter.id,
        title: `体验${story?.title}`,
      }),
    });
    const json = await res.json();
    if (json.code === 200) {
      setSessionId(json.data.session_id);
    }
  }

  async function sendMessage() {
    if (!inputMessage.trim() || !sessionId) return;
    setBusy(true);
    setStreamText("");
    
    const userMsg: MessageItem = {
      id: "temp",
      role: "user",
      content: inputMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputMessage }),
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
          const payload = JSON.parse(line.slice(5).trim()) as any;
          if (payload.type === "content") {
            setStreamText((t) => t + payload.content);
          }
        }
      }
      if (streamText) {
        const assistantMsg: MessageItem = {
          id: "assistant_" + Date.now(),
          role: "assistant",
          content: streamText,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => {
          const newList = [...prev];
          return [...newList.slice(0, -1), assistantMsg];
        });
      }
      setStreamText("");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-4xl p-6 text-sm text-[#5B6B8C]">加载中...</main>;
  }
  if (!story) {
    return (
      <main className="mx-auto max-w-4xl p-6 text-sm text-[#5B6B8C]">
        {error || "故事不存在"}
      </main>
    );
  }

  let tags: string[] = [];
  try {
    tags = JSON.parse(story.tags_json) as string[];
  } catch {
    tags = [];
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      {/* 故事信息 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#1F2A44]">{story.title}</h1>
            <p className="mt-2 text-sm text-[#5B6B8C] max-w-md">{story.summary || "暂无简介"}</p>
          </div>
          <Link href="/market" className="sf-tag">
            返回市场
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="sf-tag">{tag}</span>
          ))}
        </div>
      </div>

      {/* 选择角色开始体验 */}
      {!sessionId && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
          <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
            <span>🎭</span> 选择角色开始体验
          </h3>
          {characters.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.map((char) => (
                <div
                  key={char.id}
                  className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                    selectedCharacter?.id === char.id
                      ? "border-[#5B9DFF] bg-[#EEF6FF]"
                      : "border-[#DCE9FF] bg-[#F8FBFF] hover:border-[#5B9DFF]"
                  }`}
                  onClick={() => setSelectedCharacter(char)}
                >
                  <div className="flex items-center gap-3">
                    {char.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={char.avatar_url}
                        alt=""
                        className="h-12 w-12 rounded-full border-2 border-[#DCE9FF] object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#EEF6FF] to-[#E0F2FE] text-lg font-bold text-[#5B9DFF]">
                        {char.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-[#1F2A44]">{char.name}</p>
                      <p className="text-xs text-[#5B6B8C] truncate max-w-[150px]">
                        {char.summary || "暂无简介"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">👤</div>
              <p className="text-sm text-[#5B6B8C]">该故事暂无可用角色</p>
            </div>
          )}
          <div className="mt-6 text-center">
            <button
              className="sf-btn-primary"
              onClick={startExperience}
              disabled={!selectedCharacter}
            >
              🎮 开始体验
            </button>
            {!selectedCharacter && (
              <p className="text-xs text-[#5B6B8C] mt-2">请先选择一个角色</p>
            )}
          </div>
        </div>
      )}

      {/* 体验对话区域 */}
      {sessionId && selectedCharacter && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2">
              <span>🎮</span> 体验 {story.title}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#5B6B8C]">扮演: {selectedCharacter.name}</span>
              <button
                className="sf-tag"
                onClick={() => {
                  setSessionId("");
                  setMessages([]);
                  setSelectedCharacter(null);
                }}
              >
                退出体验
              </button>
            </div>
          </div>
          
          {/* 故事简介 */}
          <div className="rounded-xl bg-[#F8FBFF] p-4 mb-4">
            <p className="text-sm text-[#5B6B8C] italic">
              {story.summary}
            </p>
          </div>
          
          {/* 消息区域 */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto mb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl p-4 ${
                  msg.role === "user"
                    ? "bg-[#EEF6FF] border-l-4 border-[#5B9DFF]"
                    : "bg-white border-l-4 border-[#4FACFE] border"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    msg.role === "user"
                      ? "bg-[#5B9DFF] text-white"
                      : "bg-[#4FACFE] text-white"
                  }`}>
                    {msg.role === "user" ? "我" : selectedCharacter.name}
                  </span>
                </div>
                <p className="text-sm text-[#1F2A44] leading-relaxed">{msg.content}</p>
              </div>
            ))}
            {streamText && (
              <div className="rounded-xl p-4 bg-white border-l-4 border-[#4FACFE]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#4FACFE] text-white">
                    {selectedCharacter.name}
                  </span>
                </div>
                <p className="text-sm text-[#1F2A44] leading-relaxed">{streamText}▌</p>
              </div>
            )}
          </div>
          
          {/* 输入区域 */}
          <div className="flex gap-3">
            <input
              className="sf-input flex-1"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="输入你的行动指令..."
              disabled={busy}
            />
            <button className="sf-btn-primary" onClick={sendMessage} disabled={busy || !inputMessage.trim()}>
              {busy ? "思考中..." : "行动"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
