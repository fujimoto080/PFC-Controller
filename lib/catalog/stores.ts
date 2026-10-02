import sevenEleven from '@/data/seven-eleven.json';
import { SEVEN_ELEVEN_CATEGORIES } from '@/lib/catalog/seven-eleven';
import type { CatalogCategory, CatalogItem } from '@/lib/catalog/types';

/** 組み合わせ提案に使うお店。商品は scripts/scrape-catalog.ts が週 1 回 data/<id>.json に書き出す。 */
export interface CatalogStore {
  /** data/<id>.json と scripts/scrape-catalog.ts の店舗 ID */
  id: string;
  name: string;
  /** 商品を集めた地域などの範囲。全国共通なら無し */
  scope?: string;
  categories: readonly CatalogCategory[];
  items: readonly CatalogItem[];
}

export const CATALOG_STORES: readonly CatalogStore[] = [
  {
    id: 'seven-eleven',
    name: 'セブン-イレブン',
    scope: '関東',
    categories: SEVEN_ELEVEN_CATEGORIES,
    items: sevenEleven,
  },
];
