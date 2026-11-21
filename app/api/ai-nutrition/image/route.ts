import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { imageBodySchema } from '@/lib/api/schemas';
import { applyDrexLabel, readDrexLabel } from '@/lib/server/drex-nutrition';
import {
  IMAGE_READING_INSTRUCTIONS,
  readNutritionImage,
} from '@/lib/server/nutrition';
import { callOpenAIWithImage } from '@/lib/server/openai';

async function measure<T>(read: () => Promise<T>) {
  const start = performance.now();
  const result = await read();
  return { result, elapsedMs: Math.round(performance.now() - start) };
}

/** 写真の栄養成分表示（または料理）を 1 件の食品として読み取る。 */
export const POST = defineRoute(
  { label: 'AI栄養読み取り', auth: true, body: imageBodySchema },
  async (_req, { body }) => {
    const { imageDataUrls } = body;
    const [gpt6, drex] = await Promise.all([
      measure(() =>
        readNutritionImage(
          [
            ...IMAGE_READING_INSTRUCTIONS,
            '複数枚の画像は同じ1つの商品を別の面から撮ったものです。栄養成分表示は成分表示の写った画像から、商品名・メーカーは商品名の写った画像から読み取り、全体を1件にまとめてください。',
          ],
          (prompt, format, precise) =>
            callOpenAIWithImage({ prompt, format, imageDataUrls, precise }),
        ),
      ),
      measure(() => readDrexLabel(imageDataUrls)),
    ]);
    const timings = {
      gpt6Ms: gpt6.elapsedMs,
      drexMs: drex.result ? drex.elapsedMs : null,
    };
    console.info('画像読み取り所要時間', timings);
    return NextResponse.json({
      ...applyDrexLabel(gpt6.result, drex.result),
      timings,
    });
  },
);
