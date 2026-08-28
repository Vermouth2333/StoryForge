import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildMarkdown, buildTxt } from "@/lib/export-body";
import { buildEpubBuffer } from "@/lib/export-epub";
import { buildPdfBuffer } from "@/lib/export-pdf";
import { withRetry } from "@/lib/export-retry";
import { buildFilename, sanitizeFileBase } from "@/lib/export-shared";
import { ensurePdfFont, getPdfFontPath, hasPdfFont } from "@/lib/pdf-font";
import type { OutlineNode } from "@/lib/outline-order";
import { buildSessionExportBundle, type SessionExportMessage } from "@/lib/session-export";
import { buildSessionMediaZip } from "@/lib/session-media-zip";

const MAX_BYTES = 50 * 1024 * 1024;

const bodySchema = z.object({
  format: z.enum(["markdown", "txt", "pdf", "epub", "images", "videos"]),
  scope: z.enum(["ai", "all"]).default("all"),
});

function disposition(fn: string): string {
  const ascii = sanitizeFileBase(fn).replace(/[^\x20-\x7E]/g, "_") || "export.bin";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fn)}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const db = await getDb();
  const session = await db.get<{
    id: string;
    title: string | null;
    session_type: string;
    story_id: string | null;
  }>(
    "SELECT id, title, session_type, story_id FROM chat_sessions WHERE id = ? AND user_id = ?",
    sessionId,
    userId,
  );
  if (!session) {
    return NextResponse.json({ code: 404, msg: "会话不存在" }, { status: 404 });
  }

  const authorRow = await db.get<{ username: string | null }>(
    "SELECT username FROM users WHERE id = ?",
    userId,
  );
  const authorName = (authorRow?.username ?? "").trim() || "用户";

  if (parsed.data.format === "images" || parsed.data.format === "videos") {
    const kind = parsed.data.format === "images" ? "image" : "video";
    const packed = await buildSessionMediaZip(db, sessionId, kind);
    if ("empty" in packed) {
      return NextResponse.json(
        { code: 400, msg: kind === "image" ? "该会话暂无图片" : "该会话暂无视频" },
        { status: 400 },
      );
    }
    if (packed.buffer.length > MAX_BYTES) {
      return NextResponse.json({ code: 400, msg: "导出文件过大" }, { status: 400 });
    }
    const storyTitle = session.title?.trim() || "会话导出";
    const suffix = kind === "image" ? "images" : "videos";
    const fn = buildFilename(`${storyTitle}_${suffix}`, authorName, "zip");
    return new NextResponse(new Uint8Array(packed.buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": disposition(fn),
      },
    });
  }

  const messages = (await db.all(
    `SELECT role, content FROM chat_messages
     WHERE session_id = ?
     ORDER BY datetime(created_at) ASC, id ASC`,
    sessionId,
  )) as SessionExportMessage[];

  let outlineNodes: OutlineNode[] = [];
  let storyTitle = session.title?.trim() || "会话导出";
  let summary = "";
  if (session.session_type === "story" && session.story_id) {
    const story = await db.get<{ title: string; summary: string }>(
      "SELECT title, summary FROM stories WHERE id = ?",
      session.story_id,
    );
    if (story) {
      storyTitle = story.title;
      summary = story.summary ?? "";
    }
    outlineNodes = (await db.all(
      `SELECT id, parent_id, title, type, sort_order, content
       FROM story_outline_nodes WHERE story_id = ?`,
      session.story_id,
    )) as OutlineNode[];
  }

  const bundle = buildSessionExportBundle({
    title: storyTitle,
    summary,
    authorName,
    messages,
    scope: parsed.data.scope,
    outlineNodes,
    byOutline: session.session_type === "story",
  });

  const md = buildMarkdown(bundle);
  const fallbackMd =
    `<!-- StoryForge：导出失败，已为你生成 Markdown 备份。 -->\n\n` + md;

  if (parsed.data.format === "markdown") {
    const fn = buildFilename(storyTitle, authorName, "md");
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": disposition(fn),
      },
    });
  }

  if (parsed.data.format === "txt") {
    const txt = buildTxt(bundle);
    const fn = buildFilename(storyTitle, authorName, "txt");
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
      const fn = buildFilename(storyTitle, authorName, "epub");
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/epub+zip",
          "Content-Disposition": disposition(fn),
        },
      });
    } catch {
      const fn = buildFilename(storyTitle, authorName, "md");
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
      const fn = buildFilename(storyTitle, authorName, "md");
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
      const fn = buildFilename(storyTitle, authorName, "pdf");
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": disposition(fn),
        },
      });
    } catch {
      const fn = buildFilename(storyTitle, authorName, "md");
      return new NextResponse(fallbackMd, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": disposition(fn),
          "X-StoryForge-Fallback": "markdown",
        },
      });
    }
  }

  return NextResponse.json({ code: 400, msg: "不支持" }, { status: 400 });
}
