"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatWorkspace, type ChatMessageItem, type ChatSessionInfo } from "@/components/ChatWorkspace";

type StoryDetail = {
  id: string;
  title: string;
  summary: string;
};

type CharacterItem = {
  id: string;
  name: string;
  avatar_url: string | null;
  summary: string;
};

export default function StoryPlayPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const resumeSessionId = searchParams.get("session") ?? "";
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sessions, setSessions] = useState<ChatSessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [inChat, setInChat] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void (async () => {
      const id = params.id;
      if (!id) return;
      const res = await fetch(`/api/stories/${id}`);
      const json = await res.json();
      let loadedCharacters: CharacterItem[] = [];
      if (json.code === 200) {
        setStory({ id: json.data.id, title: json.data.title, summary: json.data.summary ?? "" });
        const [relRes, importsRes] = await Promise.all([
          fetch(`/api/stories/${id}/relations`),
          fetch(`/api/stories/${id}/imports`),
        ]);
        const importsJson = importsRes.ok ? await importsRes.json() : null;
        const imported = (importsJson?.data?.characters ?? []) as CharacterItem[];
        if (imported.length > 0) {
          loadedCharacters = imported;
          setCharacters(imported);
        } else {
          const relJson = await relRes.json();
          void relJson;
          setCharacters([]);
        }
      } else {
        setError(json.msg ?? "加载失败");
      }

      if (resumeSessionId) {
        const detailRes = await fetch(`/api/chat/sessions/${resumeSessionId}`);
        const detailJson = await detailRes.json();
        if (detailJson.code === 200 && detailJson.data?.story_id === id) {
          const characterId = detailJson.data.character_id as string | null;
          let character = loadedCharacters.find((c) => c.id === characterId) ?? null;
          if (!character && characterId) {
            const cRes = await fetch(`/api/characters/${characterId}`);
            const cJson = await cRes.json();
            if (cJson.code === 200) {
              character = {
                id: cJson.data.id,
                name: cJson.data.name,
                avatar_url: cJson.data.avatar_url,
                summary: cJson.data.summary ?? "",
              };
            }
          }

          if (character) {
            setSelectedCharacter(character);
            const sessRes = await fetch(
              `/api/chat/sessions?session_type=story&story_id=${id}&character_id=${character.id}`,
            );
            const sessJson = await sessRes.json();
            let items = (sessJson.code === 200 ? sessJson.data : []) as ChatSessionInfo[];
            items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
            if (!items.some((s) => s.id === resumeSessionId)) {
              items = [
                {
                  id: detailJson.data.id,
                  title: detailJson.data.title,
                  created_at: detailJson.data.created_at,
                },
                ...items,
              ];
            }
            setSessions(items);
            setActiveSessionId(resumeSessionId);
            setInChat(true);
          }
        }
      }

      setLoading(false);
    })();
  }, [params.id, resumeSessionId]);

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/chat/sessions/${activeSessionId}/messages`);
      const json = await res.json();
      if (json.code === 200) setMessages(json.data ?? []);
      else setMessages([]);
    })();
  }, [activeSessionId]);

  async function loadSessions(characterId: string) {
    const res = await fetch(
      `/api/chat/sessions?session_type=story&story_id=${params.id}&character_id=${characterId}`,
    );
    const json = await res.json();
    if (json.code === 200) {
      const list = (json.data ?? []) as ChatSessionInfo[];
      list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setSessions(list);
      return list;
    }
    return [];
  }

  async function createSession(character = selectedCharacter) {
    if (!character || !story) return;
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "story",
        story_id: params.id,
        character_id: character.id,
        title: `体验${story.title} · ${character.name}`,
      }),
    });
    const json = await res.json();
    if (json.code === 200) {
      const newSessionId = json.data.session_id as string;
      const session: ChatSessionInfo = {
        id: newSessionId,
        title: `体验${story.title} · ${character.name}`,
        created_at: new Date().toISOString(),
      };
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(newSessionId);
      setMessages([]);
      setInChat(true);
    }
  }

  async function startExperience() {
    if (!selectedCharacter) return;
    const list = await loadSessions(selectedCharacter.id);
    if (list.length > 0) {
      setActiveSessionId(list[0].id);
      setInChat(true);
    } else {
      await createSession(selectedCharacter);
    }
  }

  async function sendMessage() {
    if (!inputMessage.trim() || !activeSessionId) return;
    setBusy(true);
    setStreamText("");
    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((prev) => [
      ...prev,
      {
        id: "temp_" + Date.now(),
        role: "user",
        content: inputMessage,
        created_at: new Date().toISOString(),
      },
    ]);
    const sending = inputMessage;
    setInputMessage("");

    try {
      const res = await fetch(`/api/chat/sessions/${activeSessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: sending }),
        signal: controller.signal,
      });
      if (!res.body) {
        setBusy(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let acc = "";
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
            acc += payload.content ?? "";
            setStreamText(acc);
          }
        }
      }
      if (acc) {
        setMessages((prev) => [
          ...prev,
          {
            id: "assistant_" + Date.now(),
            role: "assistant",
            content: acc,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      setStreamText("");
    } catch (err: unknown) {
      const isAbort =
        (err as { name?: string })?.name === "AbortError" || err instanceof DOMException;
      if (isAbort) {
        setStreamText((cur) => {
          if (cur) {
            setMessages((prev) => [
              ...prev,
              {
                id: "assistant_" + Date.now(),
                role: "assistant",
                content: cur + "\n\n（已停止生成）",
                created_at: new Date().toISOString(),
              },
            ]);
          }
          return "";
        });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  if (loading) return <main className="sf-loading" />;
  if (error || !story) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-red-500">{error || "故事不存在"}</p>
        <Link href="/market" className="sf-tag mt-4 inline-block">
          返回市场
        </Link>
      </main>
    );
  }

  if (inChat && selectedCharacter) {
    return (
      <ChatWorkspace
        backHref={`/stories/${story.id}`}
        backLabel="退出体验"
        title={`${story.title} · ${selectedCharacter.name}`}
        assistantName={selectedCharacter.name}
        placeholder="输入你的行动指令…"
        emptyHint={story.summary || `以 ${selectedCharacter.name} 的身份开始体验`}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onCreateSession={() => createSession()}
        messages={messages}
        streamText={streamText}
        busy={busy}
        inputMessage={inputMessage}
        onInputChange={setInputMessage}
        onSend={sendMessage}
        onStop={() => abortRef.current?.abort()}
      />
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href={`/stories/${story.id}`} className="sf-tag">
          ← 返回故事
        </Link>
        <h1 className="text-xl font-semibold text-[#1F2A44]">{story.title}</h1>
        <div className="w-20" />
      </div>

      <div className="sf-card space-y-4 p-6">
        <p className="text-sm text-[#5B6B8C]">{story.summary || "选择角色开始体验"}</p>
        {characters.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {characters.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`rounded-xl border p-4 text-left transition ${
                  selectedCharacter?.id === c.id
                    ? "border-[#5B9DFF] bg-[#EEF6FF]"
                    : "border-[#DCE9FF] bg-white hover:bg-[#F8FBFF]"
                }`}
                onClick={() => setSelectedCharacter(c)}
              >
                <p className="font-medium text-[#1F2A44]">{c.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-[#5B6B8C]">{c.summary}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#5B6B8C]">
            请先在大纲编辑页「引入角色卡」，再回来体验。
          </p>
        )}
        <button
          type="button"
          className="sf-btn-primary"
          disabled={!selectedCharacter}
          onClick={() => void startExperience()}
        >
          开始体验
        </button>
      </div>
    </main>
  );
}
