import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { mealSuggestionRequestSchema } from '@/lib/api/schemas';
import {
  generateMealSuggestions,
  listSuggestions,
} from '@/lib/server/meal-suggestions';
import { formatDate } from '@/lib/utils';

// Web 検索付きの AI 呼び出しは数十秒かかることがある
export const maxDuration = 300;

export const GET = defineRoute(
  { label: '食事提案の取得', auth: true },
  async (_req, { userId }) =>
    NextResponse.json(await listSuggestions(userId, formatDate(Date.now()))),
);

export const POST = defineRoute(
  { label: '食事提案', auth: true, body: mealSuggestionRequestSchema },
  async (_req, { userId, body }) =>
    NextResponse.json(await generateMealSuggestions(userId, body)),
);
