"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { App, Modal, Radio } from "antd";
import { EmptyState } from "@/components/EmptyState";
import { IconBadge, Inbox, MessagesSquare, MessageSquareText, MousePointerClick } from "@/components/icons";
import { PageHero } from "@/components/PageHero";
import { getContinueSessionHref } from "@/lib/session-continue";

type SessionItem = {
  id: string;
  title: string;
  session_type: string;
  story_id: string | null;
  character_id: string | null;
  world_id: string | null;
  updated_at: string;
};

type MessageItem = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  created_at: string;
};

type SessionSnapshotItem = {
  id: string;
  session_id: string;
  label: string;
  payload: {
    last_message_id?: string;
    last_message_at?: string;
    last_assistant_id?: string;
    last_assistant_preview?: string;
  };
  created_at: string;
};

export default function HistoryPage() {
  const { modal, message } = App.useApp();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionForHistory, setSelectedSessionForHistory] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagePage, setMessagePage] = useState(1);
  const [messagePageSize] = useState(20);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [sessionKeyword, setSessionKeyword] = useState("");
  const [sessionSnapshots, setSessionSnapshots] = useState<SessionSnapshotItem[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"markdown" | "txt" | "pdf" | "epub" | null>(null);
  const [exportScope, setExportScope] = useState<"ai" | "all">("all");
  const [exportBusy, setExportBusy] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState("");
  const [editingSnapshotLabel, setEditingSnapshotLabel] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  async function loadSessions() {
    const params = new URLSearchParams();
    if (sessionKeyword.trim()) params.set("q", sessionKeyword.trim());
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/chat/sessions${query}`);
    const json = await res.json();
    const list: SessionItem[] = json.data ?? [];
    setSessions(list);
    if (list.length > 0 && !selectedSessionForHistory) {
      setSelectedSessionForHistory(list[0].id);
    }
  }

  async function loadMessages(sessionIdParam: string, page = 1) {
    const res = await fetch(
      `/api/chat/sessions/${sessionIdParam}/messages?page=${page}&page_size=${messagePageSize}`,
    );
    const json = await res.json();
    const list: MessageItem[] = json.data ?? [];
    setMessages(list);
    setMessagePage(page);
    setHasMoreMessages(list.length >= messagePageSize);
  }

  async function loadSessionSnapshots(sid: string) {
    const res = await fetch(`/api/chat/sessions/${sid}/snapshots`);
    const json = await res.json();
    if (json.code !== 200) {
      setSessionSnapshots([]);
      return;
    }
    setSessionSnapshots(json.data?.snapshots ?? []);
  }

  async function createSessionSnapshot() {
    if (!selectedSessionForHistory) return;
    const res = await fetch(`/api/chat/sessions/${selectedSessionForHistory}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: snapshotLabel.trim() }),
    });
    const json = await res.json();
    if (json.code === 200) {
      await loadSessionSnapshots(selectedSessionForHistory);
      setSnapshotLabel("");
    }
  }

  async function saveSnapshotLabel(snapshotId: string) {
    if (!selectedSessionForHistory) return;
    setSavingSnapshot(true);
    try {
      const res = await fetch(
        `/api/chat/sessions/${selectedSessionForHistory}/snapshots/${snapshotId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: editingSnapshotLabel.trim() }),
        },
      );
      const json = await res.json();
      if (json.code === 200) {
        setSessionSnapshots((prev) =>
          prev.map((sn) => (sn.id === snapshotId ? { ...sn, label: editingSnapshotLabel.trim() } : sn)),
        );
        setEditingSnapshotId("");
        message.success("备注已更新");
      } else {
        message.error(json.msg ?? "保存失败");
      }
    } finally {
      setSavingSnapshot(false);
    }
  }

  async function downloadSessionExport() {
    if (!selectedSessionForHistory || !exportFormat) return;
    setExportBusy(true);
    try {
      const res = await fetch(`/api/chat/sessions/${selectedSessionForHistory}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: exportFormat, scope: exportScope }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        message.error(err?.msg ?? "导出失败");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
      const plain = /filename="([^"]+)"/i.exec(cd);
      const filename = star
        ? decodeURIComponent(star[1])
        : plain?.[1] ?? `session-export.${exportFormat === "markdown" ? "md" : exportFormat}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportFormat(null);
      message.success("已开始下载");
    } catch {
      message.error("导出失败");
    } finally {
      setExportBusy(false);
    }
  }

  function jumpToHistoryMessage(messageId?: string) {
    if (!messageId) {
      message.info("该检查点没有关联的对话节点");
      return;
    }
    const el = document.getElementById(`history-msg-${messageId}`);
    if (!el) {
      message.info("对应消息不在当前页，可翻页后再试");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function restoreSessionSnapshot(snapshotId: string) {
    if (!selectedSessionForHistory) return;
    modal.confirm({
      centered: true,
      title: "恢复检查点",
      content: "将删除该快照时间点之后的所有消息，确定恢复到此检查点吗？",
      okText: "恢复",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        const res = await fetch(
          `/api/chat/sessions/${selectedSessionForHistory}/snapshots/${snapshotId}/restore`,
          { method: "POST" },
        );
        const json = await res.json();
        if (json.code === 200) {
          await loadMessages(selectedSessionForHistory, 1);
          await loadSessionSnapshots(selectedSessionForHistory);
          message.success("已恢复检查点");
        } else {
          message.error(json.msg ?? "恢复失败");
        }
      },
    });
  }

  function deleteSessionSnapshot(snapshotId: string) {
    if (!selectedSessionForHistory) return;
    modal.confirm({
      centered: true,
      title: "删除检查点",
      content: "确定删除该检查点？此操作不可恢复。",
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        const res = await fetch(
          `/api/chat/sessions/${selectedSessionForHistory}/snapshots/${snapshotId}`,
          { method: "DELETE" },
        );
        const json = await res.json();
        if (json.code === 200) {
          setSessionSnapshots((prev) => prev.filter((sn) => sn.id !== snapshotId));
          if (editingSnapshotId === snapshotId) setEditingSnapshotId("");
          message.success("已删除检查点");
        } else {
          message.error(json.msg ?? "删除失败");
        }
      },
    });
  }

  function deleteSession(sessionId: string) {
    const target = sessions.find((s) => s.id === sessionId);
    modal.confirm({
      centered: true,
      title: "删除会话",
      content: `确定删除会话「${target?.title ?? "未命名"}」？此操作不可恢复。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
        const json = await res.json();
        if (json.code !== 200) {
          message.error(json.msg ?? "删除失败");
          return;
        }
        const remaining = sessions.filter((s) => s.id !== sessionId);
        setSessions(remaining);
        if (selectedSessionForHistory === sessionId) {
          const nextId = remaining[0]?.id ?? "";
          setSelectedSessionForHistory(nextId);
          setMessages([]);
          setSessionSnapshots([]);
          if (nextId) {
            await loadMessages(nextId, 1);
            await loadSessionSnapshots(nextId);
          }
        }
        message.success("会话已删除");
      },
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions();
  }, []);

  useEffect(() => {
    if (!selectedSessionForHistory) return;
    setExportOpen(false);
    setEditingSnapshotId("");
    /* eslint-disable react-hooks/set-state-in-effect */
    void loadMessages(selectedSessionForHistory, 1);
    void loadSessionSnapshots(selectedSessionForHistory);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedSessionForHistory]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHero
        title="会话历史"
        subtitle="查看和管理你的创作会话记录"
        actions={
          <div className="flex items-center gap-2">
            <input
              className="sf-input w-40 md:w-56"
              placeholder="搜索会话..."
              value={sessionKeyword}
              onChange={(e) => setSessionKeyword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && loadSessions()}
            />
            <button className="sf-btn-secondary shrink-0" onClick={loadSessions}>
              搜索
            </button>
          </div>
        }
      />

      {/* 会话列表和消息 */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:grid lg:grid-cols-[minmax(280px,340px)_1fr]">
        {/* 会话列表 */}
        <div className="sf-card flex max-h-[36vh] min-h-0 flex-col p-5 lg:max-h-none lg:h-full">
          <div className="mb-4 flex shrink-0 items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#1f2a44]">
              <IconBadge icon={MessagesSquare} tone="history" size="sm" /> 会话列表
            </h3>
            <span className="text-xs text-[#5b6b8c]">{sessions.length} 个会话</span>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`cursor-pointer rounded-xl p-3 transition-all ${
                  selectedSessionForHistory === s.id
                    ? "bg-[#eef6ff] border-2 border-[#5b9dff]"
                    : "bg-[#f8fbff] border-2 border-transparent hover:border-[#dce9ff]"
                }`}
                onClick={() => setSelectedSessionForHistory(s.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1f2a44]">{s.title}</p>
                    <p className="mt-1 text-xs text-[#5b6b8c]">
                      {new Date(s.updated_at).toLocaleDateString()}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="inline-block rounded-full bg-[#eef6ff] px-2 py-0.5 text-xs text-[#5b9dff]">
                        {s.session_type === "story"
                          ? "故事"
                          : s.session_type === "character"
                            ? "角色"
                            : s.session_type === "world" || s.session_type === "explore"
                              ? "世界"
                              : s.session_type}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {getContinueSessionHref(s) ? (
                      <Link
                        href={getContinueSessionHref(s)!}
                        className="sf-tag shrink-0 text-xs !text-[#3F86F5]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        继续
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="sf-tag shrink-0 text-xs !text-[#8B2E2E]"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteSession(s.id);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <EmptyState
                icon={Inbox}
                tone="empty"
                description="暂无会话记录"
                className="py-8"
              />
            )}
          </div>
        </div>

        {/* 消息内容 */}
        <div className="sf-card flex min-h-0 flex-1 flex-col p-5">
          {selectedSessionForHistory ? (
            <>
              <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#dce9ff] pb-4">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-[#1f2a44]">
                    {sessions.find((s) => s.id === selectedSessionForHistory)?.title ?? "会话详情"}
                  </h3>
                  <p className="mt-1 text-xs text-[#5b6b8c]">查看消息记录与管理检查点</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {(() => {
                    const selected = sessions.find((s) => s.id === selectedSessionForHistory);
                    const href = selected ? getContinueSessionHref(selected) : null;
                    return (
                      <>
                        <div className="relative">
                          <button
                            type="button"
                            className="sf-tag cursor-pointer"
                            onClick={() => setExportOpen((v) => !v)}
                          >
                            导出
                          </button>
                          {exportOpen ? (
                            <div className="absolute right-0 z-20 mt-1 min-w-[120px] overflow-hidden rounded-xl border border-[#dce9ff] bg-white py-1 shadow-[0_8px_24px_rgba(63,134,245,0.14)]">
                              {(
                                [
                                  ["markdown", "MD"],
                                  ["txt", "TXT"],
                                  ["epub", "EPUB"],
                                  ["pdf", "PDF"],
                                ] as const
                              ).map(([fmt, label]) => (
                                <button
                                  key={fmt}
                                  type="button"
                                  className="block w-full cursor-pointer px-3 py-1.5 text-left text-sm text-[#1f2a44] hover:bg-[#eef6ff]"
                                  onClick={() => {
                                    setExportFormat(fmt);
                                    setExportOpen(false);
                                  }}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        {href ? (
                          <Link href={href} className="sf-tag !text-[#3F86F5]">
                            继续会话
                          </Link>
                        ) : null}
                      </>
                    );
                  })()}
                  <button
                    type="button"
                    className="sf-tag !text-[#8B2E2E]"
                    onClick={() => void deleteSession(selectedSessionForHistory)}
                  >
                    删除此会话
                  </button>
                </div>
              </div>

              {/* 消息列表 */}
              <div className="mb-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
                {messages.map((m) => {
                  const msgCheckpoints = sessionSnapshots.filter(
                    (sn) =>
                      sn.payload?.last_assistant_id === m.id ||
                      sn.payload?.last_message_id === m.id,
                  );
                  return (
                  <div
                    key={m.id}
                    id={`history-msg-${m.id}`}
                    className={`rounded-xl p-4 ${
                      m.role === "user"
                        ? "bg-[#eef6ff] border-l-4 border-[#5b9dff]"
                        : m.role === "assistant"
                          ? "bg-[#f0f9ff] border-l-4 border-[#4facfe]"
                          : "bg-[#f8fafc] border-l-4 border-[#94a3b8]"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          m.role === "user"
                            ? "bg-[#5b9dff] text-white"
                            : m.role === "assistant"
                              ? "bg-[#4facfe] text-white"
                              : "bg-[#94a3b8] text-white"
                        }`}
                      >
                        {m.role === "user" ? "我" : m.role === "assistant" ? "AI" : "系统"}
                      </span>
                      <span className="text-xs text-[#5b6b8c]">
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-[#1f2a44]">{m.content}</p>
                    {msgCheckpoints.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {msgCheckpoints.map((sn) => (
                          <span
                            key={sn.id}
                            className="inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] text-[#3F86F5]"
                          >
                            {sn.label?.trim() || "检查点"}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  );
                })}
                {messages.length === 0 && (
                  <EmptyState
                    icon={MessageSquareText}
                    tone="empty"
                    description="该会话暂无消息"
                    className="py-8"
                  />
                )}
              </div>

              {/* 分页 */}
              {messages.length > 0 && (messagePage > 1 || hasMoreMessages) && (
                <div className="mb-4 flex shrink-0 items-center justify-center gap-3">
                  {messagePage > 1 && (
                    <button
                      className="sf-tag"
                      onClick={() => loadMessages(selectedSessionForHistory, messagePage - 1)}
                    >
                      上一页
                    </button>
                  )}
                  <span className="text-sm text-[#5b6b8c]">第 {messagePage} 页</span>
                  {hasMoreMessages && (
                    <button
                      className="sf-tag"
                      onClick={() => loadMessages(selectedSessionForHistory, messagePage + 1)}
                    >
                      下一页
                    </button>
                  )}
                </div>
              )}

              {/* 创建快照 */}
              <div className="shrink-0 border-t border-[#dce9ff] pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    className="sf-input max-w-xs flex-1"
                    placeholder="添加检查点备注..."
                    value={snapshotLabel}
                    onChange={(e) => setSnapshotLabel(e.target.value)}
                  />
                  <button className="sf-btn-primary shrink-0" onClick={createSessionSnapshot}>
                    创建检查点
                  </button>
                </div>

                {/* 检查点列表 */}
                {sessionSnapshots.length > 0 && (
                  <div className="mt-4 max-h-64 overflow-y-auto">
                    <p className="mb-2 text-xs font-medium text-[#1f2a44]">检查点记录</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {sessionSnapshots.map((sn) => (
                        <div
                          key={sn.id}
                          className="flex cursor-pointer flex-col rounded-xl border border-[#dce9ff] bg-[#f0f6ff] p-3"
                          onClick={() =>
                            jumpToHistoryMessage(sn.payload?.last_assistant_id || sn.payload?.last_message_id)
                          }
                        >
                          {editingSnapshotId === sn.id ? (
                            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                              <textarea
                                className="sf-input min-h-[72px] py-1.5 text-sm"
                                value={editingSnapshotLabel}
                                maxLength={120}
                                placeholder="检查点备注（可留空）"
                                onChange={(e) => setEditingSnapshotLabel(e.target.value)}
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="sf-tag text-xs"
                                  disabled={savingSnapshot}
                                  onClick={() => void saveSnapshotLabel(sn.id)}
                                >
                                  保存
                                </button>
                                <button
                                  type="button"
                                  className="sf-tag text-xs"
                                  onClick={() => setEditingSnapshotId("")}
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="truncate text-sm font-medium text-[#1f2a44]">
                                {sn.label?.trim() || "（无备注）"}
                              </p>
                              <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#5b6b8c]">
                                {sn.payload?.last_assistant_preview
                                  ? `AI：${sn.payload.last_assistant_preview}`
                                  : "未关联到 AI 生成内容"}
                              </p>
                              <p className="mt-1 text-[11px] text-[#8a97b3]">
                                {new Date(sn.created_at).toLocaleString()}
                              </p>
                            </>
                          )}
                          <div
                            className="mt-2 flex flex-wrap gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {editingSnapshotId !== sn.id ? (
                              <button
                                type="button"
                                className="sf-tag shrink-0 text-xs"
                                onClick={() => {
                                  setEditingSnapshotId(sn.id);
                                  setEditingSnapshotLabel(sn.label ?? "");
                                }}
                              >
                                编辑
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="sf-tag shrink-0 text-xs"
                              onClick={() => restoreSessionSnapshot(sn.id)}
                            >
                              恢复
                            </button>
                            <button
                              type="button"
                              className="sf-tag shrink-0 text-xs text-red-500 hover:text-red-600"
                              onClick={() => deleteSessionSnapshot(sn.id)}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon={MousePointerClick}
              tone="empty"
              description="选择一个会话查看消息"
              className="h-full py-8"
            />
          )}
        </div>
      </div>

      <Modal
        centered
        title={`导出会话${exportFormat ? ` · ${exportFormat.toUpperCase()}` : ""}`}
        open={Boolean(exportFormat)}
        okText="导出"
        cancelText="取消"
        confirmLoading={exportBusy}
        onOk={() => void downloadSessionExport()}
        onCancel={() => {
          if (exportBusy) return;
          setExportFormat(null);
        }}
      >
        <p className="mb-3 text-sm text-[#5B6B8C]">选择要写入文件的内容范围。</p>
        <Radio.Group
          value={exportScope}
          onChange={(e) => setExportScope(e.target.value)}
          className="flex flex-col gap-2"
        >
          <Radio value="ai" className="!cursor-pointer">只导出 AI 生成的内容</Radio>
          <Radio value="all" className="!cursor-pointer">导出用户提问和 AI 生成的内容</Radio>
        </Radio.Group>
        {sessions.find((s) => s.id === selectedSessionForHistory)?.session_type === "story" ? (
          <p className="mt-3 text-xs text-[#8A97B3]">故事会话将按大纲分章导出。</p>
        ) : null}
      </Modal>
    </div>
  );
}
