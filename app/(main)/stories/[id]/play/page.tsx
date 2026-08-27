"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatWorkspace, type ChatMessageItem, type ChatSessionInfo } from "@/components/ChatWorkspace";
import { currentPathForLogin, loginHref } from "@/lib/login-redirect";
import {
  findLastAssistant,
  readChatSse,
  regenerateLastReply,
  requestChatStop,
} from "@/lib/chat-sse-client";

type StoryDetail = {
  id: string;
  title: string;
  summary: string;
};

type PersonaMask = { id: string; name: string; summary?: string };
type StorySession = ChatSessionInfo & { persona_mask_id?: string | null };

export default function StoryPlayPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeSessionId = searchParams.get("session") ?? "";
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [personaMasks, setPersonaMasks] = useState<PersonaMask[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
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

      const profileRes = await fetch("/api/profile");
      if (!profileRes.ok) {
        router.replace(loginHref(currentPathForLogin()));
        return;
      }
      const profileJson = await profileRes.json();
      if (profileJson.code !== 200 || !profileJson.data?.id) {
        router.replace(loginHref(currentPathForLogin()));
        return;
      }

      const [res, masksRes] = await Promise.all([
        fetch(`/api/stories/${id}`),
        fetch("/api/persona-masks"),
      ]);
      const masksJson = await masksRes.json();
      const loadedMasks = (masksJson.code === 200 ? masksJson.data ?? [] : []) as PersonaMask[];
      setPersonaMasks(loadedMasks);
      const json = await res.json();
      if (json.code === 200) {
        setStory({ id: json.data.id, title: json.data.title, summary: json.data.summary ?? "" });
      } else {
        setError(json.msg ?? "加载失败");
      }

      if (resumeSessionId) {
        const detailRes = await fetch(`/api/chat/sessions/${resumeSessionId}`);
        const detailJson = await detailRes.json();
        if (detailJson.code === 200 && detailJson.data?.story_id === id) {
          const personaId = detailJson.data.persona_mask_id as string | null;
          if (personaId && loadedMasks.some((mask) => mask.id === personaId)) {
            setSelectedPersonaId(personaId);
          }
          const sessRes = await fetch(
            `/api/chat/sessions?session_type=story&story_id=${id}${
              personaId ? `&persona_mask_id=${encodeURIComponent(personaId)}` : ""
            }`,
          );
          const sessJson = await sessRes.json();
          let items = (sessJson.code === 200 ? sessJson.data : []) as StorySession[];
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

      setLoading(false);
    })();
  }, [params.id, resumeSessionId, router]);

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

  async function loadSessions(personaId: string) {
    const res = await fetch(
      `/api/chat/sessions?session_type=story&story_id=${params.id}&persona_mask_id=${encodeURIComponent(personaId)}`,
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

  async function createSession() {
    const persona = personaMasks.find((mask) => mask.id === selectedPersonaId);
    if (!story || !persona) return;
    const title = `体验${story.title} · ${persona.name}`;
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "story",
        story_id: params.id,
        persona_mask_id: persona.id,
        title,
      }),
    });
    const json = await res.json();
    if (json.code === 200) {
      const newSessionId = json.data.session_id as string;
      const session: ChatSessionInfo = {
        id: newSessionId,
        title,
        created_at: new Date().toISOString(),
      };
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(newSessionId);
      const messagesRes = await fetch(`/api/chat/sessions/${newSessionId}/messages`);
      const messagesJson = await messagesRes.json();
      setMessages(messagesJson.code === 200 ? messagesJson.data ?? [] : []);
      setInChat(true);
    }
  }

  async function startExperience() {
    if (!selectedPersonaId) return;
    const list = await loadSessions(selectedPersonaId);
    if (list.length > 0) {
      setActiveSessionId(list[0].id);
      setInChat(true);
    } else {
      await createSession();
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
      const { text } = await readChatSse(res, setStreamText);
      if (text) {
        setMessages((prev) => [
          ...prev,
          {
            id: "assistant_" + Date.now(),
            role: "assistant",
            content: text,
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

  async function regenerateMessage() {
    const last = findLastAssistant(messages);
    if (!last || !activeSessionId || busy) return;
    await regenerateLastReply({
      sessionId: activeSessionId,
      last,
      setMessages,
      setStreamText,
      setBusy,
      abortRef,
    });
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

  if (inChat) {
    const personaName = personaMasks.find((mask) => mask.id === selectedPersonaId)?.name;
    return (
      <ChatWorkspace
        backHref={`/stories/${story.id}`}
        backLabel="退出体验"
        title={personaName ? `${story.title} · ${personaName}` : story.title}
        assistantName={story.title}
        placeholder="输入你的行动指令…"
        emptyHint={story.summary || "以你的人设面具进入故事"}
        personaLabel={personaName ?? null}
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
        onStop={() => requestChatStop(activeSessionId, abortRef.current)}
        onRegenerate={regenerateMessage}
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
        <p className="text-sm text-[#5B6B8C]">
          {story.summary || "选择人设面具，直接进入故事体验（故事中的角色均为 NPC）"}
        </p>
        <div>
          <label className="mb-2 block text-sm font-medium text-[#1F2A44]">
            人设面具 <span className="text-red-500">*</span>
          </label>
          {personaMasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#C5DDF5] bg-[#F8FBFF] px-4 py-6 text-center">
              <p className="text-sm text-[#5B6B8C]">还没有人设面具</p>
              <p className="mt-1 text-xs text-[#8A97B3]">创建后即可选择身份进入故事体验</p>
              <Link className="sf-btn-primary mt-4 inline-flex" href="/compose?tab=persona">
                去创建人设面具
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {personaMasks.map((mask) => {
                const active = selectedPersonaId === mask.id;
                return (
                  <button
                    key={mask.id}
                    type="button"
                    onClick={() => setSelectedPersonaId(mask.id)}
                    className={[
                      "rounded-xl border px-4 py-3 text-left transition-all",
                      active
                        ? "border-[#3F86F5] bg-[#EEF6FF] shadow-[0_0_0_1px_#3F86F5]"
                        : "border-[#DCE9FF] bg-white hover:border-[#5B9DFF] hover:bg-[#F8FBFF]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[#1F2A44]">{mask.name}</p>
                      {active ? (
                        <span className="shrink-0 text-xs font-semibold text-[#3F86F5]">已选</span>
                      ) : null}
                    </div>
                    {mask.summary ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#5B6B8C]">
                        {mask.summary}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-[#8A97B3]">暂无简介</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button
          type="button"
          className="sf-btn-primary"
          disabled={!selectedPersonaId}
          onClick={() => void startExperience()}
        >
          开始体验
        </button>
      </div>
    </main>
  );
}
