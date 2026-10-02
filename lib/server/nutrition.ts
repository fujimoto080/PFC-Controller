import 'server-only';
import { z } from 'zod';
import { ApiError } from '@/lib/api/handler';
import {
  READING_CONFIDENCES,
  type BarcodeFood,
  type ImageReading,
} from '@/lib/barcode';
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

/** 写真の読み取りで答えさせる 1 件分の形。evidence は確認用で、食品の値には使わない。 */
const imageFoodSchema = z.strictObject({
  evidence: z.string(),
  confidence: z.enum(READING_CONFIDENCES),
  ...foodSchema.shape,
});

const VALUE_INSTRUCTIONS = [
  'store は店名・メーカー名で、不明なら空文字にしてください。',
  '単位はg/kcalです。不明な値は0を設定してください。',
];

/** 写真の読み取りで、値の確かさを答えさせて不鮮明さを理由に 0 にさせないための指示。 */
const IMAGE_VALUE_INSTRUCTIONS = [
  'evidence には、各値を表示のどの記載から読み取ったか、換算・合算・推定をしたならその計算や根拠を簡潔に書いてください。',
  '文字が不鮮明・一部が隠れている・ピンぼけなどで確信が持てなくても、値を0にせず、読み取れる範囲の文字や他の項目・商品の種類から最も妥当な値を入れてください。',
  '値を0にするのは、表示に0と記載されている場合だけです。',
  'confidence は値の確かさです。すべての値をはっきり読み取れたら high、一部が不鮮明で読み取りに自信がない・推定を含むなら medium、大半を推定したなら low にしてください。',
  '表示から読み取った値は、小数点以下も含めて記載どおりの桁で入れ、整数に丸めないでください。',
  '単位はg/kcalです。換算・合算をしたら、式ではなく計算した結果の数値を入れてください。',
];

/** 食品名に推定・不確かさの但し書きを混ぜさせないための指示。 */
export const NAME_INSTRUCTION =
  'name には商品名・料理名だけを入れ、「（推定）」「(推定値)」「※目安」などの但し書き・注釈・補足の括弧書きを付けないでください。';

/** 写真の栄養成分表示・料理から栄養値を読み取らせるときの共通の指示。 */
export const IMAGE_READING_INSTRUCTIONS = [
  'あなたは栄養計算アシスタントです。',
  '画像に栄養成分表示があれば、記載された数値をそのまま読み取ってください。',
  '1包装・1個・1食など食べる単位あたりの値を優先し、100gあたりの表示しかない場合は内容量が読み取れればその量に換算してください。',
  '炭水化物の表示がなく糖質と食物繊維が表示されている場合は、その合計を carbs にしてください。',
  '栄養成分表示が写っていない料理や食品の写真であれば、写っている量から推定してください。',
  'name は商品名、store はメーカー・ブランド・店名です。',
  '商品名は画像に文字として写っていて読み取れた場合だけ設定し、推測で補わないでください。読み取れない場合、料理の写真なら料理名、それ以外は空文字にしてください。',
  NAME_INSTRUCTION,
];

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

/**
 * 写真を AI に読み取らせて食品 1 件分を答えさせる。確認できるよう AI の応答テキストもそのまま返す。
 * 応答を解釈できない・栄養値が全部 0 のときは foods を空配列にする。
 */
export async function readNutritionImage(
  instructions: string[],
  generate: (prompt: string, format: JsonSchemaFormat) => Promise<string>,
): Promise<ImageReading> {
  const response = await generate(
    [
      ...instructions,
      '食品1件分を答えてください。',
      ...IMAGE_VALUE_INSTRUCTIONS,
    ].join('\n'),
    toJsonSchemaFormat('food', imageFoodSchema),
  );
  const answer = imageFoodSchema.safeParse(parseJson(response)).data;
  const foods = (answer ? [answer] : [])
    .map(({ confidence, ...value }) => ({
      food: normalizeNutrition(value),
      confidence,
    }))
    .filter(({ food }) => hasNutrition(food));
  return {
    foods,
    response,
  };
}
