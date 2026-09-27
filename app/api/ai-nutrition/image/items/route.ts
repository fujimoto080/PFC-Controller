import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { imageBodySchema } from '@/lib/api/schemas';
import {
  askNutritionList,
  IMAGE_READING_INSTRUCTIONS,
} from '@/lib/server/nutrition';
import { callOpenAIWithImage } from '@/lib/server/openai';

/** 1 枚の写真に写った複数の商品（成分表示）をまとめて読み取る。 */
export const POST = defineRoute(
  { label: 'AI栄養読み取り（複数）', auth: true, body: imageBodySchema },
  async (_req, { body }) => {
    const foods = await askNutritionList(
      [
        ...IMAGE_READING_INSTRUCTIONS,
        '画像に複数の商品や栄養成分表示が写っている場合は、それぞれを別の食品として読み取ってください。同じ商品の表と裏など、同一商品と分かるものは1件にまとめます。',
      ],
      (prompt) =>
        callOpenAIWithImage({ prompt, imageDataUrl: body.imageDataUrl }),
    );
    return NextResponse.json(foods);
  },
);
