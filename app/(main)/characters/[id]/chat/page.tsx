"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type CharacterInfo = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type SessionInfo = {
  id: string;
  session_type: string;
  title: string | null;
  created_at: string;
};

type MessageItem = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  created_at: string;
};

export default function CharacterChatPage() {
  const params = useParams<{ id: string }>();
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 加载角色信息和历史会话列表
  useEffect(() => {
    void (async () => {
      const id = params.id;
      if (!id) return;
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
        const list = (sessJson.data ?? []) as SessionInfo[];
        list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setSessions(list);
        if (list.length > 0) setActiveSessionId(list[0].id);
      }
      setLoading(false);
    })();
  }, [params.id]);

  // 加载选中会话的消息
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/chat/sessions/${activeSessionId}/messages`);
      const json = await res.json();
      if (json.code === 200) {
        setMessages(json.data ?? []);
      } else {
        setMessages([]);
      }
    })();
  }, [activeSessionId]);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

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
      const newSessionId = json.data.session_id;
      const newSession: SessionInfo = {
        id: newSessionId,
        session_type: "character",
        title: `与${character.name}对话`,
        created_at: new Date().toISOString(),
      };
      setSessions((prev) => [newSession, ...prev]);
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

    const userMsg: MessageItem = {
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
        const assistantMsg: MessageItem = {
          id: "assistant_" + Date.now(),
          role: "assistant",
          content: acc,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
      setStreamText("");
    } catch (err: unknown) {
      const isAbort =
        (err as { name?: string })?.name === "AbortError" || err instanceof DOMException;
      if (isAbort) {
        setStreamText((cur) => {
          if (cur) {
            const assistantMsg: MessageItem = {
              id: "assistant_" + Date.now(),
              role: "assistant",
              content: cur + "\n\n（已停止生成）",
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
          }
          return "";
        });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-sm text-[#5B6B8C]">加载中...</p>
      </main>
    );
  }
  if (error || !character) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-sm text-red-500">{error || "角色不存在"}</p>
        <Link href="/market" className="sf-tag mt-4 inline-block">返回市场</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/characters/${character.id}`} className="sf-tag">
          ← 返回角色详情
        </Link>
        <h1 className="text-lg font-bold text-[#1F2A44]">
          与 {character.name} 对话
        </h1>
        <div className="w-24" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        {/* 会话列表 */}
        <aside className="rounded-xl border border-[#DCE9FF] bg-white p-4 max-h-[70vh] overflow-y-auto">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1F2A44]">历史会话</h3>
            <button className="sf-btn-secondary text-xs" onClick={createSession}>
              + 新会话
            </button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-xs text-[#5B6B8C]">暂无历史会话</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${
                      s.id === activeSessionId
                        ? "bg-[#5B9DFF] text-white"
                        : "bg-[#F8FBFF] text-[#1F2A44] hover:bg-[#EEF6FF]"
                    }`}
                    onClick={() => setActiveSessionId(s.id)}
                  >
                    <p className="truncate font-medium">{s.title || "未命名会话"}</p>
                    <p className={`mt-1 text-[10px] ${s.id === activeSessionId ? "text-white/80" : "text-[#5B6B8C]"}`}>
                      {new Date(s.created_at).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* 对话区 */}
        <section className="rounded-xl border border-[#DCE9FF] bg-white p-6 flex flex-col max-h-[70vh]">
          {!activeSessionId ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="mb-3 text-sm text-[#5B6B8C]">暂无活跃会话，点击“新会话”开始对话</p>
                <button className="sf-btn-primary" onClick={createSession}>
                  💬 开始对话
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto mb-4 pr-1">
                {messages.length === 0 && !streamText && (
                  <p className="py-8 text-center text-sm text-[#5B6B8C]">
                    输入消息开始与 {character.name} 对话
                  </p>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-4 ${
                      msg.role === "user"
                        ? "bg-[#EEF6FF] border-l-4 border-[#5B9DFF]"
                        : "bg-[#F0F9FF] border-l-4 border-[#4FACFE]"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          msg.role === "user"
                            ? "bg-[#5B9DFF] text-white"
                            : "bg-[#4FACFE] text-white"
                        }`}
                      >
                        {msg.role === "user" ? "我" : character.name}
                      </span>
                      <span className="text-[10px] text-[#5B6B8C]">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1F2A44]">
                      {msg.content}
                    </p>
                  </div>
                ))}
                {streamText && (
                  <div className="rounded-xl border-l-4 border-[#4FACFE] bg-[#F0F9FF] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-full bg-[#4FACFE] px-2 py-1 text-xs font-semibold text-white">
                        {character.name}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1F2A44]">
                      {streamText}▌
                    </p>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className="flex gap-3">
                <input
                  className="sf-input flex-1"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder={`与 ${character.name} 对话...`}
                  disabled={busy}
                />
                <button
                  className="sf-btn-primary"
                  onClick={sendMessage}
                  disabled={busy || !inputMessage.trim()}
                >
                  {busy ? "发送中..." : "发送"}
                </button>
                {busy && (
                  <button className="sf-btn-secondary" onClick={stopGeneration}>
                    停止
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
