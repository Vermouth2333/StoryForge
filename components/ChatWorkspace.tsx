"use client";

import { App, Input, Modal } from "antd";
import Link from "next/link";
import { ChatMediaThumb } from "@/components/ChatMediaThumb";
import { Flag, ImagePlus, Pencil, RefreshCw, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  image_url?: string | null;
  video_url?: string | null;
  video_status?: string | null;
  video_error?: string | null;
};

type SnapshotLite = {
  id: string;
  label: string;
  created_at: string;
  last_message_id?: string;
  last_assistant_preview?: string;
};

type SnapshotApi = {
  id: string;
  label: string;
  created_at: string;
  payload?: {
    last_message_id?: string;
    last_assistant_id?: string;
    last_assistant_preview?: string;
  };
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
  onRegenerate?: () => void | Promise<void>;
  onAssistantContentChange?: (messageId: string, content: string) => void;
  onAssistantMediaChange?: (
    messageId: string,
    patch: { image_url?: string | null; video_url?: string | null; video_status?: string | null; video_error?: string | null },
  ) => void;
  affinity?: { score: number; label: string } | null;
  personaLabel?: string | null;
  headerExtra?: React.ReactNode;
};

function normalizeSnapshot(raw: SnapshotApi): SnapshotLite {
  return {
    id: raw.id,
    label: raw.label,
    created_at: raw.created_at,
    last_message_id: raw.payload?.last_assistant_id || raw.payload?.last_message_id,
    last_assistant_preview: raw.payload?.last_assistant_preview ?? "",
  };
}

function unlockPageAfterModal() {
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("width");
  document.body.classList.remove("ant-scrolling-effect");
}

