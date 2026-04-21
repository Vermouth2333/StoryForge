import type { OutlineNode } from "@/lib/outline-order";
import { depthOf, orderedOutline } from "@/lib/outline-order";

/** 导出附录：分支记录（文档「[分支: 标题]」样式） */
export type BranchExportLine = {
  branchTitle: string;
  forkNodeTitle: string;
  branchStatus?: string;
};

export type ExportBundle = {
  storyTitle: string;
  summary: string;
  authorName: string;
  ordered: OutlineNode[];
  flatNodes: OutlineNode[];
  branches?: BranchExportLine[];
};

export function buildExportBundle(
  storyTitle: string,
  summary: string,
  authorName: string,
  nodes: OutlineNode[],
  branches?: BranchExportLine[],
): ExportBundle {
  const flatNodes = [...nodes];
  const ordered = orderedOutline(flatNodes);
  return { storyTitle, summary, authorName, ordered, flatNodes, branches };
}

function branchAppendixLines(bundle: ExportBundle): string[] {
  if (!bundle.branches?.length) return [];
  const lines: string[] = ["---", "", "## 分支记录", ""];
  for (const b of bundle.branches) {
    const tag = b.branchStatus === "archived" ? "（已归档）" : "";
    lines.push(
      `- **[分支: ${b.branchTitle}]**${tag} 大纲锚点：「${b.forkNodeTitle}」`,
    );
    lines.push("");
  }
  return lines;
}

function branchAppendixTxtLines(bundle: ExportBundle): string[] {
  if (!bundle.branches?.length) return [];
  const lines: string[] = ["────────", "", "【分支记录】", ""];
  for (const b of bundle.branches) {
    const tag = b.branchStatus === "archived" ? "（已归档）" : "";
    lines.push(`[分支: ${b.branchTitle}]${tag} 大纲锚点：「${b.forkNodeTitle}」`);
    lines.push("");
  }
  return lines;
}

/** Markdown：按树深度用 # 层级 */
export function buildMarkdown(bundle: ExportBundle): string {
  const lines: string[] = [];
  lines.push(`# ${bundle.storyTitle}`);
  lines.push("");
  lines.push(`**作者**：${bundle.authorName}`);
  lines.push("");
  if (bundle.summary.trim()) {
    lines.push(bundle.summary.trim());
    lines.push("");
  }
  lines.push("---");
  lines.push("");

  for (const n of bundle.ordered) {
    const depth = depthOf(bundle.flatNodes, n.id);
    const level = Math.min(2 + depth, 6);
    const hashes = "#".repeat(level);
    const typeTag = n.type !== "chapter" ? ` \`[${n.type}]\`` : "";
    lines.push(`${hashes} ${n.title}${typeTag}`);
    lines.push("");
    const body = (n.content ?? "").trim() || "（暂无正文）";
    lines.push(body);
    lines.push("");
  }

  if (bundle.ordered.length === 0) {
    lines.push("*（尚无章节大纲节点，请在「大纲编辑」中添加。）*");
    lines.push("");
  }

  lines.push(...branchAppendixLines(bundle));

  return lines.join("\n").trimEnd() + "\n";
}

export function buildTxt(bundle: ExportBundle): string {
  const lines: string[] = [];
  lines.push(bundle.storyTitle);
  lines.push("");
  lines.push(`作者：${bundle.authorName}`);
  lines.push("");
  if (bundle.summary.trim()) {
    lines.push(bundle.summary.trim());
    lines.push("");
  }
  lines.push("────────");
  lines.push("");
  for (const n of bundle.ordered) {
    const indent = "  ".repeat(depthOf(bundle.flatNodes, n.id));
    lines.push(`${indent}${n.title}${n.type !== "chapter" ? ` [${n.type}]` : ""}`);
    lines.push("");
    const body = (n.content ?? "").trim();
    if (body) {
      for (const para of body.split(/\n+/)) {
        lines.push(`${indent}${para}`);
      }
      lines.push("");
    }
  }
  if (bundle.ordered.length === 0) {
    lines.push("（尚无章节大纲）");
    lines.push("");
  }
  lines.push(...branchAppendixTxtLines(bundle));
  return lines.join("\n").trimEnd() + "\n";
}
