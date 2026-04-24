import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { saveUserLogs } from '@/lib/cloud-data';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { logs?: unknown };
    if (!body.logs || typeof body.logs !== 'object' || Array.isArray(body.logs)) {
      return NextResponse.json({ error: 'logs の形式が不正です' }, { status: 400 });
    }

    await saveUserLogs(session.user.id, body.logs as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('ログ保存エラー', error);
    return NextResponse.json({ error: 'ログの保存に失敗しました' }, { status: 500 });
  }
}
