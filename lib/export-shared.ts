import path from "node:path";

const INVALID = /[\\/:*?"<>|]/g;

export function sanitizeFileBase(name: string): string {
  const t = name.trim().slice(0, 80);
  return t.replace(INVALID, "_").replace(/\s+/g, "_") || "story";
}

export function exportTimestamp(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}${m}${day}_${h}${min}`;
}

export function buildFilename(storyTitle: string, authorNickname: string, ext: string): string {
  const base = `${sanitizeFileBase(storyTitle)}_${sanitizeFileBase(authorNickname)}_${exportTimestamp()}`;
  return `${base}.${ext}`;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 可选：本地字体路径（存在则 PDF 中文可用） */
export function resolvePdfFontPath(): string | null {
  try {
    const p = path.join(process.cwd(), "storage", "fonts", "NotoSansSC-Regular.otf");
    return p;
  } catch {
    return null;
  }
}
