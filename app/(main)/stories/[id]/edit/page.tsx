"use client";

import { App } from "antd";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RELATION_TYPES } from "@/lib/character-relation";
import { RelationGraph } from "@/components/RelationGraph";

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

type ImportedItem = {
  id: string;
  name: string;
  summary: string;
  avatar_url?: string | null;
  cover_asset_id?: string | null;
  is_custom?: number;
};

type WorldOption = { id: string; name: string };

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
  const { message } = App.useApp();
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
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [importedChars, setImportedChars] = useState<ImportedItem[]>([]);
  const [conflictResult, setConflictResult] = useState<{ conflicts: unknown[]; total: number } | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState<{ violations: unknown[] } | null>(null);
  const [consistencyBusy, setConsistencyBusy] = useState(false);
  const [styleResult, setStyleResult] = useState<{ features: unknown; message: string } | null>(null);
  const [styleBusy, setStyleBusy] = useState(false);
  const [importedWorlds, setImportedWorlds] = useState<ImportedItem[]>([]);
  const [worldOptions, setWorldOptions] = useState<WorldOption[]>([]);
  const [importCharId, setImportCharId] = useState("");
  const [importWorldId, setImportWorldId] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);

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
        message.warning("目标格式生成失败或超时，已改为 Markdown 备份（正文含说明注释）。");
      } else {
        message.success(`已导出 ${fmt.toUpperCase()} 文件`);
      }
    } catch {
      message.error("导出失败，请重试");
    } finally {
      setExportBusy(false);
    }
  }

  async function runConflictCheck() {
    setConflictBusy(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/conflict-check`, { method: "POST" });
      const json = await res.json();
      if (json.code === 200) {
        setConflictResult({ conflicts: json.data.conflicts ?? [], total: json.data.total ?? 0 });
        message.success(json.msg ?? "冲突检测完成");
      } else {
        message.error(json.msg ?? "冲突检测失败");
      }
    } catch {
      message.error("冲突检测失败");
    } finally {
      setConflictBusy(false);
    }
  }

  async function runConsistencyCheck() {
    setConsistencyBusy(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/consistency-check`, { method: "POST" });
      const json = await res.json();
      if (json.code === 200) {
        setConsistencyResult({ violations: json.data.violations ?? [] });
        message.success(json.msg ?? "一致性检查完成");
      } else {
        message.error(json.msg ?? "一致性检查失败");
      }
    } catch {
      message.error("一致性检查失败");
    } finally {
      setConsistencyBusy(false);
    }
  }

  async function runStyleExtract() {
    setStyleBusy(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/style`, { method: "POST" });
      const json = await res.json();
      if (json.code === 200) {
        setStyleResult({ features: json.data.features, message: json.data.message ?? "文风锚点提取成功" });
        message.success(json.data.message ?? "文风锚点提取成功");
      } else {
        message.error(json.msg ?? "文风分析失败");
      }
    } catch {
      message.error("文风分析失败");
    } finally {
      setStyleBusy(false);
    }
  }

  async function load() {
    const [outlineRes, storyRes, relRes, importsRes] = await Promise.all([
      fetch(`/api/stories/${storyId}/outline`),
      fetch(`/api/stories/${storyId}`),
      fetch(`/api/stories/${storyId}/relations`),
      fetch(`/api/stories/${storyId}/imports`),
    ]);
    const outlineJson = await outlineRes.json();
    const storyJson = await storyRes.json();
    const relJson = await relRes.json();
    const importsJson = importsRes.ok ? await importsRes.json() : null;
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

    if (importsJson?.code === 200) {
      setImportedChars(importsJson.data?.characters ?? []);
      setImportedWorlds(importsJson.data?.worlds ?? []);
    }

    const [mineRes, pubRes, worldRes] = await Promise.all([
      fetch("/api/characters?mine=1"),
      fetch("/api/characters"),
      fetch("/api/worlds"),
    ]);
    const mineJson = mineRes.ok ? await mineRes.json() : { data: [] };
    const pubJson = pubRes.ok ? await pubRes.json() : { data: [] };
    const map = new Map<string, string>();
    for (const x of [...(mineJson.data ?? []), ...(pubJson.data ?? [])]) {
      map.set(x.id as string, String(x.name ?? ""));
    }
    setCharOptions([...map.entries()].map(([id, name]) => ({ id, name })));

    if (worldRes.ok) {
      const worldJson = await worldRes.json();
      setWorldOptions((worldJson.data ?? []).map((w: { id: string; name: string }) => ({ id: w.id, name: w.name })));
    }

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

  /** 获取同级节点列表（相同 parent_id） */
  function getSiblings(nodeId: string): OutlineNode[] {
    const node = nodes.find((x) => x.id === nodeId);
    if (!node) return [];
    return nodes
      .filter((x) => x.parent_id === node.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  }

  /** 拖拽放置：将 dragNode 移动到 dropNode 的位置（之前或之后） */
  async function handleDrop(dragNodeId: string, dropNodeId: string, position: "before" | "after") {
    const dragNode = nodes.find((x) => x.id === dragNodeId);
    const dropNode = nodes.find((x) => x.id === dropNodeId);
    if (!dragNode || !dropNode) return;
    // 只允许同级拖拽
    if (dragNode.parent_id !== dropNode.parent_id) return;
    if (dragNodeId === dropNodeId) return;

    const siblings = getSiblings(dropNodeId);
    const dropIdx = siblings.findIndex((x) => x.id === dropNodeId);
    // 计算新 sort_order：取目标位置前后的中间值
    let newOrder: number;
    if (position === "before") {
      const prevOrder = dropIdx > 0 ? siblings[dropIdx - 1].sort_order : dropNode.sort_order - 200;
      newOrder = (prevOrder + dropNode.sort_order) / 2;
    } else {
      const nextOrder = dropIdx < siblings.length - 1 ? siblings[dropIdx + 1].sort_order : dropNode.sort_order + 200;
      newOrder = (dropNode.sort_order + nextOrder) / 2;
    }
    await patchNode(dragNodeId, { sort_order: newOrder });
    setDragId(null);
    setDropTarget(null);
  }

  async function removeNode(nodeId: string) {
    if (!confirm("删除该节点及其所有子节点？")) return;
    await fetch(`/api/stories/${storyId}/outline/${nodeId}`, { method: "DELETE" });
    await load();
  }

  async function importCharacter() {
    if (!importCharId) return;
    const res = await fetch(`/api/stories/${storyId}/imports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character_id: importCharId }),
    });
    const json = await res.json();
    if (json.code !== 200) setErr(json.msg ?? "引入失败");
    else setErr("");
    setImportCharId("");
    await load();
  }

  async function importWorld() {
    if (!importWorldId) return;
    const res = await fetch(`/api/stories/${storyId}/imports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ world_id: importWorldId }),
    });
    const json = await res.json();
    if (json.code !== 200) setErr(json.msg ?? "引入失败");
    else setErr("");
    setImportWorldId("");
    await load();
  }

  async function removeImport(type: "character" | "world", itemId: string) {
    await fetch(`/api/stories/${storyId}/imports`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(type === "character" ? { character_id: itemId } : { world_id: itemId }),
    });
    await load();
  }

  async function uploadCover(file: File) {
    setCoverBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/stories/${storyId}/cover`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (json.code !== 200) setErr(json.msg ?? "封面上传失败");
      else setErr("");
    } finally {
      setCoverBusy(false);
    }
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
    return <main className="sf-loading" />;
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[#5B9DFF]">章节大纲（文档节点结构）</p>
          <h1 className="text-xl font-semibold text-[#1F2A44]">{storyTitle || storyId}</h1>
          <p className="mt-1 text-sm text-[#5B6B8C]">
            拖拽节点可调整同级排序 · type：chapter / branch / note
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
          {/* 封面上传 */}
          <div className="sf-card mb-6 flex flex-wrap items-center gap-4 p-4">
            <p className="text-sm font-medium text-[#1F2A44]">故事封面</p>
            <label className={`sf-btn-secondary cursor-pointer ${coverBusy ? "opacity-50 pointer-events-none" : ""}`}>
              {coverBusy ? "上传中..." : "上传封面"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadCover(f);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="text-xs text-[#5B6B8C]">支持 JPG/PNG/WebP，最大 10MB</span>
          </div>

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
            {ordered.map((n) => {
              const isDragging = dragId === n.id;
              const isDropBefore = dropTarget === n.id && dragId !== n.id;
              return (
                <li
                  key={n.id}
                  draggable
                  onDragStart={() => setDragId(n.id)}
                  onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragId && dragId !== n.id) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const midY = rect.top + rect.height / 2;
                      setDropTarget(n.id);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!dragId || dragId === n.id) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    const position = e.clientY < midY ? "before" : "after";
                    void handleDrop(dragId, n.id, position);
                  }}
                  className={[
                    "sf-card p-4 cursor-grab active:cursor-grabbing transition-all duration-200",
                    isDragging ? "opacity-40 scale-95" : "",
                    isDropBefore ? "border-t-2 border-t-[#5B9DFF]" : "",
                  ].join(" ")}
                  style={{ marginLeft: depthOf(nodes, n.id) * 14 }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="cursor-grab text-[#5B6B8C] select-none" title="拖拽排序">⠿</span>
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
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
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
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                </li>
              );
            })}
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
            <RelationGraph relations={relations} onDelete={(id) => void deleteRelation(id)} />
          </div>

          {/* 引入角色卡 / 世界卡 */}
          <div className="sf-card mt-8 space-y-4 p-4">
            <div>
              <p className="text-sm font-medium text-[#1F2A44]">引入角色卡与世界卡</p>
              <p className="mt-1 text-xs text-[#5B6B8C]">
                从你创建或市场已发布的角色卡/世界卡中引入，AI 创作时将自动参考其设定。
              </p>
            </div>

            {/* 引入角色 */}
            <div>
              <p className="text-xs font-medium text-[#1F2A44] mb-2">引入角色卡</p>
              <div className="flex flex-wrap gap-2">
                <select
                  className="sf-input min-w-[200px]"
                  value={importCharId}
                  onChange={(e) => setImportCharId(e.target.value)}
                >
                  <option value="">选择角色卡</option>
                  {charOptions.map((c) => (
                    <option key={`imp-c-${c.id}`} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button type="button" className="sf-btn-primary shrink-0" onClick={() => void importCharacter()}>
                  引入角色
                </button>
              </div>
              {importedChars.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {importedChars.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#F8FBFF] p-2.5 text-xs">
                      <span className="text-[#1F2A44]">
                        <span className="font-medium">{c.name}</span>
                        {c.is_custom ? <span className="ml-1.5 rounded bg-[#EEF6FF] px-1.5 py-0.5 text-[10px] text-[#5B9DFF]">自定义</span> : <span className="ml-1.5 rounded bg-[#F0FFF0] px-1.5 py-0.5 text-[10px] text-[#22C55E]">引入</span>}
                        {c.summary ? <span className="ml-2 text-[#5B6B8C]">— {c.summary.slice(0, 40)}</span> : null}
                      </span>
                      <button type="button" className="text-red-500 hover:text-red-700 shrink-0" onClick={() => void removeImport("character", c.id)}>
                        移除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 引入世界 */}
            <div>
              <p className="text-xs font-medium text-[#1F2A44] mb-2">引入世界卡</p>
              <div className="flex flex-wrap gap-2">
                <select
                  className="sf-input min-w-[200px]"
                  value={importWorldId}
                  onChange={(e) => setImportWorldId(e.target.value)}
                >
                  <option value="">选择世界卡</option>
                  {worldOptions.map((w) => (
                    <option key={`imp-w-${w.id}`} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <button type="button" className="sf-btn-primary shrink-0" onClick={() => void importWorld()}>
                  引入世界
                </button>
              </div>
              {importedWorlds.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {importedWorlds.map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#F8FBFF] p-2.5 text-xs">
                      <span className="text-[#1F2A44]">
                        <span className="font-medium">{w.name}</span>
                        {w.summary ? <span className="ml-2 text-[#5B6B8C]">— {w.summary.slice(0, 40)}</span> : null}
                      </span>
                      <button type="button" className="text-red-500 hover:text-red-700 shrink-0" onClick={() => void removeImport("world", w.id)}>
                        移除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* 创作辅助：冲突检测 / 一致性校验 / 文风保持 */}
      <div className="sf-card mt-8 space-y-6 p-4">
        <div>
          <p className="text-sm font-medium text-[#1F2A44]">创作辅助（MVP）</p>
          <p className="mt-1 text-xs text-[#5B6B8C]">
            对当前故事执行冲突检测、一致性校验与文风分析，结果会注入后续 AI 生成的上下文。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 冲突检测 */}
          <div className="rounded-xl border border-[#DCE9FF] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#1F2A44]">冲突检测</p>
              <button
                type="button"
                className="sf-btn-secondary text-xs"
                disabled={conflictBusy}
                onClick={() => void runConflictCheck()}
              >
                {conflictBusy ? "检测中..." : "运行"}
              </button>
            </div>
            {conflictResult && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-[#5B6B8C]">
                  共 {conflictResult.total} 个冲突
                </p>
                {conflictResult.conflicts.length === 0 ? (
                  <p className="text-xs text-emerald-600">未检测到冲突</p>
                ) : (
                  <ul className="space-y-1.5">
                    {(conflictResult.conflicts as Array<Record<string, unknown>>).map((c, i) => (
                      <li key={i} className="rounded bg-[#F8FBFF] p-2 text-xs">
                        <span className="font-semibold text-[#5B9DFF]">
                          {String(c.level ?? "")}
                        </span>
                        <span className="ml-2 text-[#1F2A44]">
                          {String(c.conflictPoint ?? c.description ?? "")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* 一致性校验 */}
          <div className="rounded-xl border border-[#DCE9FF] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#1F2A44]">一致性校验</p>
              <button
                type="button"
                className="sf-btn-secondary text-xs"
                disabled={consistencyBusy}
                onClick={() => void runConsistencyCheck()}
              >
                {consistencyBusy ? "校验中..." : "运行"}
              </button>
            </div>
            {consistencyResult && (
              <div className="mt-3 space-y-2">
                {consistencyResult.violations.length === 0 ? (
                  <p className="text-xs text-emerald-600">未发现一致性问题</p>
                ) : (
                  <ul className="space-y-1.5">
                    {(consistencyResult.violations as Array<Record<string, unknown>>).map((v, i) => (
                      <li key={i} className="rounded bg-[#F8FBFF] p-2 text-xs">
                        <span className="font-semibold text-[#5B9DFF]">
                          {String(v.type ?? "")}
                        </span>
                        <span className="ml-2 text-[#1F2A44]">
                          {String(v.message ?? v.description ?? "")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* 文风保持器 */}
          <div className="rounded-xl border border-[#DCE9FF] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#1F2A44]">文风保持器</p>
              <button
                type="button"
                className="sf-btn-secondary text-xs"
                disabled={styleBusy}
                onClick={() => void runStyleExtract()}
              >
                {styleBusy ? "分析中..." : "提取文风"}
              </button>
            </div>
            {styleResult && (
              <div className="mt-3">
                <p className="text-xs text-emerald-600">{styleResult.message}</p>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-[#F8FBFF] p-2 text-[10px] text-[#5B6B8C]">
                  {JSON.stringify(styleResult.features, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