/** 将文本中的 [文案](/path#hash) 渲染为可点击链接 */
function MessageText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (m) {
          const href = m[2];
          const label = m[1];
          if (href.startsWith("/")) {
            return (
              <Link
                key={i}
                href={href}
                className="mt-2 inline-flex font-semibold text-[#3F86F5] underline underline-offset-2 hover:text-[#2F8FFF]"
              >
                {label}
              </Link>
            );
          }
          return (
            <a
              key={i}
              href={href}
              className="mt-2 inline-flex font-semibold text-[#3F86F5] underline underline-offset-2 hover:text-[#2F8FFF]"
              target="_blank"
              rel="noreferrer"
            >
              {label}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

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
  onRegenerate,
  onAssistantContentChange,
  onAssistantMediaChange,
  affinity,
  personaLabel,
  headerExtra,
}: ChatWorkspaceProps) {
  const { message } = App.useApp();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollMsgId = useRef<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [checkpointNote, setCheckpointNote] = useState("");
  const [checkpointBusy, setCheckpointBusy] = useState(false);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const [removingMediaKey, setRemovingMediaKey] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [videoStatus, setVideoStatus] = useState<Record<string, string | null>>({});
  const [videoErrors, setVideoErrors] = useState<Record<string, string>>({});
  const [snapshotsBySession, setSnapshotsBySession] = useState<Record<string, SnapshotLite[]>>({});
  const [highlightMsgId, setHighlightMsgId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const editorWrapRef = useRef<HTMLDivElement | null>(null);
  const savingEditRef = useRef(false);
  const editDraftRef = useRef("");
  const editingIdRef = useRef<string | null>(null);
  const messagesRef = useRef(messages);
  const onAssistantContentChangeRef = useRef(onAssistantContentChange);
  const onAssistantMediaChangeRef = useRef(onAssistantMediaChange);
  editDraftRef.current = editDraft;
  editingIdRef.current = editingId;
  messagesRef.current = messages;
  onAssistantContentChangeRef.current = onAssistantContentChange;
  onAssistantMediaChangeRef.current = onAssistantMediaChange;

  useEffect(() => {
    if (pendingScrollMsgId.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, streamText]);

  useEffect(() => {
    if (sessions.length === 0) {
      setSnapshotsBySession({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        sessions.map(async (s) => {
          const res = await fetch(`/api/chat/sessions/${s.id}/snapshots`);
          const json = await res.json().catch(() => null);
          const list = (json?.code === 200 ? json.data?.snapshots ?? [] : []) as SnapshotApi[];
          return [s.id, list.map(normalizeSnapshot)] as const;
        }),
      );
      if (!cancelled) setSnapshotsBySession(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [sessions]);

  const visibleMessages = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const lastVisible = visibleMessages[visibleMessages.length - 1];
  const lastAssistant = [...visibleMessages].reverse().find((m) => m.role === "assistant");
  const canRegenerate =
    Boolean(onRegenerate) &&
    lastVisible?.role === "assistant" &&
    !busy &&
    !streamText;
  const canCheckpoint = Boolean(activeSessionId) && visibleMessages.length > 0 && !busy && !streamText;

  useEffect(() => {
    setImageUrls({});
    setVideoUrls({});
    setVideoStatus({});
    setVideoErrors({});
    setImageBusyId(null);
    setRemovingMediaKey(null);
    setEditingId(null);
    setEditDraft("");
  }, [activeSessionId]);

  function startEdit(msg: ChatMessageItem) {
    if (busy || streamText || msg.role !== "assistant") return;
    setEditingId(msg.id);
    setEditDraft(msg.content);
  }

  async function commitEdit() {
    const messageId = editingIdRef.current;
    if (!messageId || savingEditRef.current) return;
    const original = messagesRef.current.find((m) => m.id === messageId)?.content ?? "";
    const next = editDraftRef.current;
    if (next === original) {
      if (editingIdRef.current === messageId) setEditingId(null);
      return;
    }
    if (!next.trim()) {
      message.error("内容不能为空");
      return;
    }
    savingEditRef.current = true;
    try {
      const res = await fetch(`/api/chat/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: next }),
      });
      const json = await res.json().catch(() => null);
      if (json?.code === 200) {
        onAssistantContentChangeRef.current?.(messageId, next);
        if (editingIdRef.current === messageId) setEditingId(null);
      } else {
        message.error(json?.msg ?? "保存失败");
      }
    } catch {
      message.error("保存失败");
    } finally {
      savingEditRef.current = false;
    }
  }

  useEffect(() => {
    if (!editingId) return;
    const onPointerDown = (e: PointerEvent) => {
      const wrap = editorWrapRef.current;
      if (!wrap) return;
      if (wrap.contains(e.target as Node)) return;
      void commitEdit();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [editingId]);

  async function generateImageFor(msg: ChatMessageItem) {
    if (imageBusyId || busy || msg.role !== "assistant") return;
    setImageBusyId(msg.id);
    try {
      const res = await fetch(`/api/chat/messages/${msg.id}/generate-image`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (json?.code === 200 && json.data?.imageUrl) {
        setImageUrls((prev) => ({ ...prev, [msg.id]: json.data.imageUrl as string }));
        message.success("配图已生成");
      } else if (json?.code === 402) {
        message.error(json.msg ?? "积分不足");
      } else {
        message.error(json?.msg ?? "生成图片失败");
      }
    } catch {
      message.error("生成图片失败");
    } finally {
      setImageBusyId(null);
    }
  }

  async function removeMediaFor(msg: ChatMessageItem, kind: "image" | "video") {
    if (msg.role !== "assistant") return;
    const key = `${msg.id}:${kind}`;
    if (removingMediaKey) return;
    setRemovingMediaKey(key);
    try {
      const res = await fetch(`/api/chat/messages/${msg.id}/media?kind=${kind}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (json?.code !== 200) {
        message.error(json?.msg ?? "删除失败");
        return;
      }
      if (kind === "image") {
        setImageUrls((prev) => ({ ...prev, [msg.id]: "" }));
        onAssistantMediaChangeRef.current?.(msg.id, { image_url: null });
        message.success("已删除配图");
      } else {
        setVideoUrls((prev) => ({ ...prev, [msg.id]: "" }));
        setVideoStatus((prev) => ({ ...prev, [msg.id]: "" }));
        onAssistantMediaChangeRef.current?.(msg.id, {
          video_url: null,
          video_status: null,
          video_error: null,
        });
        message.success("已删除视频");
      }
    } catch {
      message.error("删除失败");
    } finally {
      setRemovingMediaKey(null);
    }
  }

  async function generateVideoFor(msg: ChatMessageItem) {
    if (msg.role !== "assistant") return;
    const already = (videoStatus[msg.id] || msg.video_status) === "generating";
    if (already) return;
    setVideoStatus((prev) => ({ ...prev, [msg.id]: "generating" }));
    setVideoErrors((prev) => ({ ...prev, [msg.id]: "" }));
    try {
      const res = await fetch(`/api/chat/messages/${msg.id}/generate-video`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (json?.code === 200) {
        setVideoStatus((prev) => ({ ...prev, [msg.id]: "generating" }));
        message.success(json.msg ?? "视频开始生成，大约需要 15–30 分钟，可离开页面稍后回来");
      } else if (json?.code === 402) {
        setVideoStatus((prev) => ({ ...prev, [msg.id]: msg.video_status ?? null }));
        message.error(json.msg ?? "积分不足");
      } else {
        setVideoStatus((prev) => ({ ...prev, [msg.id]: "failed" }));
        message.error(json?.msg ?? "生成视频失败");
      }
    } catch {
      setVideoStatus((prev) => ({ ...prev, [msg.id]: "failed" }));
      message.error("生成视频失败");
    }
  }

  useEffect(() => {
    const generatingIds = visibleMessages
      .filter((m) => (videoStatus[m.id] || m.video_status) === "generating")
      .map((m) => m.id);
    if (generatingIds.length === 0 || !activeSessionId) return;
    let cancelled = false;
    const tick = async () => {
      await Promise.all(
        generatingIds.map(async (mid) => {
          const res = await fetch(`/api/chat/messages/${mid}/generate-video`);
          const json = await res.json().catch(() => null);
          if (cancelled || json?.code !== 200) return;
          const status = String(json.data?.video_status ?? "");
          setVideoStatus((prev) => {
            if (prev[mid] === "") return prev;
            return prev[mid] === status ? prev : { ...prev, [mid]: status };
          });
          if (json.data?.video_url) {
            setVideoUrls((prev) => {
              if (prev[mid] === "") return prev;
              return prev[mid] === json.data.video_url ? prev : { ...prev, [mid]: json.data.video_url as string };
            });
          }
          if (typeof json.data?.video_error === "string") {
            setVideoErrors((prev) =>
              prev[mid] === json.data.video_error ? prev : { ...prev, [mid]: json.data.video_error as string },
            );
          }
        }),
      );
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在生成中的消息集合变化时轮询
  }, [visibleMessages.map((m) => `${m.id}:${videoStatus[m.id] || m.video_status || ""}`).join("|"), activeSessionId]);

  const checkpointsByMessage = useMemo(() => {
    const map = new Map<string, SnapshotLite[]>();
    for (const sn of snapshotsBySession[activeSessionId] ?? []) {
      const msgId = sn.last_message_id;
      if (!msgId) continue;
      const list = map.get(msgId) ?? [];
      list.push(sn);
      map.set(msgId, list);
    }
    return map;
  }, [snapshotsBySession, activeSessionId]);

  function scrollToMessage(messageId: string) {
    const el = document.getElementById(`chat-msg-${messageId}`);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightMsgId(messageId);
    window.setTimeout(() => {
      setHighlightMsgId((cur) => (cur === messageId ? null : cur));
    }, 1800);
    return true;
  }

  function jumpToCheckpoint(sessionId: string, sn: SnapshotLite) {
    const targetId = sn.last_message_id;
    if (!targetId) {
      message.info("该检查点没有关联的对话节点");
      return;
    }
    if (sessionId !== activeSessionId) {
      pendingScrollMsgId.current = targetId;
      onSelectSession(sessionId);
      return;
    }
    if (!scrollToMessage(targetId)) {
      message.info("未找到对应的对话节点，可能已不在当前记录中");
    }
  }

  useEffect(() => {
    const targetId = pendingScrollMsgId.current;
    if (!targetId || visibleMessages.length === 0) return;
    const exists = visibleMessages.some((m) => m.id === targetId);
    if (!exists) return;
    pendingScrollMsgId.current = null;
    requestAnimationFrame(() => {
      scrollToMessage(targetId);
    });
  }, [activeSessionId, messages, visibleMessages]);

  async function submitCheckpoint() {
    if (!activeSessionId) return;
    setCheckpointBusy(true);
    try {
      const res = await fetch(`/api/chat/sessions/${activeSessionId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: checkpointNote.trim() }),
      });
      const json = await res.json();
      if (json.code === 200) {
        message.success("已生成检查点");
        const created = json.data?.snapshot as SnapshotApi | undefined;
        if (created) {
          setSnapshotsBySession((prev) => ({
            ...prev,
            [activeSessionId]: [normalizeSnapshot(created), ...(prev[activeSessionId] ?? [])],
          }));
        }
        setCheckpointOpen(false);
        setCheckpointNote("");
      } else {
        message.error(json.msg ?? "生成检查点失败");
      }
    } catch {
      message.error("生成检查点失败");
    } finally {
      setCheckpointBusy(false);
    }
  }

  const bubbleActionClass =
    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#DCE9FF] bg-white px-3 py-1.5 text-xs font-medium text-[#5B6B8C] hover:border-[#5B9DFF] hover:text-[#3F86F5] disabled:cursor-wait disabled:opacity-60";

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
            className="cursor-pointer rounded-lg bg-[#EEF6FF] px-2.5 py-1 text-xs font-medium text-[#3F86F5] hover:bg-[#DCE9FF]"
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
                const snaps = snapshotsBySession[s.id] ?? [];
                return (
                  <li key={s.id}>
                    <div
                      className={[
                        "rounded-xl px-3 py-2.5 transition-colors",
                        active ? "bg-[#EEF6FF] text-[#1F2A44]" : "text-[#5B6B8C] hover:bg-[#F8FBFF]",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        className="w-full cursor-pointer text-left"
                        onClick={() => onSelectSession(s.id)}
                      >
                        <p className={`truncate text-sm ${active ? "font-semibold" : "font-medium"}`}>
                          {s.title || "未命名会话"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#8A97B3]">
                          {new Date(s.created_at).toLocaleString()}
                        </p>
                      </button>
                      {snaps.length > 0 ? (
                        <div className="mt-1.5 grid grid-cols-2 gap-1.5 border-t border-[#E6ECF5] pt-1.5">
                          {snaps.map((sn) => (
                            <button
                              key={sn.id}
                              type="button"
                              className="cursor-pointer rounded-lg border border-[#DCE9FF] bg-white px-1.5 py-1.5 text-left hover:border-[#5B9DFF]"
                              title={sn.last_assistant_preview || sn.label || "检查点"}
                              onClick={() => jumpToCheckpoint(s.id, sn)}
                            >
                              <p className="truncate text-[11px] font-medium text-[#3F86F5]">
                                {sn.label?.trim() || "检查点"}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[#5B6B8C]">
                                {sn.last_assistant_preview || "AI 内容"}
                              </p>
                              <p className="mt-0.5 text-[10px] text-[#8A97B3]">
                                {new Date(sn.created_at).toLocaleString()}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
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
            className="cursor-pointer rounded-lg px-2 py-1 text-sm text-[#5B6B8C] transition-colors hover:bg-[#EEF6FF] hover:text-[#3F86F5]"
            aria-label={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? "‹" : "›"}
          </button>
          <Link href={backHref} className="text-sm text-[#5B6B8C] hover:text-[#3F86F5]">
            ← {backLabel}
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-[#1F2A44]">{title}</h1>
          {personaLabel && <span className="sf-tag shrink-0">面具：{personaLabel}</span>}
          {headerExtra}
        </header>

        {affinity && (
          <div className="shrink-0 border-b border-[#E6ECF5] bg-white px-4 py-2">
            <div className="flex items-center gap-3 text-xs text-[#5B6B8C]">
              <span className="shrink-0">好感度 {affinity.score}/100 · {affinity.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEF6FF]">
                <div
                  className="h-full rounded-full bg-[#5B9DFF] transition-[width]"
                  style={{ width: `${Math.max(0, Math.min(100, affinity.score))}%` }}
                />
              </div>
            </div>
          </div>
        )}

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
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto w-full max-w-[1080px] space-y-5">
              {visibleMessages.length === 0 && !streamText ? (
                <p className="py-16 text-center text-sm text-[#8A97B3]">
                  {emptyHint || `输入消息，开始与 ${assistantName} 对话`}
                </p>
              ) : null}

              {visibleMessages.map((msg) => {
                const isUser = msg.role === "user";
                const isLast = msg.id === lastVisible?.id;
                const isLastAssistant = msg.id === lastAssistant?.id;
                const showCheckpoint = canCheckpoint && isLast;
                const showRegenerate = canRegenerate && isLastAssistant;
                const showImageBtn = !isUser && !busy && !streamText;
                const imageUrl = imageUrls[msg.id] ?? msg.image_url ?? "";
                const videoUrl = videoUrls[msg.id] ?? msg.video_url ?? "";
                const vStatus =
                  videoStatus[msg.id] !== undefined ? videoStatus[msg.id] || "" : msg.video_status || "";
                const videoGenerating = vStatus === "generating";
                const videoFailed = vStatus === "failed";
                const msgCheckpoints = checkpointsByMessage.get(msg.id) ?? [];
                const highlighted = highlightMsgId === msg.id;
                return (
                  <div
                    key={msg.id}
                    id={`chat-msg-${msg.id}`}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex flex-col gap-1.5 ${isUser ? "max-w-[88%] items-end" : editingId === msg.id ? "w-full max-w-none items-stretch" : "max-w-[88%] items-start"}`}>
                      {!isUser ? (
                        <p className="px-1 text-xs font-semibold text-[#6B7CFF]">{assistantName}</p>
                      ) : null}
                      {editingId === msg.id ? (
                        <div ref={editorWrapRef} className="w-full">
                          <Input.TextArea
                            autoFocus
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            autoSize={{ minRows: 10, maxRows: 28 }}
                            className="!min-h-[240px] !text-sm !leading-relaxed"
                          />
                          <p className="mt-1 px-1 text-[11px] text-[#8A97B3]">点击编辑区外的页面保存修改</p>
                        </div>
                      ) : (
                      <div
                        className={[
                          "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap transition-shadow",
                          isUser
                            ? "bg-[#5B9DFF] text-white rounded-br-md"
                            : "bg-white text-[#1F2A44] border border-[#E6ECF5] shadow-sm rounded-bl-md",
                          highlighted ? "ring-2 ring-[#5B9DFF] ring-offset-2" : "",
                        ].join(" ")}
                      >
                        <MessageText text={msg.content} />
                      </div>
                      )}
                      {imageUrl || videoGenerating || videoUrl || videoFailed ? (
                      <div className="flex flex-wrap items-start gap-2">
                      {imageUrl ? (
                        <ChatMediaThumb
                          kind="image"
                          src={imageUrl}
                          onRemove={() => void removeMediaFor(msg, "image")}
                          removing={removingMediaKey === `${msg.id}:image`}
                        />
                      ) : null}
                      {videoGenerating || videoUrl || videoFailed ? (
                        <ChatMediaThumb
                          kind="video"
                          src={videoUrl}
                          generating={videoGenerating}
                          failed={videoFailed && !videoUrl}
                          failedReason={videoErrors[msg.id] || msg.video_error}
                          onRemove={() => void removeMediaFor(msg, "video")}
                          removing={removingMediaKey === `${msg.id}:video`}
                        />
                      ) : null}
                      </div>
                      ) : null}
                      {msgCheckpoints.length > 0 ? (
                        <div className={`flex flex-wrap gap-1 ${isUser ? "justify-end" : "justify-start"}`}>
                          {msgCheckpoints.map((sn) => (
                            <span
                              key={sn.id}
                              className="inline-flex items-center gap-1 rounded-full bg-[#EEF6FF] px-2 py-0.5 text-[11px] text-[#3F86F5]"
                            >
                              <Flag className="h-3 w-3" aria-hidden />
                              {sn.label?.trim() || "检查点"}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {showCheckpoint || showRegenerate || showImageBtn ? (
                        <div className="flex w-full flex-wrap items-center justify-end gap-2">
                          {showImageBtn && editingId !== msg.id ? (
                            <button
                              type="button"
                              className={bubbleActionClass}
                              onClick={() => startEdit(msg)}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                              编辑
                            </button>
                          ) : null}
                          {showCheckpoint ? (
                            <button
                              type="button"
                              className={bubbleActionClass}
                              onClick={() => setCheckpointOpen(true)}
                            >
                              <Flag className="h-3.5 w-3.5" aria-hidden />
                              生成检查点
                            </button>
                          ) : null}
                          {showImageBtn ? (
                            <button
                              type="button"
                              className={bubbleActionClass}
                              disabled={imageBusyId === msg.id || videoGenerating}
                              onClick={() => void generateImageFor(msg)}
                            >
                              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                              {imageBusyId === msg.id ? "配图生成中…" : imageUrl ? "重新生成图片" : "生成图片"}
                            </button>
                          ) : null}
                          {showImageBtn ? (
                            <button
                              type="button"
                              className={bubbleActionClass}
                              disabled={videoGenerating || Boolean(imageBusyId)}
                              onClick={() => void generateVideoFor(msg)}
                            >
                              <Video className="h-3.5 w-3.5" aria-hidden />
                              {videoGenerating ? "视频生成中…" : videoUrl ? "重新生成视频" : "生成视频"}
                            </button>
                          ) : null}
                          {showRegenerate ? (
                            <button
                              type="button"
                              className={bubbleActionClass}
                              onClick={() => void onRegenerate?.()}
                            >
                              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                              重新生成
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {streamText ? (
                <div className="flex justify-start">
                  <div className="max-w-[88%]">
                    <p className="mb-1.5 px-1 text-xs font-semibold text-[#6B7CFF]">{assistantName}</p>
                    <div className="rounded-2xl rounded-bl-md border border-[#E6ECF5] bg-white px-4 py-3 text-sm leading-relaxed text-[#1F2A44] shadow-sm whitespace-pre-wrap">
                      <MessageText text={streamText} />
                      <span className="ml-0.5 inline-block animate-pulse text-[#6B7CFF]">▍</span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={bottomRef} />
              </div>
            </div>

            {/* 底部输入卡片 */}
            <div className="shrink-0 border-t border-[#E6ECF5] bg-[#F5F7FB] px-4 py-4">
              <div className="mx-auto max-w-[1080px] rounded-2xl border border-[#E6ECF5] bg-white p-3 shadow-[0_8px_30px_rgba(66,133,244,0.08)]">
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
                        className="cursor-pointer rounded-full border border-[#DCE9FF] px-3 py-1.5 text-xs text-[#5B6B8C] hover:bg-[#F8FBFF]"
                        onClick={onStop}
                      >
                        停止
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy || !inputMessage.trim()}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#5B9DFF] text-white shadow-sm transition enabled:hover:bg-[#7FB4FF] disabled:cursor-not-allowed disabled:opacity-40"
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

      <Modal
        centered
        title="生成检查点"
        open={checkpointOpen}
        okText="确定"
        cancelText="取消"
        confirmLoading={checkpointBusy}
        destroyOnHidden
        styles={{ footer: { marginTop: 32 } }}
        afterOpenChange={(opened) => {
          if (!opened) unlockPageAfterModal();
        }}
        onOk={() => void submitCheckpoint()}
        onCancel={() => {
          if (checkpointBusy) return;
          setCheckpointOpen(false);
          setCheckpointNote("");
        }}
      >
        <p className="mb-2 text-sm text-[#5B6B8C]">可为检查点填写备注，也可以留空。</p>
        <Input.TextArea
          placeholder="检查点备注（可选）"
          maxLength={120}
          rows={4}
          showCount
          value={checkpointNote}
          onChange={(e) => setCheckpointNote(e.target.value)}
        />
      </Modal>
    </main>
  );
}
