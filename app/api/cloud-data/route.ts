import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserData } from '@/lib/cloud-data';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const payload = await getUserData(session.user.id);
    return NextResponse.json({ payload });
  } catch (error) {
    console.error('ユーザーデータ取得エラー', error);
    return NextResponse.json(
      { error: 'ユーザーデータの取得に失敗しました' },
      { status: 500 },
    );
  }
}
