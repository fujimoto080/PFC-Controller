import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { mealSuggestionRequestSchema } from '@/lib/api/schemas';
import { generateMealSuggestions } from '@/lib/server/meal-suggestions';

// Web 検索付きの AI 呼び出しは数十秒かかることがある
export const maxDuration = 300;

export const POST = defineRoute(
  { label: '食事提案', auth: true, body: mealSuggestionRequestSchema },
  async (_req, { userId, body }) =>
    NextResponse.json(await generateMealSuggestions(userId, body)),
);
