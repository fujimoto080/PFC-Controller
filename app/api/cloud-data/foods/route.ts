import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { saveUserFoods } from '@/lib/cloud-data';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { foods?: unknown };
    if (!Array.isArray(body.foods)) {
      return NextResponse.json({ error: 'foods の形式が不正です' }, { status: 400 });
    }

    await saveUserFoods(session.user.id, body.foods);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('食品辞書保存エラー', error);
    return NextResponse.json({ error: '食品辞書の保存に失敗しました' }, { status: 500 });
  }
}
