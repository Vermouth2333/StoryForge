"use client";

import { useEffect, useState } from "react";

type SessionItem = {
  id: string;
  title: string;
  story_id: string | null;
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
  payload: { last_message_id?: string; last_message_at?: string };
  created_at: string;
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionForHistory, setSelectedSessionForHistory] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagePage, setMessagePage] = useState(1);
  const [sessionKeyword, setSessionKeyword] = useState("");
  const [sessionSnapshots, setSessionSnapshots] = useState<SessionSnapshotItem[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState("");

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
      `/api/chat/sessions/${sessionIdParam}/messages?page=${page}&page_size=20`,
    );
    const json = await res.json();
    setMessages(json.data ?? []);
    setMessagePage(page);
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

  async function restoreSessionSnapshot(snapshotId: string) {
    if (!selectedSessionForHistory) return;
    if (!window.confirm("将删除该快照时间点之后的所有消息，确定恢复到此检查点吗？")) {
      return;
    }
    const res = await fetch(
      `/api/chat/sessions/${selectedSessionForHistory}/snapshots/${snapshotId}/restore`,
      { method: "POST" },
    );
    const json = await res.json();
    if (json.code === 200) {
      await loadMessages(selectedSessionForHistory, 1);
      await loadSessionSnapshots(selectedSessionForHistory);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions();
  }, []);

  useEffect(() => {
    if (!selectedSessionForHistory) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    void loadMessages(selectedSessionForHistory, 1);
    void loadSessionSnapshots(selectedSessionForHistory);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedSessionForHistory]);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="section-title">会话历史</h2>
          <p className="section-subtitle">查看和管理你的创作会话记录</p>
        </div>
        {/* 搜索框 */}
        <div className="flex items-center gap-2">
          <input
            className="sf-input w-48 md:w-64"
            placeholder="搜索会话..."
            value={sessionKeyword}
            onChange={(e) => setSessionKeyword(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && loadSessions()}
          />
          <button className="sf-btn-secondary shrink-0" onClick={loadSessions}>
            搜索
          </button>
        </div>
      </div>

      {/* 会话列表和消息 */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* 会话列表 */}
        <div className="sf-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#1f2a44] flex items-center gap-2">
              <span>💬</span> 会话列表
            </h3>
            <span className="text-xs text-[#5b6b8c]">{sessions.length} 个会话</span>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
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
                <p className="font-medium text-[#1f2a44] truncate text-sm">{s.title}</p>
                <p className="text-xs text-[#5b6b8c] mt-1">
                  {new Date(s.updated_at).toLocaleDateString()}
                </p>
                {s.story_id && (
                  <span className="inline-block mt-1 text-xs bg-[#eef6ff] text-[#5b9dff] px-2 py-0.5 rounded-full">
                    关联故事
                  </span>
                )}
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-center py-12 text-[#5b6b8c]">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm">暂无会话记录</p>
              </div>
            )}
          </div>
        </div>

        {/* 消息内容 */}
        <div className="sf-card p-5">
          {selectedSessionForHistory ? (
            <>
              {/* 消息列表 */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl p-4 ${
                      m.role === "user"
                        ? "bg-[#eef6ff] border-l-4 border-[#5b9dff]"
                        : m.role === "assistant"
                          ? "bg-[#f0f9ff] border-l-4 border-[#4facfe]"
                          : "bg-[#f8fafc] border-l-4 border-[#94a3b8]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        m.role === "user"
                          ? "bg-[#5b9dff] text-white"
                          : m.role === "assistant"
                            ? "bg-[#4facfe] text-white"
                            : "bg-[#94a3b8] text-white"
                      }`}>
                        {m.role === "user" ? "我" : m.role === "assistant" ? "AI" : "系统"}
                      </span>
                      <span className="text-xs text-[#5b6b8c]">
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-[#1f2a44] leading-relaxed">{m.content}</p>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-center py-12 text-[#5b6b8c]">
                    <div className="text-4xl mb-3">💬</div>
                    <p className="text-sm">该会话暂无消息</p>
                  </div>
                )}
              </div>

              {/* 分页 */}
              {messages.length > 0 && (
                <div className="flex items-center justify-center gap-3 mb-4">
                  <button
                    className="sf-tag"
                    onClick={() =>
                      loadMessages(selectedSessionForHistory, Math.max(1, messagePage - 1))
                    }
                  >
                    上一页
                  </button>
                  <span className="text-sm text-[#5b6b8c]">第 {messagePage} 页</span>
                  <button
                    className="sf-tag"
                    onClick={() => loadMessages(selectedSessionForHistory, messagePage + 1)}
                  >
                    下一页
                  </button>
                </div>
              )}

              {/* 创建快照 */}
              <div className="border-t border-[#dce9ff] pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    className="sf-input flex-1 max-w-xs"
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
                  <div className="mt-4">
                    <p className="text-xs font-medium text-[#1f2a44] mb-2">检查点记录</p>
                    <div className="space-y-2">
                      {sessionSnapshots.map((sn) => (
                        <div
                          key={sn.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-[#f0f6ff] p-3"
                        >
                          <div className="min-w-0">
                            {sn.label ? (
                              <span className="text-sm font-medium text-[#1f2a44]">{sn.label}</span>
                            ) : (
                              <span className="text-sm text-[#5b6b8c]">（无备注）</span>
                            )}
                            <span className="text-xs text-[#5b6b8c] ml-2">
                              · {new Date(sn.created_at).toLocaleString()}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="sf-tag shrink-0 text-xs"
                            onClick={() => restoreSessionSnapshot(sn.id)}
                          >
                            恢复
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-[#5b6b8c]">
              <div className="text-6xl mb-4">👈</div>
              <p className="text-sm">选择一个会话查看消息</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
