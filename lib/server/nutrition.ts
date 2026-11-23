import 'server-only';
import { z } from 'zod';
import { ApiError } from '@/lib/api/handler';
import type { BarcodeFood } from '@/lib/barcode';
import { hasNutrition } from '@/lib/pfc';
import { type JsonSchemaFormat, toJsonSchemaFormat } from '@/lib/server/openai';

/** テキストからの推定で答えさせる食品 1 件分の形。 */
const foodSchema = z.strictObject({
  name: z.string(),
  protein: z.number(),
  fat: z.number(),
  carbs: z.number(),
  calories: z.number(),
  store: z.string(),
});

const VALUE_INSTRUCTIONS = [
  'store は店名・メーカー名で、不明なら空文字にしてください。',
  '単位はg/kcalです。不明な値は0を設定してください。',
];

/** 食品名に推定・不確かさの但し書きを混ぜさせないための指示。 */
export const NAME_INSTRUCTION =
  'name には商品名・料理名だけを入れ、「（推定）」「(推定値)」「※目安」などの但し書き・注釈・補足の括弧書きを付けないでください。';

function normalizeNutrition(data: Partial<BarcodeFood>): BarcodeFood {
  const toNumber = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return numeric;
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
 * 指示文を AI に渡して栄養値を答えさせ、食品として整形する。
 * 栄養値が全部 0 なら読み取れなかったものとしてエラーにする。
 */
export async function askNutrition(
  instructions: string[],
  generate: (prompt: string, format: JsonSchemaFormat) => Promise<string>,
): Promise<BarcodeFood> {
  const answer = foodSchema.safeParse(
    parseJson(
      await generate(
        [...instructions, ...VALUE_INSTRUCTIONS].join('\n'),
        toJsonSchemaFormat('food', foodSchema),
      ),
    ),
  ).data;
  if (!answer) {
    throw new ApiError('AI の推定結果を読み取れませんでした', 502);
  }
  const food = normalizeNutrition(answer);
  if (!hasNutrition(food)) {
    throw new ApiError('栄養値を読み取れませんでした', 422);
  }
  return food;
}

/** AI の出力を JSON として解釈する。JSON でない場合は undefined。 */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
