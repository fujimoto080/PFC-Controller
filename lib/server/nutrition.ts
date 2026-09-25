import 'server-only';
import { ApiError } from '@/lib/api/handler';
import type { BarcodeFood } from '@/lib/barcode';
import { callGemini, type GeminiRequest } from '@/lib/server/gemini';
import { roundPFC } from '@/lib/utils';

/** 返答させる JSON の形式。プロンプトの末尾に付ける。 */
const RESPONSE_FORMAT_INSTRUCTIONS = [
  '次のJSONのみを返してください。',
  '{"name":"食品名","protein":0,"fat":0,"carbs":0,"calories":0,"store":"店名または空文字"}',
  '数値は必ず半角数字で、単位はg/kcalです。',
  '不明な値は0を設定してください。説明文やMarkdownは不要です。',
];

function extractJsonObject(rawText: string): string {
  const fencedMatch = /```json\s*([\s\S]*?)\s*```/i.exec(rawText);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const plainMatch = /\{[\s\S]*\}/.exec(rawText);
  if (plainMatch) return plainMatch[0].trim();

  throw new ApiError('JSON形式の結果を取得できませんでした', 502);
}

function normalizeNutrition(data: Partial<BarcodeFood>): BarcodeFood {
  const toNumber = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return roundPFC(numeric, 1);
  };

  const trimmedStore = data.store?.trim();

  return {
    name: (data.name ?? '入力内容').trim() || '入力内容',
    protein: toNumber(data.protein),
    fat: toNumber(data.fat),
    carbs: toNumber(data.carbs),
    calories: toNumber(data.calories),
    store: trimmedStore === '' ? undefined : trimmedStore,
  };
}

/**
 * 指示文（と画像）を渡して Gemini に栄養値を答えさせ、食品として整形する。
 * 指示文の後ろに JSON 形式の指定を付け足す。
 */
export async function askNutrition({
  instructions,
  image,
  ...options
}: Omit<GeminiRequest, 'parts'> & {
  instructions: string[];
  image?: { mimeType: string; base64Data: string };
}): Promise<BarcodeFood> {
  const generatedText = await callGemini({
    ...options,
    parts: [
      { text: [...instructions, ...RESPONSE_FORMAT_INSTRUCTIONS].join('\n') },
      ...(image
        ? [
            {
              inline_data: {
                mime_type: image.mimeType,
                data: image.base64Data,
              },
            },
          ]
        : []),
    ],
  });

  return normalizeNutrition(
    JSON.parse(extractJsonObject(generatedText)) as Partial<BarcodeFood>,
  );
}
