import { NextResponse } from 'next/server';
import { z } from 'zod';
import { defineRoute } from '@/lib/api/handler';
import { askNutrition } from '@/lib/server/nutrition';
import { callOpenAIWithImage } from '@/lib/server/openai';

const bodySchema = z.object({
  imageDataUrl: z
    .string()
    .trim()
    .regex(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,.+$/,
      '画像データの形式が不正です',
    ),
});

export const POST = defineRoute(
  { label: 'AI栄養読み取り', auth: true, body: bodySchema },
  async (_req, { body }) => {
    const food = await askNutrition(
      [
        'あなたは栄養計算アシスタントです。',
        '画像に栄養成分表示があれば、記載された数値をそのまま読み取ってください。',
        '1包装・1個・1食など食べる単位あたりの値を優先し、100gあたりの表示しかない場合は内容量が読み取れればその量に換算してください。',
        '炭水化物の表示がなく糖質と食物繊維が表示されている場合は、その合計を carbs にしてください。',
        '栄養成分表示が写っていない料理や食品の写真であれば、写っている量から推定してください。',
        'name は商品名（読み取れなければ料理名）、store はメーカー・ブランド・店名です。',
      ],
      (prompt) =>
        callOpenAIWithImage({ prompt, imageDataUrl: body.imageDataUrl }),
    );
    return NextResponse.json(food);
  },
);
