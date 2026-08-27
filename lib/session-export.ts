import type { ExportBundle } from "@/lib/export-body";
import { buildExportBundle } from "@/lib/export-body";
import type { OutlineNode } from "@/lib/outline-order";
import { orderedOutline } from "@/lib/outline-order";

export type SessionExportMessage = {
  role: "user" | "assistant" | "system" | string;
  content: string;
};

export type SessionExportScope = "ai" | "all";

function formatMessages(messages: SessionExportMessage[], scope: SessionExportScope): string {
  const filtered = messages.filter((m) =>
    scope === "ai" ? m.role === "assistant" : m.role === "user" || m.role === "assistant",
  );
  if (filtered.length === 0) return "";
  if (scope === "ai") {
    return filtered.map((m) => m.content.trim()).filter(Boolean).join("\n\n");
  }
  return filtered
    .map((m) => {
      const who = m.role === "user" ? "我" : "AI";
      return `【${who}】\n${m.content.trim()}`;
    })
    .join("\n\n");
}

function chapterAnchors(nodes: OutlineNode[]): OutlineNode[] {
  const ordered = orderedOutline(nodes);
  if (ordered.length === 0) return [];
  const chapters = ordered.filter((n) => n.type === "chapter");
  if (chapters.length > 0) return chapters;
  const roots = ordered.filter((n) => !n.parent_id);
  return roots.length > 0 ? roots : ordered;
}

function assignToChapters(
  messages: SessionExportMessage[],
  chapters: OutlineNode[],
): SessionExportMessage[][] {
  const groups = chapters.map(() => [] as SessionExportMessage[]);
  if (chapters.length === 0 || messages.length === 0) return groups;

  let current = 0;
  for (const msg of messages) {
    if (msg.role === "assistant") {
      for (let i = current + 1; i < chapters.length; i += 1) {
        const title = chapters[i].title.trim();
        if (title && msg.content.includes(title)) {
          current = i;
          break;
        }
      }
    }
    groups[current].push(msg);
  }

  const used = groups.filter((g) => g.length > 0).length;
  if (used <= 1 && messages.length > chapters.length) {
    const even = chapters.map(() => [] as SessionExportMessage[]);
    messages.forEach((m, i) => {
      const idx = Math.min(chapters.length - 1, Math.floor((i * chapters.length) / messages.length));
      even[idx].push(m);
    });
    return even;
  }
  return groups;
}

export function buildSessionExportBundle(opts: {
  title: string;
  summary?: string;
  authorName: string;
  messages: SessionExportMessage[];
  scope: SessionExportScope;
  outlineNodes?: OutlineNode[];
  byOutline?: boolean;
}): ExportBundle {
  const visible = opts.messages.filter((m) => m.role === "user" || m.role === "assistant");
  const chapters = opts.byOutline ? chapterAnchors(opts.outlineNodes ?? []) : [];

  let nodes: OutlineNode[];
  if (chapters.length > 0) {
    const groups = assignToChapters(visible, chapters);
    nodes = chapters.map((ch, i) => {
      const body = formatMessages(groups[i], opts.scope);
      const outlineHint = (ch.content ?? "").trim();
      const parts = [
        outlineHint ? `【大纲】\n${outlineHint}` : "",
        body || "（本章暂无会话内容）",
      ].filter(Boolean);
      return {
        id: ch.id,
        parent_id: null,
        title: ch.title,
        type: "chapter",
        sort_order: i,
        content: parts.join("\n\n"),
      };
    });
  } else {
    nodes = [
      {
        id: "session-body",
        parent_id: null,
        title: "对话记录",
        type: "chapter",
        sort_order: 0,
        content: formatMessages(visible, opts.scope) || "（暂无会话内容）",
      },
    ];
  }

  return buildExportBundle(opts.title, opts.summary ?? "", opts.authorName, nodes);
}
