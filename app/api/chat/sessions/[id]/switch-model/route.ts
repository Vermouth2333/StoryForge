import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { ModelManager } from '@/lib/model-manager';
import { z } from 'zod';

const SwitchSessionModelSchema = z.object({
  modelId: z.string(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { modelId } = SwitchSessionModelSchema.parse(body);

    const model = ModelManager.getModelConfig(modelId);
    if (!model) {
      return NextResponse.json(
        { error: '模型不存在' },
        { status: 404 }
      );
    }

    ModelManager.setSessionModel(id, modelId);

    return NextResponse.json({
      code: 200,
      msg: '切换成功',
    });
  } catch (error) {
    console.error('Switch session model error:', error);
    return NextResponse.json(
      { error: '切换模型失败' },
      { status: 500 }
    );
  }
}
