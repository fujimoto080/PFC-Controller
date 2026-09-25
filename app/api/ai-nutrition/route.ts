import { NextResponse } from 'next/server';
import { z } from 'zod';
import { defineRoute } from '@/lib/api/handler';
import { callGemini } from '@/lib/server/gemini';
import { askNutrition } from '@/lib/server/nutrition';

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
        `入力: ${body.text}`,
      ],
      (prompt) =>
        callGemini({
          prompt,
          temperature: 0.2,
          tools: [{ google_search: {} }],
        }),
    );
    return NextResponse.json(food);
  },
);
