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
import { roundPFC } from '@/lib/utils';

const FOOD_JSON =
  '{"name":"食品名","protein":0,"fat":0,"carbs":0,"calories":0,"store":"店名または空文字"}';

/** 写真の読み取りで答えさせる 1 件分の形。evidence は確認用で、食品の値には使わない。 */
const imageFoodSchema = z.strictObject({
  evidence: z.string(),
  confidence: z.enum(READING_CONFIDENCES),
  name: z.string(),
  protein: z.number(),
  fat: z.number(),
  carbs: z.number(),
  calories: z.number(),
  store: z.string(),
});

const imageFoodsSchema = z.strictObject({ foods: z.array(imageFoodSchema) });

const VALUE_INSTRUCTIONS = [
  '数値は必ず半角数字で、単位はg/kcalです。',
  '不明な値は0を設定してください。説明文やMarkdownは不要です。',
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

/** 写真の栄養成分表示・料理から栄養値を読み取らせるときの共通の指示。 */
export const IMAGE_READING_INSTRUCTIONS = [
  'あなたは栄養計算アシスタントです。',
  '画像に栄養成分表示があれば、記載された数値をそのまま読み取ってください。',
  '1包装・1個・1食など食べる単位あたりの値を優先し、100gあたりの表示しかない場合は内容量が読み取れればその量に換算してください。',
  '炭水化物の表示がなく糖質と食物繊維が表示されている場合は、その合計を carbs にしてください。',
  '栄養成分表示が写っていない料理や食品の写真であれば、写っている量から推定してください。',
  'name は商品名、store はメーカー・ブランド・店名です。',
  '商品名は画像に文字として写っていて読み取れた場合だけ設定し、推測で補わないでください。読み取れない場合、料理の写真なら料理名、それ以外は空文字にしてください。',
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

/** 指示文に食品 1 件分の JSON 形式の指定を付け足したプロンプト。 */
function nutritionPrompt(instructions: string[]): string {
  return [
    ...instructions,
    '次のJSONのみを返してください。',
    FOOD_JSON,
    ...VALUE_INSTRUCTIONS,
  ].join('\n');
}

/**
 * 指示文を AI に渡して栄養値を答えさせ、食品として整形する。
 * 栄養値が全部 0 なら読み取れなかったものとしてエラーにする。
 */
export async function askNutrition(
  instructions: string[],
  generate: (prompt: string) => Promise<string>,
): Promise<BarcodeFood> {
  const food = normalizeNutrition(
    JSON.parse(
      extractJsonObject(await generate(nutritionPrompt(instructions))),
    ) as Partial<BarcodeFood>,
  );
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
 * 写真を AI に読み取らせる。確認できるよう AI の応答テキストもそのまま返す。
 * 応答を解釈できない・栄養値が全部 0 のものは foods に含めない（読み取れなければ空配列）。
 * multiple なら写っている商品ごとに 1 件ずつ答えさせる。
 */
export async function readNutritionImage(
  instructions: string[],
  multiple: boolean,
  generate: (prompt: string, format: JsonSchemaFormat) => Promise<string>,
): Promise<ImageReading> {
  const response = await generate(
    [
      ...instructions,
      multiple
        ? 'foods には商品ごとに1件ずつ並べ、食品が写っていなければ空配列にしてください。'
        : '食品1件分を答えてください。',
      ...IMAGE_VALUE_INSTRUCTIONS,
    ].join('\n'),
    multiple
      ? toJsonSchemaFormat('foods', imageFoodsSchema)
      : toJsonSchemaFormat('food', imageFoodSchema),
  );
  const parsed = parseJson(response);
  const candidates = multiple
    ? imageFoodsSchema.safeParse(parsed).data?.foods
    : [imageFoodSchema.safeParse(parsed).data];
  const foods = (candidates ?? [])
    .filter((value) => value !== undefined)
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
