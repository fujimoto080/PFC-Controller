import 'server-only';
import { ApiError } from '@/lib/api/handler';
import type { BarcodeFood, ImageReading } from '@/lib/barcode';
import { hasNutrition } from '@/lib/pfc';
import { roundPFC } from '@/lib/utils';

const FOOD_JSON =
  '{"name":"食品名","protein":0,"fat":0,"carbs":0,"calories":0,"store":"店名または空文字"}';

const VALUE_INSTRUCTIONS = [
  '数値は必ず半角数字で、単位はg/kcalです。',
  '不明な値は0を設定してください。説明文やMarkdownは不要です。',
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

export function extractJsonObject(rawText: string): string {
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

/** AI の出力から JSON を取り出して解釈する。JSON が無い・壊れている場合は undefined。 */
function parseJsonOutput(text: string): unknown {
  try {
    return JSON.parse(extractJsonObject(text));
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
  generate: (prompt: string) => Promise<string>,
): Promise<ImageReading> {
  const response = await generate(
    multiple
      ? [
          ...instructions,
          '次のJSONのみを返してください。foods は商品ごとに1件ずつ並べ、食品が写っていなければ空配列にします。',
          `{"foods":[${FOOD_JSON}]}`,
          ...VALUE_INSTRUCTIONS,
        ].join('\n')
      : nutritionPrompt(instructions),
  );
  const parsed = parseJsonOutput(response);
  const candidates: unknown = multiple
    ? (parsed as { foods?: unknown } | undefined)?.foods
    : [parsed];
  const foods = Array.isArray(candidates)
    ? candidates
        .filter(
          (value): value is Partial<BarcodeFood> =>
            typeof value === 'object' && value !== null,
        )
        .map(normalizeNutrition)
        .filter(hasNutrition)
    : [];
  return {
    foods,
    response,
  };
}
