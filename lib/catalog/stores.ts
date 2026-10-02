import familyMart from '@/data/familymart.json';
import lawson from '@/data/lawson.json';
import maruchan from '@/data/maruchan.json';
import matsuya from '@/data/matsuya.json';
import mcdonalds from '@/data/mcdonalds.json';
import mos from '@/data/mos.json';
import nissin from '@/data/nissin.json';
import origin from '@/data/origin.json';
import sevenEleven from '@/data/seven-eleven.json';
import sukiya from '@/data/sukiya.json';
import { FAMILYMART_CATEGORIES } from '@/lib/catalog/familymart';
import { LAWSON_CATEGORIES } from '@/lib/catalog/lawson';
import { MARUCHAN_CATEGORIES } from '@/lib/catalog/maruchan';
import { MATSUYA_CATEGORIES } from '@/lib/catalog/matsuya';
import { MCDONALDS_CATEGORIES } from '@/lib/catalog/mcdonalds';
import { MOS_CATEGORIES } from '@/lib/catalog/mos';
import { NISSIN_CATEGORIES } from '@/lib/catalog/nissin';
import { ORIGIN_CATEGORIES } from '@/lib/catalog/origin';
import { SEVEN_ELEVEN_CATEGORIES } from '@/lib/catalog/seven-eleven';
import { SUKIYA_CATEGORIES } from '@/lib/catalog/sukiya';
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
  {
    id: 'lawson',
    name: 'ローソン',
    scope: '関東',
    categories: LAWSON_CATEGORIES,
    items: lawson,
  },
  {
    id: 'familymart',
    name: 'ファミリーマート',
    scope: '関東',
    categories: FAMILYMART_CATEGORIES,
    items: familyMart,
  },
  {
    id: 'origin',
    name: 'オリジン弁当',
    scope: '関東',
    categories: ORIGIN_CATEGORIES,
    items: origin,
  },
  {
    id: 'sukiya',
    name: 'すき家',
    categories: SUKIYA_CATEGORIES,
    items: sukiya,
  },
  {
    id: 'mos',
    name: 'モスバーガー',
    categories: MOS_CATEGORIES,
    items: mos,
  },
  {
    id: 'mcdonalds',
    name: 'マクドナルド',
    categories: MCDONALDS_CATEGORIES,
    items: mcdonalds,
  },
  {
    id: 'matsuya',
    name: '松屋',
    categories: MATSUYA_CATEGORIES,
    items: matsuya,
  },
  {
    id: 'nissin',
    name: '日清食品',
    scope: '関東',
    categories: NISSIN_CATEGORIES,
    items: nissin,
  },
  {
    id: 'maruchan',
    name: 'マルちゃん（東洋水産）',
    scope: '関東',
    categories: MARUCHAN_CATEGORIES,
    items: maruchan,
  },
];
