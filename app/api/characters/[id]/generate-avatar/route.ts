import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { AvatarGenerator, AvatarStyle } from '@/lib/avatar-generator';
import { z } from 'zod';

const GenerateAvatarSchema = z.object({
  style: z.enum(['anime', 'realistic', 'cartoon', 'fantasy']),
  description: z.string().optional(),
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
    const { style, description } = GenerateAvatarSchema.parse(body);

    const avatarUrl = await AvatarGenerator.generateAvatar(
      description || '',
      { style: style as AvatarStyle }
    );

    return NextResponse.json({
      code: 200,
      data: { avatarUrl },
      msg: '生成成功',
    });
  } catch (error) {
    console.error('Generate avatar error:', error);
    return NextResponse.json(
      { error: '生成头像失败' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const styles = AvatarGenerator.getAvailableStyles();
    return NextResponse.json({
      code: 200,
      data: styles,
      msg: '获取成功',
    });
  } catch (error) {
    console.error('Get avatar styles error:', error);
    return NextResponse.json(
      { error: '获取头像风格失败' },
      { status: 500 }
    );
  }
}
