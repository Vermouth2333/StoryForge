import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { type BranchExportLine, buildExportBundle, buildMarkdown, buildTxt } from "@/lib/export-body";
import { buildEpubBuffer } from "@/lib/export-epub";
import { buildPdfBuffer } from "@/lib/export-pdf";
import { ensurePdfFont, getPdfFontPath, hasPdfFont } from "@/lib/pdf-font";
import { buildFilename, sanitizeFileBase } from "@/lib/export-shared";
import type { OutlineNode } from "@/lib/outline-order";
import { withRetry } from "@/lib/export-retry";
import { getDb } from "@/lib/db";

const MAX_BYTES = 50 * 1024 * 1024;

const bodySchema = z.object({
  format: z.enum(["markdown", "txt", "pdf", "epub"]),
  /** 在文末附加 `story_branches` 记录（[分支: 标题] 与锚点大纲） */
  branch_mode: z.enum(["none", "annotate"]).optional().default("none"),
});

function disposition(fn: string): string {
  const ascii = sanitizeFileBase(fn).replace(/[^\x20-\x7E]/g, "_") || "export.bin";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fn)}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  const db = await getDb();
  const story = await db.get<{
    id: string;
    author_id: string;
    title: string;
    summary: string;
  }>("SELECT id, author_id, title, summary FROM stories WHERE id = ?", storyId);

  if (!story) {
    return NextResponse.json({ code: 404, msg: "故事不存在" }, { status: 404 });
  }
  if (story.author_id !== userId) {
    return NextResponse.json({ code: 403, msg: "无权导出" }, { status: 403 });
  }

  const authorRow = await db.get<{ username: string | null }>(
    "SELECT username FROM users WHERE id = ?",
    userId,
  );
  const authorName = (authorRow?.username ?? "").trim() || "作者";

  const rows = (await db.all(
    `SELECT id, parent_id, title, type, sort_order, content
     FROM story_outline_nodes WHERE story_id = ?`,
    storyId,
  )) as OutlineNode[];

  let branches: BranchExportLine[] | undefined;
  if (parsed.data.branch_mode === "annotate") {
    const br = await db.all<
      { title: string; fork_outline_node_id: string; status: string }[]
    >(
      `SELECT title, fork_outline_node_id, status FROM story_branches WHERE story_id = ?
       ORDER BY datetime(created_at) ASC`,
      storyId,
    );
    const idToTitle = new Map(rows.map((n) => [n.id, n.title]));
    branches = br.map((b) => ({
      branchTitle: b.title,
      forkNodeTitle: idToTitle.get(b.fork_outline_node_id) ?? b.fork_outline_node_id,
      branchStatus: b.status,
    }));
  }

  const bundle = buildExportBundle(story.title, story.summary ?? "", authorName, rows, branches);

  const md = buildMarkdown(bundle);
  const fallbackMd =
    `<!-- StoryForge：导出失败，已为你生成 Markdown 备份，可稍后重试目标格式。 -->\n\n` + md;

  if (parsed.data.format === "markdown") {
    const fn = buildFilename(story.title, authorName, "md");
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": disposition(fn),
      },
    });
  }

  if (parsed.data.format === "txt") {
    const txt = buildTxt(bundle);
    const fn = buildFilename(story.title, authorName, "txt");
    return new NextResponse(txt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": disposition(fn),
      },
    });
  }

  const fontPath = getPdfFontPath();

  if (parsed.data.format === "epub") {
    try {
      const buf = await withRetry(async () => {
        const b = await buildEpubBuffer(bundle);
        if (b.length > MAX_BYTES) throw new Error("too_large");
        return b;
      });
      const fn = buildFilename(story.title, authorName, "epub");
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/epub+zip",
          "Content-Disposition": disposition(fn),
        },
      });
    } catch {
      const fn = buildFilename(story.title, authorName, "md");
      return new NextResponse(fallbackMd, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": disposition(fn),
          "X-StoryForge-Fallback": "markdown",
        },
      });
    }
  }

  if (parsed.data.format === "pdf") {
    const hasCjk = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(md);
    let fontOk = hasPdfFont();
    if (hasCjk && !fontOk) {
      fontOk = await ensurePdfFont();
    }
    if (hasCjk && !fontOk) {
      const fn = buildFilename(story.title, authorName, "md");
      return new NextResponse(fallbackMd, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": disposition(fn),
          "X-StoryForge-Fallback": "markdown",
          "X-StoryForge-Fallback-Reason": "missing_cjk_font",
        },
      });
    }
    try {
      const buf = await withRetry(async () => {
        const b = await buildPdfBuffer(bundle, fontOk ? fontPath : null);
        if (b.length > MAX_BYTES) throw new Error("too_large");
        return b;
      });
      const fn = buildFilename(story.title, authorName, "pdf");
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": disposition(fn),
        },
      });
    } catch {
      const fn = buildFilename(story.title, authorName, "md");
      return new NextResponse(fallbackMd, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": disposition(fn),
          "X-StoryForge-Fallback": "markdown",
          "X-StoryForge-Fallback-Reason": "export_error",
        },
      });
    }
  }

  return NextResponse.json({ code: 400, msg: "不支持" }, { status: 400 });
}
