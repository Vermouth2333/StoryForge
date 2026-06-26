"use client";

import { App } from "antd";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ModRow = {
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

export default function ModerationPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<ModRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [remark, setRemark] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/moderation");
    const json = await res.json();
    if (json.code === 200) {
      setRows(json.data ?? []);
    } else {
      message.error(json.msg ?? "加载失败");
      setRows([]);
    }
    setLoading(false);
  }, [message]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function decide(item: ModRow, status: "approved" | "taken_down" | "rejected") {
    const note = remark[item.id]?.trim() ?? "";
    if (status === "rejected" && !note) {
      message.warning("驳回时请填写备注");
      return;
    }
    const res = await fetch(`/api/admin/moderation/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, audit_remark: note }),
    });
    const json = await res.json();
    if (json.code !== 200) {
      message.error(json.msg ?? "操作失败");
      return;
    }
    message.success("操作成功");
    await load();
  }

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1F2A44]">内容审核列表（MVP）</h1>
          <p className="mt-2 text-sm text-[#5B6B8C]">
            发布命中敏感规则时自动入队。管理员环境变量：
            <code className="rounded bg-[#F0F6FF] px-1 text-xs">STORYFORGE_ADMIN_USER_IDS</code>
            （逗号分隔用户 ID，需与当前登录 Cookie / x-user-id 一致）。
          </p>
        </div>
        <Link href="/" className="sf-tag shrink-0">
          返回首页
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        <button type="button" className="sf-tag" onClick={() => void load()} disabled={loading}>
          刷新
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[#DCE9FF] bg-white">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#DCE9FF] bg-[#F8FBFF] text-xs text-[#5B6B8C]">
              <th className="p-3 font-medium">类型</th>
              <th className="p-3 font-medium">目标 ID</th>
              <th className="p-3 font-medium">原因</th>
              <th className="p-3 font-medium">提交用户</th>
              <th className="p-3 font-medium">状态</th>
              <th className="p-3 font-medium">创建时间</th>
              <th className="p-3 font-medium">备注 / 操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#5B6B8C]">
                  加载中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#5B6B8C]">
                  暂无审核记录。
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[#EEF6FF] text-[#1F2A44]">
                  <td className="p-3 align-top text-xs uppercase">{r.content_type}</td>
                  <td className="p-3 align-top font-mono text-xs">{r.target_id}</td>
                  <td className="p-3 align-top text-xs text-[#5B6B8C]">{r.trigger_reason}</td>
                  <td className="p-3 align-top font-mono text-xs">{r.submitter_user_id ?? "—"}</td>
                  <td className="p-3 align-top">
                    <span className="rounded bg-[#EEF6FF] px-2 py-0.5 text-xs">{r.status}</span>
                  </td>
                  <td className="p-3 align-top text-xs text-[#5B6B8C]">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="p-3 align-top">
                    <input
                      className="sf-input mb-2 w-full max-w-[200px] text-xs"
                      placeholder="处理备注"
                      value={remark[r.id] ?? ""}
                      onChange={(e) =>
                        setRemark((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                    />
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="sf-tag text-[11px]"
                        onClick={() => void decide(r, "approved")}
                      >
                        通过
                      </button>
                      <button
                        type="button"
                        className="sf-tag text-[11px]"
                        onClick={() => void decide(r, "taken_down")}
                      >
                        下架
                      </button>
                      <button
                        type="button"
                        className="sf-tag text-[11px] text-red-700"
                        onClick={() => void decide(r, "rejected")}
                      >
                        驳回
                      </button>
                    </div>
                    {r.reviewed_at ? (
                      <p className="mt-2 text-[10px] text-[#5B6B8C]">
                        已处理 {r.reviewed_by} · {new Date(r.reviewed_at).toLocaleString()}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
