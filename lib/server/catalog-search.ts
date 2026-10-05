import 'server-only';

import type { BarcodeFood } from '@/lib/barcode';
import { CATALOG_STORES } from '@/lib/catalog/stores';
import { matchesFoodQuery } from '@/lib/food-suggestions';
import { searchKaloriFoods } from '@/lib/server/kalori';

const MAX_RESULTS = 20;

export interface CatalogSearchResult {
  /** 結果の出どころ。公式サイトから集めたカタログ、または Kalori */
  source: 'catalog' | 'kalori';
  foods: BarcodeFood[];
}

/**
 * 食品名・店名で商品を探す。公式サイトから集めたカタログを先に引き、
 * 1 件も無ければ Kalori に連携済みの場合に限って Kalori のカタログを引く。
 */
export async function searchCatalogFoods(
  userId: string,
  query: string,
): Promise<CatalogSearchResult> {
  const foods = CATALOG_STORES.flatMap((store) =>
    store.items
      .map((item) => ({
        name: item.name,
        store: store.name,
        calories: item.calories,
        protein: item.protein,
        fat: item.fat,
        carbs: item.carbs,
      }))
      .filter((food) => matchesFoodQuery(food, query)),
  ).slice(0, MAX_RESULTS);
  if (foods.length > 0) return { source: 'catalog', foods };

  return {
    source: 'kalori',
    foods: (await searchKaloriFoods(userId, query)) ?? [],
  };
}
