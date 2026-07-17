"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type ChatSessionInfo = {
  id: string;
  title: string | null;
  created_at: string;
};

export type ChatMessageItem = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  created_at: string;
};

type ChatWorkspaceProps = {
  backHref: string;
  backLabel?: string;
  title: string;
  assistantName: string;
  placeholder?: string;
  emptyHint?: string;
  sessions: ChatSessionInfo[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void | Promise<void>;
  messages: ChatMessageItem[];
  streamText: string;
  busy: boolean;
  inputMessage: string;
  onInputChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  onStop: () => void;
};

export function ChatWorkspace({
  backHref,
  backLabel = "返回",
  title,
  assistantName,
  placeholder = "描述你的想法，我来帮你继续创作…",
  emptyHint,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  messages,
  streamText,
  busy,
  inputMessage,
  onInputChange,
  onSend,
  onStop,
}: ChatWorkspaceProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, streamText]);

  const visibleMessages = messages.filter((m) => m.role === "user" || m.role === "assistant");

  return (
    <main className="flex h-full min-h-0 flex-1 overflow-hidden bg-[#F5F7FB]">
      {/* 会话侧边栏 */}
      <aside
        className={[
          "flex min-h-0 shrink-0 flex-col border-r border-[#E6ECF5] bg-white transition-[width] duration-200",
          sidebarOpen ? "w-[260px]" : "w-0 overflow-hidden border-r-0",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#E6ECF5] px-3 py-3">
          <p className="text-sm font-semibold text-[#1F2A44]">会话</p>
          <button
            type="button"
            className="rounded-lg bg-[#EEF6FF] px-2.5 py-1 text-xs font-medium text-[#3F86F5] hover:bg-[#DCE9FF]"
            onClick={() => void onCreateSession()}
          >
            + 新会话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-[#5B6B8C]">暂无会话</p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((s) => {
                const active = s.id === activeSessionId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={[
                        "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                        active ? "bg-[#EEF6FF] text-[#1F2A44]" : "text-[#5B6B8C] hover:bg-[#F8FBFF]",
                      ].join(" ")}
                      onClick={() => onSelectSession(s.id)}
                    >
                      <p className={`truncate text-sm ${active ? "font-semibold" : "font-medium"}`}>
                        {s.title || "未命名会话"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#8A97B3]">
                        {new Date(s.created_at).toLocaleString()}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* 主聊天区 */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-[#E6ECF5] bg-white px-4 py-3">
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-[#5B6B8C] hover:bg-[#F8FBFF]"
            aria-label={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? "‹" : "›"}
          </button>
          <Link href={backHref} className="text-sm text-[#5B6B8C] hover:text-[#3F86F5]">
            ← {backLabel}
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-[#1F2A44]">{title}</h1>
        </header>

        {!activeSessionId ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="text-center">
              <p className="mb-4 text-sm text-[#5B6B8C]">还没有会话，新建一个开始聊天</p>
              <button
                type="button"
                className="sf-btn-primary"
                onClick={() => void onCreateSession()}
              >
                开始对话
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8">
              {visibleMessages.length === 0 && !streamText ? (
                <p className="py-16 text-center text-sm text-[#8A97B3]">
                  {emptyHint || `输入消息，开始与 ${assistantName} 对话`}
                </p>
              ) : null}

              {visibleMessages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[min(720px,92%)] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
                      {!isUser ? (
                        <p className="px-1 text-xs font-semibold text-[#6B7CFF]">{assistantName}</p>
                      ) : null}
                      <div
                        className={[
                          "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                          isUser
                            ? "bg-[#5B9DFF] text-white rounded-br-md"
                            : "bg-white text-[#1F2A44] border border-[#E6ECF5] shadow-sm rounded-bl-md",
                        ].join(" ")}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}

              {streamText ? (
                <div className="flex justify-start">
                  <div className="max-w-[min(720px,92%)]">
                    <p className="mb-1.5 px-1 text-xs font-semibold text-[#6B7CFF]">{assistantName}</p>
                    <div className="rounded-2xl rounded-bl-md border border-[#E6ECF5] bg-white px-4 py-3 text-sm leading-relaxed text-[#1F2A44] shadow-sm whitespace-pre-wrap">
                      {streamText}
                      <span className="ml-0.5 inline-block animate-pulse text-[#6B7CFF]">▍</span>
                    </div>
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {/* 底部输入卡片 */}
            <div className="shrink-0 border-t border-[#E6ECF5] bg-[#F5F7FB] px-4 py-4 sm:px-8">
              <div className="mx-auto max-w-3xl rounded-2xl border border-[#E6ECF5] bg-white p-3 shadow-[0_8px_30px_rgba(66,133,244,0.08)]">
                <textarea
                  className="min-h-[72px] w-full resize-none border-0 bg-transparent px-2 py-2 text-sm text-[#1F2A44] outline-none placeholder:text-[#8A97B3]"
                  value={inputMessage}
                  placeholder={placeholder}
                  disabled={busy}
                  rows={3}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                />
                <div className="mt-1 flex items-center justify-between gap-2 px-1">
                  <p className="text-[11px] text-[#8A97B3]">Enter 发送 · Shift+Enter 换行</p>
                  <div className="flex items-center gap-2">
                    {busy ? (
                      <button
                        type="button"
                        className="rounded-full border border-[#DCE9FF] px-3 py-1.5 text-xs text-[#5B6B8C] hover:bg-[#F8FBFF]"
                        onClick={onStop}
                      >
                        停止
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy || !inputMessage.trim()}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5B9DFF] text-white shadow-sm transition enabled:hover:bg-[#7FB4FF] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="发送"
                      onClick={() => void onSend()}
                    >
                      {busy ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      ) : (
                        <span className="text-sm leading-none">↑</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
