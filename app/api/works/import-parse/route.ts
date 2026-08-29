import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { extractTextFromFile, isSupportedImportFile } from "@/lib/document-extract";
import { resolvePlatformChatProvider } from "@/lib/ai-provider";
import type { ModelConfig } from "@/lib/model-manager";
import { parseWorkImportWithAi, type WorkImportKind } from "@/lib/work-import-parse";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const kindSchema = z.enum(["story", "character", "world", "persona"]);

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  let kind: WorkImportKind;
  let sourceText = "";
  let truncated = false;

  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const kindRaw = String(form.get("kind") ?? "");
      const kindParsed = kindSchema.safeParse(kindRaw);
      if (!kindParsed.success) {
        return NextResponse.json({ code: 400, msg: "kind 参数无效" }, { status: 400 });
      }
      kind = kindParsed.data;

      const textField = String(form.get("text") ?? "").trim();
      const file = form.get("file");

      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_FILE_BYTES) {
          return NextResponse.json({ code: 400, msg: "文件过大，请不超过 8MB" }, { status: 400 });
        }
        if (!isSupportedImportFile(file.name, file.type)) {
          return NextResponse.json({ code: 400, msg: "仅支持 PDF、DOC、DOCX、TXT" }, { status: 400 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const extracted = await extractTextFromFile(buffer, file.name, file.type);
        sourceText = extracted.text;
        truncated = extracted.truncated;
        if (textField) {
          sourceText = `${sourceText}\n\n${textField}`.trim();
        }
      } else if (textField) {
        sourceText = textField;
      } else {
        return NextResponse.json({ code: 400, msg: "请上传文件或粘贴文本" }, { status: 400 });
      }
    } else {
      const body = (await req.json()) as { kind?: string; text?: string };
      const kindParsed = kindSchema.safeParse(body.kind);
      if (!kindParsed.success) {
        return NextResponse.json({ code: 400, msg: "kind 参数无效" }, { status: 400 });
      }
      kind = kindParsed.data;
      sourceText = String(body.text ?? "").trim();
      if (!sourceText) {
        return NextResponse.json({ code: 400, msg: "请粘贴待解析文本" }, { status: 400 });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "读取内容失败";
    return NextResponse.json({ code: 400, msg }, { status: 400 });
  }

  if (!sourceText.trim()) {
    return NextResponse.json({ code: 400, msg: "未能从文件中提取到文本" }, { status: 400 });
  }

  const platform = resolvePlatformChatProvider();
  if (!platform) {
    return NextResponse.json({ code: 503, msg: "创作服务暂不可用" }, { status: 503 });
  }
  const model: ModelConfig = {
    id: "platform-deepseek",
    name: "平台 DeepSeek",
    provider: "deepseek",
    baseUrl: platform.baseUrl,
    apiKey: platform.apiKey,
    modelName: platform.modelName,
    defaultTemperature: 0.3,
    maxTokens: 4096,
    enabled: true,
  };

  try {
    const data = await parseWorkImportWithAi(kind, sourceText, model);
    return NextResponse.json({
      code: 200,
      data: {
        ...data,
        truncated,
        model_name: model.name,
      },
      msg: "解析成功",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI 解析失败";
    return NextResponse.json({ code: 502, msg }, { status: 502 });
  }
}
