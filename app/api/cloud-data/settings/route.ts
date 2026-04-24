import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { saveUserSettings } from '@/lib/cloud-data';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { settings?: unknown };
    if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) {
      return NextResponse.json({ error: 'settings の形式が不正です' }, { status: 400 });
    }

    await saveUserSettings(
      session.user.id,
      body.settings as Record<string, unknown>,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('設定保存エラー', error);
    return NextResponse.json({ error: '設定の保存に失敗しました' }, { status: 500 });
  }
}
