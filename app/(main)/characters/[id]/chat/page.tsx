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

type CharacterInfo = {
  id: string;
  name: string;
  avatar_url: string | null;
};
type PersonaMask = { id: string; name: string };
type Affinity = { score: number; label: string };

export default function CharacterChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeSessionId = searchParams.get("session") ?? "";
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [sessions, setSessions] = useState<ChatSessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [personaMasks, setPersonaMasks] = useState<PersonaMask[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [affinity, setAffinity] = useState<Affinity | null>(null);
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

      const [charRes, sessRes, masksRes, affinityRes] = await Promise.all([
        fetch(`/api/characters/${id}`),
        fetch(`/api/chat/sessions?session_type=character&character_id=${id}`),
        fetch("/api/persona-masks"),
        fetch(`/api/affinity?character_id=${encodeURIComponent(id)}`),
      ]);
      const charJson = await charRes.json();
      if (charJson.code === 200) {
        setCharacter({
          id: charJson.data.id,
          name: charJson.data.name,
          avatar_url: charJson.data.avatar_url,
        });
      } else {
        setError(charJson.msg ?? "加载失败");
      }
      const sessJson = await sessRes.json();
      const masksJson = await masksRes.json();
      if (masksJson.code === 200) setPersonaMasks(masksJson.data ?? []);
      const affinityJson = await affinityRes.json();
      if (affinityJson.code === 200) setAffinity(affinityJson.data);
      if (sessJson.code === 200) {
        let list = (sessJson.data ?? []) as ChatSessionInfo[];
        list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

        if (resumeSessionId && !list.some((s) => s.id === resumeSessionId)) {
          const detailRes = await fetch(`/api/chat/sessions/${resumeSessionId}`);
          const detailJson = await detailRes.json();
          if (detailJson.code === 200 && detailJson.data?.character_id === id) {
            list = [
              {
                id: detailJson.data.id,
                title: detailJson.data.title,
                created_at: detailJson.data.created_at,
              },
              ...list,
            ];
          }
        }

        setSessions(list);
        if (resumeSessionId && list.some((s) => s.id === resumeSessionId)) {
          setActiveSessionId(resumeSessionId);
        } else if (list.length > 0) {
          setActiveSessionId(list[0].id);
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

  async function createSession() {
    if (!character) return;
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "character",
        character_id: params.id,
        persona_mask_id: selectedPersonaId || undefined,
        title: `与${character.name}对话`,
      }),
    });
    const json = await res.json();
    if (json.code === 200) {
      const newSessionId = json.data.session_id as string;
      setSessions((prev) => [
        {
          id: newSessionId,
          title: `与${character.name}对话`,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setActiveSessionId(newSessionId);
      setMessages([]);
    }
  }

  async function sendMessage() {
    if (!inputMessage.trim() || !activeSessionId) return;
    setBusy(true);
    setStreamText("");
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: ChatMessageItem = {
      id: "temp_" + Date.now(),
      role: "user",
      content: inputMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const sending = inputMessage;
    setInputMessage("");

    try {
      const res = await fetch(`/api/chat/sessions/${activeSessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: sending }),
        signal: controller.signal,
      });
      const { text, affinity: nextAffinity } = await readChatSse(res, setStreamText);
      if (nextAffinity) setAffinity(nextAffinity);
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
      onAffinity: setAffinity,
    });
  }

  if (loading) return <main className="sf-loading" />;
  if (error || !character) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-red-500">{error || "角色不存在"}</p>
        <Link href="/market" className="sf-tag mt-4 inline-block">
          返回市场
        </Link>
      </main>
    );
  }

  return (
    <ChatWorkspace
      backHref={`/characters/${character.id}`}
      backLabel="角色详情"
      title={`与 ${character.name} 对话`}
      assistantName={character.name}
      placeholder={`和 ${character.name} 说点什么…`}
      affinity={affinity}
      personaLabel={personaMasks.find((mask) => mask.id === selectedPersonaId)?.name ?? null}
      headerExtra={
        <select
          className="sf-input max-w-44 py-1 text-xs"
          value={selectedPersonaId}
          onChange={(e) => setSelectedPersonaId(e.target.value)}
          aria-label="选择人设面具"
        >
          <option value="">不使用面具</option>
          {personaMasks.map((mask) => <option key={mask.id} value={mask.id}>{mask.name}</option>)}
        </select>
      }
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelectSession={setActiveSessionId}
      onCreateSession={createSession}
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
