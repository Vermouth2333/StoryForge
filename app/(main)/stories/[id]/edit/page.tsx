"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RELATION_TYPES } from "@/lib/character-relation";

type OutlineNode = {
  id: string;
  story_id: string;
  parent_id: string | null;
  title: string;
  type: string;
  sort_order: number;
  content: string;
  updated_at?: string;
};

function orderedOutline(nodes: OutlineNode[]): OutlineNode[] {
  const children = new Map<string | null, OutlineNode[]>();
  for (const n of nodes) {
    const p = n.parent_id;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(n);
  }
  for (const [, arr] of children) {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  }
  const out: OutlineNode[] = [];
  function walk(pid: string | null) {
    const ch = children.get(pid) ?? [];
    for (const n of ch) {
      out.push(n);
      walk(n.id);
    }
  }
  walk(null);
  return out;
}

type CharOption = { id: string; name: string };

type RelationRow = {
  id: string;
  character_left_id: string;
  character_right_id: string;
  relation_type: string;
  description: string;
  name_left: string | null;
  name_right: string | null;
};

type BranchRow = {
  id: string;
  story_id: string;
  parent_branch_id: string | null;
  fork_outline_node_id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function depthOf(nodes: OutlineNode[], id: string): number {
  let d = 0;
  let cur: OutlineNode | undefined = nodes.find((x) => x.id === id);
  while (cur?.parent_id) {
    d++;
    cur = nodes.find((x) => x.id === cur!.parent_id);
  }
  return d;
}

export default function StoryOutlineEditPage() {
  const params = useParams<{ id: string }>();
  const storyId = params.id ?? "";
  const [nodes, setNodes] = useState<OutlineNode[]>([]);
  const [storyTitle, setStoryTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [newTitle, setNewTitle] = useState("新章节");
  const [newType, setNewType] = useState<"chapter" | "branch" | "note">("chapter");
  const [newParentId, setNewParentId] = useState<string>("");
  const [exportBusy, setExportBusy] = useState(false);
  const [charOptions, setCharOptions] = useState<CharOption[]>([]);
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [relLeft, setRelLeft] = useState("");
  const [relRight, setRelRight] = useState("");
  const [relType, setRelType] = useState<string>(RELATION_TYPES[0]);
  const [relDesc, setRelDesc] = useState("");
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [branchTitle, setBranchTitle] = useState("新剧情分支");
  const [branchForkId, setBranchForkId] = useState("");
  const [branchParentId, setBranchParentId] = useState("");
  const [branchDesc, setBranchDesc] = useState("");
  const [exportBranchAppendix, setExportBranchAppendix] = useState(false);

  const ordered = useMemo(() => orderedOutline(nodes), [nodes]);

  async function exportStory(fmt: "markdown" | "txt" | "pdf" | "epub") {
    setExportBusy(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: fmt,
          branch_mode: exportBranchAppendix ? "annotate" : "none",
        }),
      });
      const blob = await res.blob();
      const fallback = res.headers.get("X-StoryForge-Fallback");
      let name =
        `${storyTitle || storyId}.${fmt === "markdown" ? "md" : fmt}`;
      const cd = res.headers.get("Content-Disposition");
      const m = cd?.match(/filename\*=UTF-8''([^;\s]+)/);
      if (m?.[1]) {
        try {
          name = decodeURIComponent(m[1]);
        } catch {
          /* keep default */
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      if (fallback) {
        alert("目标格式生成失败或超时，已改为 Markdown 备份（正文含说明注释）。");
      }
    } finally {
      setExportBusy(false);
    }
  }

  async function load() {
    const [outlineRes, storyRes, relRes] = await Promise.all([
      fetch(`/api/stories/${storyId}/outline`),
      fetch(`/api/stories/${storyId}`),
      fetch(`/api/stories/${storyId}/relations`),
    ]);
    const outlineJson = await outlineRes.json();
    const storyJson = await storyRes.json();
    const relJson = await relRes.json();
    if (!outlineRes.ok) {
      setErr(outlineJson.msg ?? "无权或故事不存在");
      setLoading(false);
      return;
    }
    setNodes(outlineJson.data ?? []);
    const branchRes = await fetch(`/api/stories/${storyId}/branches`);
    const branchJson = await branchRes.json();
    if (branchJson.code === 200) setBranches(branchJson.data ?? []);

    if (storyJson.code === 200) setStoryTitle(storyJson.data?.title ?? "");
    if (relRes.ok && relJson.code === 200) setRelations(relJson.data ?? []);

    const [mineRes, pubRes] = await Promise.all([
      fetch("/api/characters?mine=1"),
      fetch("/api/characters"),
    ]);
    const mineJson = mineRes.ok ? await mineRes.json() : { data: [] };
    const pubJson = pubRes.ok ? await pubRes.json() : { data: [] };
    const map = new Map<string, string>();
    for (const x of [...(mineJson.data ?? []), ...(pubJson.data ?? [])]) {
      map.set(x.id as string, String(x.name ?? ""));
    }
    setCharOptions([...map.entries()].map(([id, name]) => ({ id, name })));

    setLoading(false);
  }

  useEffect(() => {
    if (!storyId) return;
    void load();
  }, [storyId]);

  async function addNode() {
    const body: Record<string, unknown> = {
      title: newTitle.trim(),
      type: newType,
      content: "",
    };
    if (newParentId) body.parent_id = newParentId;
    const res = await fetch(`/api/stories/${storyId}/outline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.code !== 200) setErr(json.msg ?? "创建失败");
    await load();
  }

  async function patchNode(nodeId: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/stories/${storyId}/outline/${nodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(String(j.msg ?? "更新失败"));
    }
    await load();
  }

  async function removeNode(nodeId: string) {
    if (!confirm("删除该节点及其所有子节点？")) return;
    await fetch(`/api/stories/${storyId}/outline/${nodeId}`, { method: "DELETE" });
    await load();
  }

  async function addRelation() {
    if (!relLeft || !relRight || relLeft === relRight) return;
    const res = await fetch(`/api/stories/${storyId}/relations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        character_a_id: relLeft,
        character_b_id: relRight,
        relation_type: relType,
        description: relDesc.trim(),
      }),
    });
    const json = await res.json();
    if (json.code !== 200) setErr(json.msg ?? "关系添加失败");
    else setErr("");
    await load();
  }

  async function deleteRelation(relationId: string) {
    if (!confirm("删除该人物关系？")) return;
    await fetch(`/api/stories/${storyId}/relations/${relationId}`, { method: "DELETE" });
    await load();
  }

  function forkNodeLabel(forkId: string) {
    const n = nodes.find((x) => x.id === forkId);
    return n ? n.title : forkId;
  }

  function parentBranchLabel(pid: string | null) {
    if (!pid) return "—";
    const b = branches.find((x) => x.id === pid);
    return b ? b.title : pid;
  }

  async function addBranch() {
    const t = branchTitle.trim();
    const fork = branchForkId.trim();
    if (!t || !fork) {
      setErr("请填写分支标题并选择大纲锚点节点");
      return;
    }
    const body: Record<string, unknown> = {
      title: t,
      fork_outline_node_id: fork,
      description: branchDesc.trim(),
    };
    if (branchParentId.trim()) body.parent_branch_id = branchParentId.trim();
    const res = await fetch(`/api/stories/${storyId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.code !== 200) setErr(json.msg ?? "创建分支失败");
    else {
      setErr("");
      setBranchDesc("");
      setBranchParentId("");
    }
    await load();
  }

  async function toggleBranchArchive(b: BranchRow) {
    const next = b.status === "archived" ? "active" : "archived";
    await fetch(`/api/stories/${storyId}/branches/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await load();
  }

  async function removeBranch(branchId: string) {
    if (!confirm("删除该分支记录？")) return;
    const res = await fetch(`/api/stories/${storyId}/branches/${branchId}`, { method: "DELETE" });
    const json = await res.json();
    if (json.code !== 200) setErr(json.msg ?? "删除失败");
    else setErr("");
    await load();
  }

  if (!storyId) return null;

  if (loading) {
    return <main className="mx-auto max-w-3xl p-6 text-sm text-[#5B6B8C]">加载大纲...</main>;
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[#5B9DFF]">章节大纲（文档节点结构）</p>
          <h1 className="text-xl font-semibold text-[#1F2A44]">{storyTitle || storyId}</h1>
          <p className="mt-1 text-sm text-[#5B6B8C]">
            type：chapter / branch / note · 同级按 sort_order；上下移动在同一父节点内交换。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#5B6B8C]">导出</span>
          <button
            type="button"
            disabled={exportBusy}
            className="sf-tag"
            onClick={() => void exportStory("markdown")}
          >
            MD
          </button>
          <button
            type="button"
            disabled={exportBusy}
            className="sf-tag"
            onClick={() => void exportStory("txt")}
          >
            TXT
          </button>
          <button
            type="button"
            disabled={exportBusy}
            className="sf-tag"
            onClick={() => void exportStory("epub")}
          >
            EPUB
          </button>
          <button
            type="button"
            disabled={exportBusy}
            className="sf-tag"
            title="中文 PDF 可将 NotoSansSC-Regular.otf 放到 storage/fonts/"
            onClick={() => void exportStory("pdf")}
          >
            PDF
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#5B6B8C]">
            <input
              type="checkbox"
              checked={exportBranchAppendix}
              onChange={(e) => setExportBranchAppendix(e.target.checked)}
            />
            附带分支附录
          </label>
          <Link href="/" className="sf-tag">
            返回首页
          </Link>
        </div>
      </div>

      {err ? (
        <div className="mb-4 rounded-lg border border-[#DCE9FF] bg-[#FFF8F8] px-4 py-3 text-sm text-[#1F2A44]">
          {err}
        </div>
      ) : null}

      {!err ? (
        <>
          <div className="sf-card mb-6 space-y-3 p-4">
            <p className="text-sm font-medium text-[#1F2A44]">新增节点</p>
            <div className="flex flex-wrap gap-2">
              <input className="sf-input max-w-xs" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <select
                className="sf-input w-32 py-2"
                value={newType}
                onChange={(e) => setNewType(e.target.value as typeof newType)}
              >
                <option value="chapter">chapter</option>
                <option value="branch">branch</option>
                <option value="note">note</option>
              </select>
              <select
                className="sf-input flex-1 min-w-[140px]"
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
              >
                <option value="">顶层（无父）</option>
                {ordered.map((n) => (
                  <option key={n.id} value={n.id}>
                    {"—".repeat(depthOf(nodes, n.id))} {n.title}
                  </option>
                ))}
              </select>
              <button type="button" className="sf-btn-primary shrink-0" onClick={() => void addNode()}>
                添加
              </button>
            </div>
          </div>

          <ul className="space-y-3">
            {ordered.map((n) => (
              <li
                key={n.id}
                className="sf-card p-4"
                style={{ marginLeft: depthOf(nodes, n.id) * 14 }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-medium uppercase text-[#5B9DFF]">{n.type}</span>
                    <input
                      className="sf-input mt-1 font-medium"
                      defaultValue={n.title}
                      key={`${n.id}-${n.updated_at ?? n.sort_order}`}
                      onBlur={(e) => {
                        const t = e.target.value.trim();
                        if (t && t !== n.title) void patchNode(n.id, { title: t });
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="sf-tag" onClick={() => void patchNode(n.id, { move: "up" })}>
                      上移
                    </button>
                    <button type="button" className="sf-tag" onClick={() => void patchNode(n.id, { move: "down" })}>
                      下移
                    </button>
                    <button type="button" className="sf-tag text-red-700" onClick={() => void removeNode(n.id)}>
                      删除
                    </button>
                  </div>
                </div>
                <label className="mt-2 block text-xs text-[#5B6B8C]">
                  大纲要点 / 附注
                  <textarea
                    className="sf-input mt-1 min-h-20 text-sm"
                    defaultValue={n.content}
                    key={`c-${n.id}-${n.updated_at ?? ""}`}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== n.content) void patchNode(n.id, { content: v });
                    }}
                  />
                </label>
              </li>
            ))}
            {ordered.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[#DCE9FF] p-6 text-center text-sm text-[#5B6B8C]">
                暂无节点，请在上方添加。
              </li>
            ) : null}
          </ul>

          <div className="sf-card mt-8 space-y-4 p-4">
            <div>
              <p className="text-sm font-medium text-[#1F2A44]">剧情分支（story_branches）</p>
              <p className="mt-1 text-xs text-[#5B6B8C]">
                从大纲节点锚定一条分支线，用于记录走向说明；可归档次要分支。合并回主线与导出分支策略见文档后续迭代。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className="sf-input max-w-[200px]"
                placeholder="分支标题"
                value={branchTitle}
                onChange={(e) => setBranchTitle(e.target.value)}
              />
              <select
                className="sf-input min-w-[160px]"
                value={branchForkId}
                onChange={(e) => setBranchForkId(e.target.value)}
              >
                <option value="">大纲锚点节点</option>
                {ordered.map((n) => (
                  <option key={`fork-${n.id}`} value={n.id}>
                    {"—".repeat(depthOf(nodes, n.id))} {n.title}
                  </option>
                ))}
              </select>
              <select
                className="sf-input min-w-[140px]"
                value={branchParentId}
                onChange={(e) => setBranchParentId(e.target.value)}
              >
                <option value="">父分支（可选）</option>
                {branches.map((b) => (
                  <option key={`pb-${b.id}`} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
              <input
                className="sf-input min-w-[180px] flex-1"
                placeholder="分支说明（可选）"
                value={branchDesc}
                onChange={(e) => setBranchDesc(e.target.value)}
              />
              <button type="button" className="sf-btn-primary shrink-0" onClick={() => void addBranch()}>
                创建分支
              </button>
            </div>
            <ul className="space-y-2 text-xs">
              {branches.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-[#F8FBFF] p-3 text-[#1F2A44]"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{b.title}</span>
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                        b.status === "archived"
                          ? "bg-[#E8E8E8] text-[#5B6B8C]"
                          : "bg-[#EEF6FF] text-[#5B9DFF]"
                      }`}
                    >
                      {b.status}
                    </span>
                    <p className="mt-1 text-[#5B6B8C]">
                      锚点：{forkNodeLabel(b.fork_outline_node_id)}
                      {b.parent_branch_id ? ` · 父分支：${parentBranchLabel(b.parent_branch_id)}` : ""}
                    </p>
                    {b.description ? (
                      <p className="mt-1 whitespace-pre-wrap text-[#5B6B8C]">{b.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="sf-tag" onClick={() => void toggleBranchArchive(b)}>
                      {b.status === "archived" ? "恢复" : "归档"}
                    </button>
                    <button type="button" className="sf-tag text-red-700" onClick={() => void removeBranch(b.id)}>
                      删除
                    </button>
                  </div>
                </li>
              ))}
              {branches.length === 0 ? (
                <li className="text-[#5B6B8C]">暂无分支记录。</li>
              ) : null}
            </ul>
          </div>

          <div className="sf-card mt-8 space-y-4 p-4">
            <div>
              <p className="text-sm font-medium text-[#1F2A44]">人物关系图谱（MVP）</p>
              <p className="mt-1 text-xs text-[#5B6B8C]">
                文档约定类型：敌对 / 盟友 / 亲属 / 恋人 / 上下级 / 合作。两端角色须为你创建或市场已发布。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="sf-input min-w-[140px]"
                value={relLeft}
                onChange={(e) => setRelLeft(e.target.value)}
              >
                <option value="">角色 A</option>
                {charOptions.map((c) => (
                  <option key={`a-${c.id}`} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="sf-input min-w-[140px]"
                value={relRight}
                onChange={(e) => setRelRight(e.target.value)}
              >
                <option value="">角色 B</option>
                {charOptions.map((c) => (
                  <option key={`b-${c.id}`} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select className="sf-input w-28 py-2" value={relType} onChange={(e) => setRelType(e.target.value)}>
                {RELATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                className="sf-input min-w-[160px] flex-1"
                placeholder="备注（可选）"
                value={relDesc}
                onChange={(e) => setRelDesc(e.target.value)}
              />
              <button type="button" className="sf-btn-primary shrink-0" onClick={() => void addRelation()}>
                添加关系
              </button>
            </div>
            <ul className="space-y-2 text-xs">
              {relations.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F8FBFF] p-2 text-[#1F2A44]"
                >
                  <span>
                    {r.name_left ?? r.character_left_id} → {r.name_right ?? r.character_right_id}{" "}
                    <strong className="text-[#3F86F5]">{r.relation_type}</strong>
                    {r.description ? ` · ${r.description}` : ""}
                  </span>
                  <button type="button" className="sf-tag text-red-700" onClick={() => void deleteRelation(r.id)}>
                    删除
                  </button>
                </li>
              ))}
              {relations.length === 0 ? (
                <li className="text-[#5B6B8C]">暂无人物关系。</li>
              ) : null}
            </ul>
          </div>
        </>
      ) : null}
    </main>
  );
}
