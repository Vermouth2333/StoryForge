/**
 * 从上传文件中提取纯文本（服务端）。
 * 支持：txt / pdf / docx / doc
 */

const MAX_CHARS = 40_000;

export type ExtractedDocument = {
  text: string;
  truncated: boolean;
  charCount: number;
};

function truncateText(raw: string): ExtractedDocument {
  const normalized = raw.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  if (normalized.length <= MAX_CHARS) {
    return { text: normalized, truncated: false, charCount: normalized.length };
  }
  return {
    text: normalized.slice(0, MAX_CHARS),
    truncated: true,
    charCount: MAX_CHARS,
  };
}

function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

export function isSupportedImportFile(filename: string, mime?: string | null): boolean {
  const ext = extOf(filename);
  if (["txt", "pdf", "doc", "docx"].includes(ext)) return true;
  const m = (mime ?? "").toLowerCase();
  return (
    m === "text/plain" ||
    m === "application/pdf" ||
    m === "application/msword" ||
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
  mime?: string | null,
): Promise<ExtractedDocument> {
  if (!isSupportedImportFile(filename, mime)) {
    throw new Error("仅支持 PDF、DOC、DOCX、TXT 文件");
  }

  const ext = extOf(filename);
  const mimeLower = (mime ?? "").toLowerCase();

  if (ext === "txt" || mimeLower === "text/plain") {
    return truncateText(buffer.toString("utf8"));
  }

  if (ext === "pdf" || mimeLower === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return truncateText(result.text ?? "");
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  if (
    ext === "docx" ||
    mimeLower === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return truncateText(result.value ?? "");
  }

  if (ext === "doc" || mimeLower === "application/msword") {
    const WordExtractor = (await import("word-extractor")).default;
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    return truncateText(doc.getBody() ?? "");
  }

  throw new Error("无法识别的文件类型");
}
