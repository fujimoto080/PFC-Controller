import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { askNutrition } from '@/lib/server/nutrition';

const bodySchema = z.object({
  imageDataUrl: z.string().trim().min(1, '画像データが指定されていません'),
});

function parseDataUrl(imageDataUrl: string): {
  mimeType: string;
  base64Data: string;
} {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(
    imageDataUrl,
  );
  if (!match?.[1] || !match[2]) {
    throw new ApiError('画像データの形式が不正です', 400);
  }
  return { mimeType: match[1], base64Data: match[2] };
}

export const POST = defineRoute(
  { label: 'AI栄養読み取り', auth: true, body: bodySchema },
  async (_req, { body }) => {
    const food = await askNutrition({
      instructions: [
        'あなたは栄養計算アシスタントです。',
        '画像に栄養成分表示があれば、記載された数値をそのまま読み取ってください。',
        '1包装・1個・1食など食べる単位あたりの値を優先し、100gあたりの表示しかない場合は内容量が読み取れればその量に換算してください。',
        '炭水化物の表示がなく糖質と食物繊維が表示されている場合は、その合計を carbs にしてください。',
        '栄養成分表示が写っていない料理や食品の写真であれば、写っている量から推定してください。',
        'name は商品名（読み取れなければ料理名）、store はメーカー・ブランド・店名です。',
      ],
      image: parseDataUrl(body.imageDataUrl),
      temperature: 0,
    });
    return NextResponse.json(food);
  },
);
