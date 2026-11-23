import 'server-only';
import { z } from 'zod';
import { ApiError } from '@/lib/api/handler';
import type { BarcodeFood, ImageReading } from '@/lib/barcode';

const MODEL = 'drex-max-v1.1';
const HIGH_CONFIDENCE = 0.9;
const MIN_PROBABILITY = 0.65;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const LABEL_QUESTION = 'direct_serving_label';
const TITLE_QUESTION = 'product_title_visible';
const NUTRIENTS = {
  protein: 'protein (たんぱく質)',
  fat: 'fat (脂質)',
  carbs: 'total carbohydrate (炭水化物)',
  calories: 'energy in kcal (熱量、エネルギー)',
} satisfies Partial<Record<keyof BarcodeFood, string>>;
const PLACES = [
  { id: 'thousands', name: 'thousands', tenths: 10000 },
  { id: 'hundreds', name: 'hundreds', tenths: 1000 },
  { id: 'tens', name: 'tens', tenths: 100 },
  { id: 'ones', name: 'ones', tenths: 10 },
  { id: 'tenths', name: 'first decimal', tenths: 1 },
] as const;

const digitSchema = z.enum(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
const digitCriteria = Object.fromEntries([
  ...digitSchema.options.map((digit) => [digit, null] as const),
  ['unknown', 'The source value or this digit cannot be read unambiguously.'],
]);
const probabilitySchema = z.number().min(0).max(1);
const responseSchema = z.object({
  evaluation_time_ms: z.number().optional(),
  answers: z.record(
    z.string(),
    z.discriminatedUnion('type', [
      z.object({ type: z.literal('noul'), noul: probabilitySchema }),
      z.object({
        type: z.literal('choice'),
        choice: z.union([digitSchema, z.literal('unknown')]),
        probabilities: z.record(z.string(), probabilitySchema),
      }),
    ]),
  ),
});
type DrexLabelReading = z.infer<typeof responseSchema>;
type Macros = Pick<BarcodeFood, keyof typeof NUTRIENTS>;

const questions = {
  [LABEL_QUESTION]: {
    type: 'noul',
    instructions:
      'Does a nutrition facts label visibly specify one unambiguous per-pack, per-piece or per-serving basis? Use that basis for all questions about digits. Answer no for per-100-g-only values or multiple plausible serving bases.',
  },
  [TITLE_QUESTION]: {
    type: 'noul',
    instructions:
      'Is the actual food or product name printed and readable in at least one image? Answer no if only a brand, barcode, discount, nutrition label or the appearance of the food is visible.',
  },
  ...Object.fromEntries(
    Object.entries(NUTRIENTS).flatMap(([key, nutrient]) =>
      PLACES.slice(key === 'calories' ? 0 : 1).map((place) => [
        `${key}_${place.id}`,
        {
          type: 'choice',
          instructions: `What is the ${place.name} digit of the printed ${nutrient} value per pack, piece or serving? Read energy in kcal and the other nutrients in grams. Align by the decimal point and fill omitted places with 0 only for a clearly readable value. Choose unknown for an absent or ambiguous value, more than one printed decimal digit, or a value requiring calculation. The maximum is 9999.9 kcal or 999.9 g.`,
          criteria: digitCriteria,
        },
      ]),
    ),
  ),
};

/** 成分表示を 1 回のリクエストで桁ごとに読み取る。 */
async function readDrexLabel(
  images: string[],
): Promise<DrexLabelReading | undefined> {
  const apiKey = process.env.NACE_API_KEY;
  if (
    !apiKey ||
    images.some((image) => !/^data:image\/(jpeg|png|webp);base64,/i.test(image))
  ) {
    return;
  }

  const body = JSON.stringify({
    model: MODEL,
    images,
    state:
      'The photos show one food product. Read its nutrition facts label. Prefer the whole pack, then one piece, then one serving, using the same column for all nutrients. Do not calculate, estimate, or use values from other columns.',
    questions,
  });
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return;

  try {
    const response = await fetch('https://console.nace.ai/v1/systemone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Nace-Client': 'pfc-controller/1',
      },
      signal: AbortSignal.timeout(4000),
      body,
    });
    if (!response.ok) {
      console.warn('Drex API 呼び出しに失敗しました', response.status);
      return;
    }
    return responseSchema.safeParse(await response.json()).data;
  } catch {
    console.warn('Drex API から応答を取得できませんでした');
    return undefined;
  }
}

function decodeMacros({ answers }: DrexLabelReading): ImageReading['foods'] {
  const label = answers[LABEL_QUESTION];
  if (label?.type !== 'noul' || label.noul < MIN_PROBABILITY) return [];

  const macros: Macros = { protein: 0, fat: 0, carbs: 0, calories: 0 };
  let probability = label.noul;
  for (const nutrient of Object.keys(macros) as (keyof Macros)[]) {
    let tenths = 0;
    for (const place of PLACES.slice(nutrient === 'calories' ? 0 : 1)) {
      const answer = answers[`${nutrient}_${place.id}`];
      if (answer?.type !== 'choice' || answer.choice === 'unknown') return [];
      probability = Math.min(
        probability,
        answer.probabilities[answer.choice] ?? 0,
      );
      if (probability < MIN_PROBABILITY) return [];
      tenths += Number(answer.choice) * place.tenths;
    }
    macros[nutrient] = tenths / 10;
  }
  return [
    {
      food: { name: '', ...macros },
      confidence: probability >= HIGH_CONFIDENCE ? 'high' : 'medium',
    },
  ];
}

/** 成分表示と商品名の有無を同じ API 呼び出しで判定する。 */
export async function readDrexNutrition(
  images: string[],
): Promise<ImageReading> {
  const start = performance.now();
  const label = await readDrexLabel(images);
  if (!label) {
    throw new ApiError('Drexから読み取り結果を取得できませんでした', 502);
  }
  const title = label.answers[TITLE_QUESTION];
  return {
    foods: decodeMacros(label),
    response: JSON.stringify(label),
    titleProbability: title?.type === 'noul' ? title.noul : 0,
    drexMs: Math.round(performance.now() - start),
  };
}
