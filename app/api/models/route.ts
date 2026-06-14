import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { ModelManager } from "@/lib/model-manager";
import { z } from "zod";

const providerValues = ["openai", "anthropic", "ollama", "custom"] as const;

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.enum(providerValues),
  baseUrl: z.string().max(500).optional(),
  apiKey: z.string().max(500).optional(),
  modelName: z.string().min(1).max(200),
  defaultTemperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  enabled: z.boolean().optional(),
});

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  provider: z.enum(providerValues).optional(),
  baseUrl: z.string().max(500).optional(),
  apiKey: z.string().max(500).optional(),
  modelName: z.string().min(1).max(200).optional(),
  defaultTemperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  enabled: z.boolean().optional(),
});

/** GET /api/models — 列出当前用户所有模型 */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const models = await ModelManager.getAllUserModels(userId);
  // 返回时脱敏 apiKey
  const safe = models.map((m) => ({
    ...m,
    apiKey: m.apiKey ? "••••••••" : undefined,
    hasApiKey: !!m.apiKey,
  }));
  // 获取默认模型
  const defaultModelId = await ModelManager.getUserDefaultModel(userId);
  return NextResponse.json({ code: 200, data: safe, defaultModelId });
}

/** POST /api/models — 创建模型 */
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误", errors: parsed.error.flatten() }, { status: 400 });
  }
  const model = await ModelManager.createModel(userId, parsed.data);
  const safe = { ...model, apiKey: model.apiKey ? "••••••••" : undefined, hasApiKey: !!model.apiKey };
  return NextResponse.json({ code: 200, data: safe });
}

/** PATCH /api/models — 更新模型（需传 id） */
export async function PATCH(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const body = await request.json();
  const modelId = body.id as string | undefined;
  if (!modelId) {
    return NextResponse.json({ code: 400, msg: "缺少模型 id" }, { status: 400 });
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误", errors: parsed.error.flatten() }, { status: 400 });
  }
  const model = await ModelManager.updateModel(modelId, userId, parsed.data);
  if (!model) {
    return NextResponse.json({ code: 404, msg: "模型不存在" }, { status: 404 });
  }
  const safe = { ...model, apiKey: model.apiKey ? "••••••••" : undefined, hasApiKey: !!model.apiKey };
  return NextResponse.json({ code: 200, data: safe });
}

/** DELETE /api/models?id=xxx — 删除模型 */
export async function DELETE(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const modelId = request.nextUrl.searchParams.get("id");
  if (!modelId) {
    return NextResponse.json({ code: 400, msg: "缺少模型 id" }, { status: 400 });
  }
  const ok = await ModelManager.deleteModel(modelId, userId);
  if (!ok) {
    return NextResponse.json({ code: 404, msg: "模型不存在" }, { status: 404 });
  }
  return NextResponse.json({ code: 200, msg: "已删除" });
}
