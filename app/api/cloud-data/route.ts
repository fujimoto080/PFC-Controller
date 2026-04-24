import { NextResponse } from 'next/server';
import { getUserData } from '@/lib/cloud-data';
import { defineRoute } from '@/lib/api/handler';

export const GET = defineRoute(
  { label: 'ユーザーデータ取得', auth: true },
  async (_req, { userId }) => {
    const payload = await getUserData(userId);
    return NextResponse.json({ payload });
  },
);
