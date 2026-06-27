"use client";

import { App } from "antd";
import { useEffect, useState } from "react";

type ModerationItem = {
  id: string;
  content_type: string;
  target_id: string;
  trigger_reason: string;
  submitter_user_id: string | null;
  status: string;
  audit_remark: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  approved: "已通过",
  taken_down: "已下架",
  rejected: "已驳回",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  taken_down: "bg-rose-100 text-rose-700",
  rejected: "bg-slate-100 text-slate-600",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  story: "故事",
  character: "角色",
  world: "世界",
};

const TRIGGER_LABELS: Record<string, string> = {
  publish_blocked_sensitive: "发布触发敏感词拦截",
  reported: "用户举报",
};

function detailHref(contentType: string, targetId: string): string {
  if (contentType === "character") return `/characters/${targetId}`;
  if (contentType === "world") return `/worlds/${targetId}`;
  return `/stories/${targetId}`;
}

export default function AdminModerationPage() {
  const { message } = App.useApp();
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending">("pending");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectRemark, setRejectRemark] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/moderation");
      const json = await res.json();
      if (json.code === 200) {
        setItems(json.data ?? []);
      } else {
        message.error(json.msg ?? "加载失败");
      }
    } catch {
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAction(item: ModerationItem, status: "approved" | "taken_down" | "rejected", remark = "") {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/admin/moderation/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, audit_remark: remark }),
      });
      const json = await res.json();
      if (json.code === 200) {
        message.success(
          status === "approved" ? "已通过" : status === "taken_down" ? "已下架" : "已驳回",
        );
        if (status === "rejected") {
          setRejectingId(null);
          setRejectRemark("");
        }
        await load();
      } else {
        message.error(json.msg ?? "操作失败");
      }
    } catch {
      message.error("操作失败");
    } finally {
      setBusyId(null);
    }
  }

  function submitReject(item: ModerationItem) {
    if (!rejectRemark.trim()) {
      message.warning("驳回需要填写备注");
      return;
    }
    void handleAction(item, "rejected", rejectRemark.trim());
  }

  const visible = filter === "pending" ? items.filter((i) => i.status === "pending") : items;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="section-title">审核台</h2>
          <p className="section-subtitle">处理敏感拦截与举报内容</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`sf-tag ${filter === "pending" ? "!bg-[#5B9DFF] !text-white" : ""}`}
            onClick={() => setFilter("pending")}
          >
            待处理 ({items.filter((i) => i.status === "pending").length})
          </button>
          <button
            className={`sf-tag ${filter === "all" ? "!bg-[#5B9DFF] !text-white" : ""}`}
            onClick={() => setFilter("all")}
          >
            全部 ({items.length})
          </button>
          <button className="sf-btn-secondary" onClick={load}>
            刷新
          </button>
        </div>
      </div>

      {loading ? (
        <main className="sf-loading" />
      ) : visible.length === 0 ? (
        <div className="sf-card p-12 text-center text-[#5b6b8c]">
          <div className="text-5xl mb-3">✅</div>
          <p>暂无{filter === "pending" ? "待处理" : ""}审核项</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((item) => (
            <li key={item.id} className="sf-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#EEF6FF] px-2.5 py-0.5 text-xs font-semibold text-[#5B9DFF]">
                      {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[item.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                    <span className="text-xs text-[#5b6b8c]">
                      {TRIGGER_LABELS[item.trigger_reason] ?? item.trigger_reason}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#1f2a44]">
                    目标 ID：
                    <a
                      className="text-[#3f86f5] hover:underline"
                      href={detailHref(item.content_type, item.target_id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.target_id}
                    </a>
                  </p>
                  <p className="mt-1 text-xs text-[#5b6b8c]">
                    提交人：{item.submitter_user_id ?? "—"} · 提交时间：
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                  {item.audit_remark && (
                    <p className="mt-1 text-xs text-[#5b6b8c]">审核备注：{item.audit_remark}</p>
                  )}
                </div>
              </div>

              {item.status === "pending" && (
                <div className="mt-4 border-t border-[#DCE9FF] pt-4">
                  {rejectingId === item.id ? (
                    <div className="space-y-2">
                      <textarea
                        className="sf-input resize-none"
                        rows={2}
                        placeholder="驳回备注（必填）..."
                        value={rejectRemark}
                        onChange={(e) => setRejectRemark(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="sf-btn-primary"
                          disabled={busyId === item.id}
                          onClick={() => submitReject(item)}
                        >
                          确认驳回
                        </button>
                        <button
                          className="sf-btn-secondary"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectRemark("");
                          }}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="sf-btn-primary"
                        disabled={busyId === item.id}
                        onClick={() => handleAction(item, "approved")}
                      >
                        通过
                      </button>
                      <button
                        className="sf-btn-secondary"
                        disabled={busyId === item.id}
                        onClick={() => handleAction(item, "taken_down")}
                      >
                        下架
                      </button>
                      <button
                        className="sf-btn-secondary"
                        disabled={busyId === item.id}
                        onClick={() => {
                          setRejectingId(item.id);
                          setRejectRemark("");
                        }}
                      >
                        驳回
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
