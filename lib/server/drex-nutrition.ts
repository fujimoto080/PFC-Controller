import 'server-only';
import { z } from 'zod';
import type { BarcodeFood, ImageReading } from '@/lib/barcode';
import { hasNutrition } from '@/lib/pfc';

const MODEL = 'drex-max-v1.1';
const MIN_PROBABILITY = 0.9;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const LABEL_QUESTION = 'direct_serving_label';
const NUTRIENTS = {
  protein: 'protein (たんぱく質)',
  fat: 'fat (脂質)',
  carbs: 'total carbohydrate (炭水化物)',
} satisfies Partial<Record<keyof BarcodeFood, string>>;
const PLACES = [
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
      'Does the nutrition facts label directly and legibly list protein, fat and total carbohydrate in grams on one unambiguous per-pack, per-piece or per-serving basis? Each value must be between 0 and 999.9 and printed with at most one decimal digit. Answer no for per-100-g-only values, estimates, inequalities, values requiring unit conversion or addition, or multiple plausible serving bases.',
  },
  ...Object.fromEntries(
    Object.entries(NUTRIENTS).flatMap(([key, nutrient]) =>
      PLACES.map((place) => [
        `${key}_${place.id}`,
        {
          type: 'choice',
          instructions: `What is the ${place.name} digit of the printed ${nutrient} value in grams per pack, piece or serving? Align the number by the decimal point. Omitted leading or decimal digits in a clearly readable value count as 0. For example, 7.4 gives 0, 0, 7, 4 and 12 gives 0, 1, 2, 0. If the value is absent, ambiguous, out of range, requires calculation or has more than one printed decimal digit, choose unknown.`,
          criteria: digitCriteria,
        },
      ]),
    ),
  ),
};

/** 成分表示を 1 回のリクエストで桁ごとに読み取る。 */
export async function readDrexLabel(
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

function decodeMacros({ answers }: DrexLabelReading): Macros | undefined {
  const label = answers[LABEL_QUESTION];
  if (label?.type !== 'noul' || label.noul < MIN_PROBABILITY) return;

  const macros: Macros = { protein: 0, fat: 0, carbs: 0 };
  for (const nutrient of Object.keys(macros) as (keyof Macros)[]) {
    let tenths = 0;
    for (const place of PLACES) {
      const answer = answers[`${nutrient}_${place.id}`];
      if (answer?.type !== 'choice' || answer.choice === 'unknown') return;
      if ((answer.probabilities[answer.choice] ?? 0) < MIN_PROBABILITY) return;
      tenths += Number(answer.choice) * place.tenths;
    }
    macros[nutrient] = tenths / 10;
  }
  return macros;
}

/** 十分に確かな場合に限り PFC を採用し、判定の根拠は読み取り履歴に残す。 */
export function applyDrexLabel(
  reading: ImageReading,
  label: DrexLabelReading | undefined,
): ImageReading {
  if (!label) return reading;
  const macros = decodeMacros(label);
  const [first] = reading.foods;
  const food = first && macros ? { ...first.food, ...macros } : undefined;
  const candidate =
    first && food && hasNutrition(food) ? { ...first, food } : undefined;
  return {
    foods: candidate ? [candidate] : reading.foods,
    response: JSON.stringify({
      openai: reading.response,
      drex: { ...label, candidate: macros, applied: Boolean(candidate) },
    }),
  };
}
