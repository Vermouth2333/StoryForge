"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatWorkspace, type ChatMessageItem, type ChatSessionInfo } from "@/components/ChatWorkspace";
import { currentPathForLogin, loginHref } from "@/lib/login-redirect";

type CharacterInfo = {
  id: string;
  name: string;
  avatar_url: string | null;
};

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

      const [charRes, sessRes] = await Promise.all([
        fetch(`/api/characters/${id}`),
        fetch(`/api/chat/sessions?session_type=character&character_id=${id}`),
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

  async function createSession() {
    if (!character) return;
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "character",
        character_id: params.id,
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
            acc += payload.content;
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
      onStop={() => abortRef.current?.abort()}
    />
  );
}
