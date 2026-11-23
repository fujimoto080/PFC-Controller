import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { imageBodySchema } from '@/lib/api/schemas';
import { NAME_INSTRUCTION } from '@/lib/server/nutrition';
import { callOpenAIWithImage, toJsonSchemaFormat } from '@/lib/server/openai';

const titleSchema = z.object({ name: z.string().trim() });
const format = toJsonSchemaFormat('product_title', titleSchema);

export const POST = defineRoute(
  { label: '写真の商品名読み取り', auth: true, body: imageBodySchema },
  async (_req, { body }) => {
    const start = performance.now();
    const response = await callOpenAIWithImage({
      imageDataUrls: body.imageDataUrls,
      format,
      prompt: [
        'すべての写真は同一商品の別の面です。写真に印刷された食品の商品名だけを転記してください。',
        '商品名が読めない場合は空文字を返し、見た目から推測しないでください。ブランド名だけ、価格や割引の表示は商品名に含めないでください。',
        NAME_INSTRUCTION,
      ].join('\n'),
    });
    const title = titleSchema.safeParse(JSON.parse(response)).data;
    if (!title) throw new ApiError('商品名の応答を読み取れませんでした', 502);
    return NextResponse.json({
      ...title,
      gpt6Ms: Math.round(performance.now() - start),
    });
  },
);
