import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { callGemini } from '@/lib/api/gemini';

const MODEL_NAME = 'gemini-2.0-flash';

const bodySchema = z.object({
  imageDataUrl: z.string().trim().min(1, '画像データが指定されていません'),
});

function parseDataUrl(imageDataUrl: string): { mimeType: string; base64Data: string } {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new ApiError('画像データの形式が不正です', 400);
  }
  return { mimeType: match[1], base64Data: match[2] };
}

export const POST = defineRoute(
  { label: 'OCR', body: bodySchema },
  async (_req, { body }) => {
    const { mimeType, base64Data } = parseDataUrl(body.imageDataUrl);

    const text = await callGemini({
      model: MODEL_NAME,
      parts: [
        {
          text: [
            'この画像から読み取れる文字を抽出してください。',
            '返答は抽出結果のテキストのみで、説明文は不要です。',
            '文字がない場合は空文字を返してください。',
          ].join('\n'),
        },
        { inline_data: { mime_type: mimeType, data: base64Data } },
      ],
      temperature: 0,
      allowEmptyResponse: true,
    });

    return NextResponse.json({ text: text.trim() });
  },
);
