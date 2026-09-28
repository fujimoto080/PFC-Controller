import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { getUserData } from '@/lib/server/user-data';
import type { UserDataResponse } from '@/lib/types';

export const GET = defineRoute(
  { label: 'ユーザーデータ取得', auth: true },
  async (_req, { userId }) => {
    const response: UserDataResponse = {
      userId,
      data: await getUserData(userId),
    };
    return NextResponse.json(response);
  },
);
