import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { getUserData } from '@/lib/server/user-data';

export const GET = defineRoute({ label: 'ユーザーデータ取得', auth: true }, async (_req, { userId }) =>
  NextResponse.json(await getUserData(userId)),
);
