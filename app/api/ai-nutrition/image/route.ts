import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { imageBodySchema } from '@/lib/api/schemas';
import {
  IMAGE_READING_INSTRUCTIONS,
  readNutritionImage,
} from '@/lib/server/nutrition';
import { callOpenAIWithImage } from '@/lib/server/openai';

/** 写真の栄養成分表示（または料理）を 1 件の食品として読み取る。 */
export const POST = defineRoute(
  { label: 'AI栄養読み取り', auth: true, body: imageBodySchema },
  async (_req, { body }) => {
    const reading = await readNutritionImage(
      [
        ...IMAGE_READING_INSTRUCTIONS,
        '複数枚の画像は同じ1つの商品を別の面から撮ったものです。栄養成分表示は成分表示の写った画像から、商品名・メーカーは商品名の写った画像から読み取り、全体を1件にまとめてください。',
      ],
      (prompt, format) =>
        callOpenAIWithImage({
          prompt,
          format,
          imageDataUrls: body.imageDataUrls,
        }),
    );
    return NextResponse.json(reading);
  },
);
