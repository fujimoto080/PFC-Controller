import { NextResponse } from 'next/server';
import { z } from 'zod';
import { defineRoute } from '@/lib/api/handler';
import { askNutrition, NAME_INSTRUCTION } from '@/lib/server/nutrition';
import { callOpenAIWithWebSearch } from '@/lib/server/openai';

const bodySchema = z.object({
  text: z.string().trim().min(1, '食べた内容のテキストを入力してください'),
});

export const POST = defineRoute(
  { label: 'AI栄養推定', auth: true, body: bodySchema },
  async (_req, { body }) => {
    const food = await askNutrition(
      [
        'あなたは栄養計算アシスタントです。',
        'ユーザーが食べた内容の栄養値を推定してください。',
        NAME_INSTRUCTION,
        `入力: ${body.text}`,
      ],
      async (prompt, format) =>
        (await callOpenAIWithWebSearch(prompt, format)).text,
    );
    return NextResponse.json(food);
  },
);
