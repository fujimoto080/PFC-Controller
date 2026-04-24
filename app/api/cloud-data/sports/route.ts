import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { saveUserSports } from '@/lib/cloud-data';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { sports?: unknown };
    if (!Array.isArray(body.sports)) {
      return NextResponse.json({ error: 'sports の形式が不正です' }, { status: 400 });
    }

    await saveUserSports(session.user.id, body.sports);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('スポーツ保存エラー', error);
    return NextResponse.json({ error: 'スポーツの保存に失敗しました' }, { status: 500 });
  }
}
