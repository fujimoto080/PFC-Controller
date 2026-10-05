import 'server-only';

import { z } from 'zod';
import type { BarcodeFood } from '@/lib/barcode';

const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'product_name,brands,nutriments';

const nutrimentSchema = z.number().optional();

const responseSchema = z.object({
  status: z.number(),
  product: z
    .object({
      product_name: z.string().optional(),
      brands: z.string().optional(),
      nutriments: z.record(z.string(), z.unknown()).default({}),
    })
    .optional(),
});

const round = (value: number) => Math.round(value * 10) / 10;

/** 1 食分の栄養値があればそれを、無ければ 100g あたりを使う。 */
function pickNutrition(nutriments: Record<string, unknown>) {
  for (const suffix of ['serving', '100g'] as const) {
    const read = (key: string) =>
      nutrimentSchema.parse(nutriments[`${key}_${suffix}`]);
    const calories = read('energy-kcal');
    const protein = read('proteins');
    const fat = read('fat');
    const carbs = read('carbohydrates');
    if (
      calories !== undefined &&
      protein !== undefined &&
      fat !== undefined &&
      carbs !== undefined
    ) {
      return { suffix, calories, protein, fat, carbs };
    }
  }
  return null;
}

/**
 * Open Food Facts からバーコード（JAN/EAN）で商品を探す。
 * 見つからない、または栄養値が揃っていなければ null。
 * 100g あたりの値しか無いときは、食品名に「(100g)」を付けて 1 食分でないことを示す。
 */
export async function findOpenFoodFactsByBarcode(
  code: string,
): Promise<BarcodeFood | null> {
  const response = await fetch(
    `${PRODUCT_URL}/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
    { headers: { 'user-agent': 'PFC-Controller/1.0' } },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Open Food Facts の検索に失敗: ${response.status}`);
  }

  const { status, product } = responseSchema.parse(await response.json());
  const name = product?.product_name?.trim();
  if (status !== 1 || !product || !name) return null;

  const nutrition = pickNutrition(product.nutriments);
  if (!nutrition) return null;

  const brand = product.brands?.split(',')[0]?.trim();
  return {
    name: nutrition.suffix === '100g' ? `${name} (100g)` : name,
    store: brand === '' ? undefined : brand,
    calories: round(nutrition.calories),
    protein: round(nutrition.protein),
    fat: round(nutrition.fat),
    carbs: round(nutrition.carbs),
  };
}
