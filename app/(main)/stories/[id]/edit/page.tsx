"use client";

import { App, Dropdown, Modal, Spin } from "antd";
import type { MenuProps } from "antd";
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

function siblingSort(a: OutlineNode, b: OutlineNode) {
  return a.sort_order - b.sort_order || a.id.localeCompare(b.id);
}

function getSiblingsOf(list: OutlineNode[], node: OutlineNode): OutlineNode[] {
  return list.filter((x) => x.parent_id === node.parent_id).sort(siblingSort);
}

function getSiblingsByParentId(list: OutlineNode[], parentId: string | null): OutlineNode[] {
  return list.filter((x) => x.parent_id === parentId).sort(siblingSort);
}

function getInsertSlots(siblings: OutlineNode[], movingId?: string): { label: string; insertIndex: number }[] {
  const list = movingId ? siblings.filter((s) => s.id !== movingId) : siblings;
  const slots: { label: string; insertIndex: number }[] = [{ label: "最前", insertIndex: 0 }];
  list.forEach((s, i) => {
    slots.push({ label: `在「${s.title}」之后`, insertIndex: i + 1 });
  });
  return slots;
}

function buildInsertOrder(siblings: OutlineNode[], newNode: OutlineNode, insertIndex: number): OutlineNode[] {
  const reordered = siblings.filter((s) => s.id !== newNode.id);
  const idx = Math.max(0, Math.min(insertIndex, reordered.length));
  reordered.splice(idx, 0, newNode);
  return reordered;
}

function buildSiblingReorder(siblings: OutlineNode[], nodeId: string, insertIndex: number): OutlineNode[] | null {
  const currentIdx = siblings.findIndex((x) => x.id === nodeId);
  if (currentIdx < 0 || insertIndex === currentIdx) return null;
  const reordered = siblings.filter((x) => x.id !== nodeId);
  reordered.splice(insertIndex, 0, siblings[currentIdx]);
  return reordered;
}

type AddChapterDraft = {
  mode: "root" | "child" | "sibling";
  parentId: string | null;
  anchorTitle?: string;
};

type ExportFormat = "markdown" | "txt" | "pdf" | "epub";

