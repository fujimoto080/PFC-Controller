import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { getTodayMeal } from '@/lib/server/meal-suggestions';
import { getUserData } from '@/lib/server/user-data';
import type { UserDataResponse } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export const GET = defineRoute(
  { label: 'ユーザーデータ取得', auth: true },
  async (_req, { userId }) => {
    const [data, meal] = await Promise.all([
      getUserData(userId),
      getTodayMeal(userId, formatDate(Date.now())),
    ]);
    const response: UserDataResponse = { userId, data: { ...data, meal } };
    return NextResponse.json(response);
  },
);
