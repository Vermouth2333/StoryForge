import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { ModelManager } from "@/lib/model-manager";
import { z } from "zod";

const SetDefaultModelSchema = z.object({
  modelId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { modelId } = SetDefaultModelSchema.parse(body);

    const ok = await ModelManager.setUserDefaultModel(userId, modelId);
    if (!ok) {
      return NextResponse.json({ error: "模型不存在" }, { status: 404 });
    }

    return NextResponse.json({
      code: 200,
      msg: "设置成功",
    });
  } catch (error) {
    console.error("Set default model error:", error);
    return NextResponse.json(
      { error: "设置默认模型失败" },
      { status: 500 },
    );
  }
}
