import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { callGemini } from '@/lib/api/gemini';

const MODEL_NAME = 'gemini-2.0-flash';

interface EstimatedNutrition {
  name: string;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
  store?: string;
}

const bodySchema = z.object({
  text: z.string().trim().min(1, '食べた内容のテキストを入力してください'),
});

function extractJsonObject(rawText: string): string {
  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const plainMatch = rawText.match(/\{[\s\S]*\}/);
  if (plainMatch) return plainMatch[0].trim();

  throw new ApiError('JSON形式の結果を取得できませんでした', 502);
}

function normalizeNutrition(data: Partial<EstimatedNutrition>): EstimatedNutrition {
  const toNumber = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Math.round(numeric * 10) / 10;
  };

  return {
    name: (data.name ?? '入力内容').toString().trim() || '入力内容',
    protein: toNumber(data.protein),
    fat: toNumber(data.fat),
    carbs: toNumber(data.carbs),
    calories: toNumber(data.calories),
    store: data.store?.trim() || undefined,
  };
}

export const POST = defineRoute(
  { label: 'AI栄養推定', body: bodySchema },
  async (_req, { body }) => {
    const prompt = [
      'あなたは栄養計算アシスタントです。',
      'ユーザーが食べた内容を推定し、次のJSONのみを返してください。',
      '{"name":"食品名","protein":0,"fat":0,"carbs":0,"calories":0,"store":"店名または空文字"}',
      '数値は必ず半角数字で、単位はg/kcalです。',
      '不明な値は0を設定してください。説明文やMarkdownは不要です。',
      `入力: ${body.text}`,
    ].join('\n');

    const generatedText = await callGemini({
      model: MODEL_NAME,
      parts: [{ text: prompt }],
      temperature: 0.2,
      tools: [{ google_search: {} }],
    });

    const parsed = JSON.parse(extractJsonObject(generatedText)) as Partial<EstimatedNutrition>;
    return NextResponse.json(normalizeNutrition(parsed));
  },
);
