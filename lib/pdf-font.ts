import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

const FONT_FILE = "NotoSansSC-Regular.otf";
const FONT_URLS = [
  "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Sans/OTF/SimplifiedChinese/NotoSansSC-Regular.otf",
  "https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/SimplifiedChinese/NotoSansSC-Regular.otf",
];

function bundledFontPath(): string {
  return path.join(process.cwd(), "assets", "fonts", FONT_FILE);
}

function storageFontPath(): string {
  return path.join(process.cwd(), "storage", "fonts", FONT_FILE);
}

function isUsableFont(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).size > 1_000_000;
  } catch {
    return false;
  }
}

/** 优先用仓库内置字体，其次用 storage 下载缓存 */
export function getPdfFontPath(): string {
  if (isUsableFont(bundledFontPath())) return bundledFontPath();
  return storageFontPath();
}

export function hasPdfFont(): boolean {
  return isUsableFont(bundledFontPath()) || isUsableFont(storageFontPath());
}

/** 首次导出 PDF 时：内置字体可直接用；否则尝试下载到 storage/fonts/ */
export async function ensurePdfFont(): Promise<boolean> {
  if (hasPdfFont()) return true;
  const fontPath = storageFontPath();
  await fsPromises.mkdir(path.dirname(fontPath), { recursive: true });
  for (const url of FONT_URLS) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1_000_000) continue;
      await fsPromises.writeFile(fontPath, buf);
      if (hasPdfFont()) return true;
    } catch {
      /* try next mirror */
    }
  }
  return hasPdfFont();
}
