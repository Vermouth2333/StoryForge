import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

const FONT_FILE = "NotoSansSC-Regular.otf";
const FONT_URL =
  "https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/SimplifiedChinese/NotoSansSC-Regular.otf";

export function getPdfFontPath(): string {
  return path.join(process.cwd(), "storage", "fonts", FONT_FILE);
}

export function hasPdfFont(): boolean {
  return fs.existsSync(getPdfFontPath());
}

/** 首次导出 PDF 时尝试下载开源中文字体到 storage/fonts/ */
export async function ensurePdfFont(): Promise<boolean> {
  if (hasPdfFont()) return true;
  try {
    const fontPath = getPdfFontPath();
    await fsPromises.mkdir(path.dirname(fontPath), { recursive: true });
    const res = await fetch(FONT_URL, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) return false;
    await fsPromises.writeFile(fontPath, Buffer.from(await res.arrayBuffer()));
    return hasPdfFont();
  } catch {
    return false;
  }
}