export default function StoryOutlineEditPage() {
  const { message, modal } = App.useApp();
  const params = useParams<{ id: string }>();
  const storyId = params.id ?? "";
  const [nodes, setNodes] = useState<OutlineNode[]>([]);
  const [storyTitle, setStoryTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [outlineBusy, setOutlineBusy] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<AddChapterDraft | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addInsertIndex, setAddInsertIndex] = useState(0);
  const [positionPickerId, setPositionPickerId] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [charOptions, setCharOptions] = useState<CharOption[]>([]);
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [relLeft, setRelLeft] = useState("");
  const [relRight, setRelRight] = useState("");
  const [relType, setRelType] = useState<string>(RELATION_TYPES[0]);
  const [relDesc, setRelDesc] = useState("");
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

  const ordered = useMemo(() => orderedOutline(nodes), [nodes]);
  const positionNode = positionPickerId ? nodes.find((n) => n.id === positionPickerId) : null;
  const positionSlots = useMemo(() => {
    if (!positionNode) return [];
    return getInsertSlots(getSiblingsOf(nodes, positionNode), positionNode.id);
  }, [positionNode, nodes]);
  const addInsertSlots = useMemo(() => {
    if (!addDraft) return [];
    return getInsertSlots(getSiblingsByParentId(nodes, addDraft.parentId));
  }, [addDraft, nodes]);

  async function exportStory(fmt: ExportFormat) {
    setExportingFormat(fmt);
    try {
      const res = await fetch(`/api/stories/${storyId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: fmt, branch_mode: "none" }),
      });
      const blob = await res.blob();
      const fallback = res.headers.get("X-StoryForge-Fallback");
      const fallbackReason = res.headers.get("X-StoryForge-Fallback-Reason");
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
        if (fallbackReason === "missing_cjk_font") {
          message.warning(
            "PDF 导出需要中文字体，自动下载失败。请将 NotoSansSC-Regular.otf 放到 storage/fonts/ 后重试，已改为 Markdown 备份。",
          );
        } else {
          message.warning("目标格式生成失败或超时，已改为 Markdown 备份（正文含说明注释）。");
        }
      } else {
        message.success(`已导出 ${fmt.toUpperCase()} 文件`);
      }
    } catch {
      message.error("导出失败，请重试");
    } finally {
      setExportingFormat(null);
    }
  }

  function renderExportButton(fmt: ExportFormat, label: string, title?: string) {
    const loading = exportingFormat === fmt;
    return (
      <button
        type="button"
        disabled={exportingFormat !== null}
        className="sf-tag inline-flex min-w-[3.25rem] items-center justify-center gap-1.5"
        title={title}
        onClick={() => void exportStory(fmt)}
      >
        {loading ? <Spin size="small" /> : null}
        {loading ? "导出中" : label}
      </button>
    );
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

  async function loadOutline() {
    const res = await fetch(`/api/stories/${storyId}/outline`);
    const json = await res.json();
    if (!res.ok) {
      setErr(json.msg ?? "加载大纲失败");
      return false;
    }
    setNodes((json.data ?? []) as OutlineNode[]);
    return true;
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

  function applyMoveLocally(nodeId: string, direction: "up" | "down") {
    setNodes((prev) => {
      const node = prev.find((x) => x.id === nodeId);
      if (!node) return prev;
      const siblings = prev.filter((x) => x.parent_id === node.parent_id).sort(siblingSort);
      const idx = siblings.findIndex((x) => x.id === nodeId);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return prev;
      const a = siblings[idx];
      const b = siblings[swapIdx];
      return prev.map((n) => {
        if (n.id === a.id) return { ...n, sort_order: b.sort_order };
        if (n.id === b.id) return { ...n, sort_order: a.sort_order };
        return n;
      });
    });
  }

  function collectDescendantIds(list: OutlineNode[], rootId: string): Set<string> {
    const ids = new Set<string>([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of list) {
        if (n.parent_id && ids.has(n.parent_id) && !ids.has(n.id)) {
          ids.add(n.id);
          changed = true;
        }
      }
    }
    return ids;
  }

  async function persistSiblingOrder(reordered: OutlineNode[], snapshot: OutlineNode[]): Promise<boolean> {
    const orderMap = new Map(reordered.map((n, i) => [n.id, i]));
    const updates = reordered
      .map((n, i) => ({ id: n.id, sort_order: i }))
      .filter(({ id, sort_order }) => snapshot.find((x) => x.id === id)?.sort_order !== sort_order);

    if (updates.length === 0) return true;

    setNodes((prev) =>
      prev.map((n) => {
        const next = orderMap.get(n.id);
        return next !== undefined ? { ...n, sort_order: next } : n;
      }),
    );

    for (const { id, sort_order } of updates) {
      const res = await fetch(`/api/stories/${storyId}/outline/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(String(j.msg ?? "排序失败"));
        setNodes(snapshot);
        await loadOutline();
        return false;
      }
    }
    return true;
  }

  async function addNode(
    parentId: string | null,
    title: string,
    insertIndex: number,
    content = "",
  ): Promise<boolean> {
    setOutlineBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/stories/${storyId}/outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type: "chapter", content, parent_id: parentId }),
      });
      const json = await res.json();
      if (json.code !== 200) {
        setErr(json.msg ?? "创建失败");
        return false;
      }
      const created = json.data as OutlineNode;
      const withNew = [...nodes, created];
      const siblings = getSiblingsByParentId(withNew, parentId);
      const reordered = buildInsertOrder(siblings, created, insertIndex);
      setNodes(withNew);
      const ok = await persistSiblingOrder(reordered, withNew);
      if (!ok) return false;
      message.success("章节已添加");
      return true;
    } finally {
      setOutlineBusy(false);
    }
  }

  function openAddModal(draft: AddChapterDraft) {
    const siblings = getSiblingsByParentId(nodes, draft.parentId);
    setAddDraft(draft);
    setAddTitle("");
    setAddContent("");
    setAddInsertIndex(siblings.length);
    setAddModalOpen(true);
  }

  function closeAddModal() {
    setAddModalOpen(false);
    setAddDraft(null);
    setAddTitle("");
    setAddContent("");
    setAddInsertIndex(0);
  }

  async function confirmAddNode() {
    const title = addTitle.trim();
    if (!title) {
      message.warning("请输入章节名称");
      return;
    }
    if (!addDraft) return;
    const ok = await addNode(addDraft.parentId, title, addInsertIndex, addContent.trim());
    if (ok) closeAddModal();
  }

  async function moveNodeToPosition(nodeId: string, insertIndex: number) {
    const node = nodes.find((x) => x.id === nodeId);
    if (!node) return;
    const siblings = getSiblingsOf(nodes, node);
    const reordered = buildSiblingReorder(siblings, nodeId, insertIndex);
    if (!reordered) {
      setPositionPickerId(null);
      return;
    }
    const snapshot = nodes;
    setPositionPickerId(null);
    const ok = await persistSiblingOrder(reordered, snapshot);
    if (ok) message.success("位置已调整");
  }

  async function patchNode(nodeId: string, payload: Record<string, unknown>) {
    if (payload.move === "up" || payload.move === "down") {
      applyMoveLocally(nodeId, payload.move);
      const res = await fetch(`/api/stories/${storyId}/outline/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ move: payload.move }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(String(j.msg ?? "排序失败"));
        await loadOutline();
      }
      return;
    }

    if (payload.sort_order !== undefined) {
      const snapshot = nodes;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, sort_order: Number(payload.sort_order) } : n,
        ),
      );
      const res = await fetch(`/api/stories/${storyId}/outline/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(String(j.msg ?? "排序失败"));
        setNodes(snapshot);
        await loadOutline();
      }
      return;
    }

    const prev = nodes;
    setNodes((list) =>
      list.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              ...(payload.title !== undefined ? { title: String(payload.title) } : {}),
              ...(payload.content !== undefined ? { content: String(payload.content) } : {}),
            }
          : n,
      ),
    );

    const res = await fetch(`/api/stories/${storyId}/outline/${nodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(String(j.msg ?? "更新失败"));
      setNodes(prev);
    }
  }

  async function executeRemoveNode(nodeId: string) {
    const snapshot = nodes;
    const removeIds = collectDescendantIds(nodes, nodeId);
    setNodes((prev) => prev.filter((n) => !removeIds.has(n.id)));
    const res = await fetch(`/api/stories/${storyId}/outline/${nodeId}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(String(j.msg ?? "删除失败"));
      setNodes(snapshot);
    } else {
      message.success("已删除");
    }
  }

  function removeNode(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId);
    modal.confirm({
      title: "删除章节",
      content: `确定删除「${node?.title ?? "该章节"}」及其所有子章节？此操作不可恢复。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: () => executeRemoveNode(nodeId),
    });
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

  if (!storyId) return null;

  if (loading) {
    return <main className="sf-loading" />;
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-[#5B9DFF]">章节大纲</p>
        <div className="mt-0.5 flex items-center justify-between gap-4">
          <h1 className="min-w-0 truncate text-xl font-semibold text-[#1F2A44]">{storyTitle || storyId}</h1>
          <button
            type="button"
            className="sf-btn-primary shrink-0"
            disabled={outlineBusy}
            onClick={() => openAddModal({ mode: "root", parentId: null })}
          >
            添加章节
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#5B6B8C]">导出</span>
          {renderExportButton("markdown", "MD")}
          {renderExportButton("txt", "TXT")}
          {renderExportButton("epub", "EPUB")}
          {renderExportButton("pdf", "PDF", "中文 PDF 首次导出会自动下载字体到 storage/fonts/")}
        </div>
        <p className="mt-1 whitespace-nowrap text-sm text-[#5B6B8C]">
          按顺序列出章节；可添加同级或子章节，更多操作在右侧菜单中。
        </p>
      </div>

      {err ? (
        <div className="mb-4 rounded-lg border border-[#DCE9FF] bg-[#FFF8F8] px-4 py-3 text-sm text-[#1F2A44]">
          {err}
        </div>
      ) : null}

      {!err ? (
        <>
          <ul className="space-y-3">
            {ordered.map((n) => {
              const depth = depthOf(nodes, n.id);
              const siblings = getSiblingsOf(nodes, n);
              const canReorder = siblings.length > 1;
              const moreMenuItems: MenuProps["items"] = [];
              if (canReorder) {
                moreMenuItems.push(
                  { key: "up", label: "上移", onClick: () => void patchNode(n.id, { move: "up" }) },
                  { key: "down", label: "下移", onClick: () => void patchNode(n.id, { move: "down" }) },
                  { type: "divider" },
                  {
                    key: "position",
                    label: "调整位置",
                    onClick: () => setPositionPickerId(n.id),
                  },
                );
              }
              moreMenuItems.push({
                key: "delete",
                label: "删除",
                danger: true,
                onClick: () => void removeNode(n.id),
              });
              return (
              <li
                key={n.id}
                className="sf-card p-4"
                style={{ marginLeft: depth * 14 }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-[#5B6B8C]">{depth === 0 ? "章节" : "子章节"}</span>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="sf-tag"
                      onClick={() => openAddModal({ mode: "child", parentId: n.id, anchorTitle: n.title })}
                    >
                      添加子章节
                    </button>
                    <button
                      type="button"
                      className="sf-tag"
                      onClick={() =>
                        openAddModal({ mode: "sibling", parentId: n.parent_id, anchorTitle: n.title })
                      }
                    >
                      添加同级章节
                    </button>
                    <Dropdown menu={{ items: moreMenuItems }} trigger={["hover"]} placement="bottomRight">
                      <button
                        type="button"
                        className="sf-tag px-2.5 text-base leading-none"
                        aria-label="更多操作"
                      >
                        ⋯
                      </button>
                    </Dropdown>
                  </div>
                </div>
                <label className="mt-2 block text-xs text-[#5B6B8C]">
                  章节摘要（可选）
                  <textarea
                    className="sf-input mt-1 min-h-16 text-sm"
                    placeholder="简要描述本章要点…"
                    defaultValue={n.content}
                    key={`c-${n.id}-${n.updated_at ?? ""}`}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== n.content) void patchNode(n.id, { content: v });
                    }}
                  />
                </label>
              </li>
              );
            })}
            {ordered.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[#DCE9FF] p-6 text-center text-sm text-[#5B6B8C]">
                还没有章节，点击标题旁的「添加章节」开始。
              </li>
            ) : null}
          </ul>

          <Modal
            open={addModalOpen}
            title={
              addDraft?.mode === "child"
                ? "添加子章节"
                : addDraft?.mode === "sibling"
                  ? "添加同级章节"
                  : "添加章节"
            }
            okText="确定"
            cancelText="取消"
            confirmLoading={outlineBusy}
            onCancel={closeAddModal}
            onOk={() => void confirmAddNode()}
            destroyOnHidden
          >
            {addDraft?.anchorTitle ? (
              <p className="mb-3 text-sm text-[#5B6B8C]">
                {addDraft.mode === "child"
                  ? `将在「${addDraft.anchorTitle}」下添加`
                  : `与「${addDraft.anchorTitle}」同级添加`}
              </p>
            ) : null}
            <label className="block text-sm font-medium text-[#1F2A44]">
              章节名称
              <input
                className="sf-input mt-1"
                placeholder="请输入章节名称"
                value={addTitle}
                autoFocus
                onChange={(e) => setAddTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmAddNode();
                }}
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-[#1F2A44]">
              插入位置
              <select
                className="sf-input mt-1"
                value={addInsertIndex}
                onChange={(e) => setAddInsertIndex(Number(e.target.value))}
              >
                {addInsertSlots.map((slot) => (
                  <option key={`add-pos-${slot.insertIndex}`} value={slot.insertIndex}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm font-medium text-[#1F2A44]">
              章节摘要（可选）
              <textarea
                className="sf-input mt-1 min-h-24 text-sm"
                placeholder="简要描述本章要点…"
                value={addContent}
                onChange={(e) => setAddContent(e.target.value)}
              />
            </label>
          </Modal>

          <Modal
            open={positionPickerId !== null}
            title={positionNode ? `调整位置 · ${positionNode.title}` : "调整位置"}
            footer={null}
            onCancel={() => setPositionPickerId(null)}
            destroyOnHidden
          >
            <p className="mb-3 text-sm text-[#5B6B8C]">选择要插入到的同级位置：</p>
            <div className="flex flex-col gap-2">
              {positionSlots.map((slot) => (
                <button
                  key={`modal-${positionPickerId}-${slot.insertIndex}`}
                  type="button"
                  className="w-full rounded-lg border border-[#DCE9FF] bg-[#F8FBFF] px-3 py-2.5 text-left text-sm text-[#1F2A44] transition-colors hover:bg-[#EEF6FF]"
                  onClick={() => positionPickerId && void moveNodeToPosition(positionPickerId, slot.insertIndex)}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </Modal>

          <div className="sf-card mt-8 space-y-4 p-4">
            <div>
              <p className="text-sm font-medium text-[#1F2A44]">人物关系图谱（MVP）</p>
              <p className="mt-1 text-xs text-[#5B6B8C]">
                同一对角色可添加多条关系（如既是亲属又是盟友）。类型：敌对 / 盟友 / 亲属 / 恋人 / 上下级 / 合作。
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
