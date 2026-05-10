import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { ModelManager } from '@/lib/model-manager';

export async function GET(request: NextRequest) {
  try {
    const models = ModelManager.getAvailableModels();
    return NextResponse.json({
      code: 200,
      data: models,
      msg: '获取成功',
    });
  } catch (error) {
    console.error('Get models error:', error);
    return NextResponse.json(
      { error: '获取模型列表失败' },
      { status: 500 }
    );
  }
}
