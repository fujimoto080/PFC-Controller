import amatake from '@/data/amatake.json';
import basefood from '@/data/basefood.json';
import danone from '@/data/danone.json';
import familyMart from '@/data/familymart.json';
import itoham from '@/data/itoham.json';
import lawson from '@/data/lawson.json';
import maruchan from '@/data/maruchan.json';
import matsuya from '@/data/matsuya.json';
import mcdonalds from '@/data/mcdonalds.json';
import meiji from '@/data/meiji.json';
import morinagaMilk from '@/data/morinaga-milk.json';
import mos from '@/data/mos.json';
import myojo from '@/data/myojo.json';
import nissin from '@/data/nissin.json';
import origin from '@/data/origin.json';
import primaham from '@/data/primaham.json';
import sevenEleven from '@/data/seven-eleven.json';
import sukiya from '@/data/sukiya.json';
import yoshinoya from '@/data/yoshinoya.json';
import { AMATAKE_CATEGORIES } from '@/lib/catalog/amatake';
import { BASEFOOD_CATEGORIES } from '@/lib/catalog/basefood';
import { DANONE_CATEGORIES } from '@/lib/catalog/danone';
import { FAMILYMART_CATEGORIES } from '@/lib/catalog/familymart';
import { ITOHAM_CATEGORIES } from '@/lib/catalog/itoham';
import { LAWSON_CATEGORIES } from '@/lib/catalog/lawson';
import { MARUCHAN_CATEGORIES } from '@/lib/catalog/maruchan';
import { MATSUYA_CATEGORIES } from '@/lib/catalog/matsuya';
import { MCDONALDS_CATEGORIES } from '@/lib/catalog/mcdonalds';
import { MEIJI_CATEGORIES } from '@/lib/catalog/meiji';
import { MORINAGA_MILK_CATEGORIES } from '@/lib/catalog/morinaga-milk';
import { MOS_CATEGORIES } from '@/lib/catalog/mos';
import { MYOJO_CATEGORIES } from '@/lib/catalog/myojo';
import { NISSIN_CATEGORIES } from '@/lib/catalog/nissin';
import { ORIGIN_CATEGORIES } from '@/lib/catalog/origin';
import { PRIMAHAM_CATEGORIES } from '@/lib/catalog/primaham';
import { SEVEN_ELEVEN_CATEGORIES } from '@/lib/catalog/seven-eleven';
import { SUKIYA_CATEGORIES } from '@/lib/catalog/sukiya';
import { YOSHINOYA_CATEGORIES } from '@/lib/catalog/yoshinoya';
import type { CatalogCategory, CatalogItem } from '@/lib/catalog/types';

/** 組み合わせ提案に使うお店。商品は scripts/scrape-catalog.ts が週 1 回 data/<id>.json に書き出す。 */
export interface CatalogStore {
  /** data/<id>.json と scripts/scrape-catalog.ts の店舗 ID */
  id: string;
  name: string;
  /** コンビニ・飲食店はそのお店で買う。メーカーの商品はコンビニやスーパーで買う既製品 */
  kind: 'コンビニ' | '飲食店' | 'メーカー';
  /** 商品を集めた地域などの範囲。全国共通なら無し */
  scope?: string;
  categories: readonly CatalogCategory[];
  items: readonly CatalogItem[];
}

export const CATALOG_STORES: readonly CatalogStore[] = [
  {
    id: 'seven-eleven',
    name: 'セブン-イレブン',
    kind: 'コンビニ',
    scope: '関東',
    categories: SEVEN_ELEVEN_CATEGORIES,
    items: sevenEleven,
  },
  {
    id: 'lawson',
    name: 'ローソン',
    kind: 'コンビニ',
    scope: '関東',
    categories: LAWSON_CATEGORIES,
    items: lawson,
  },
  {
    id: 'familymart',
    name: 'ファミリーマート',
    kind: 'コンビニ',
    scope: '関東',
    categories: FAMILYMART_CATEGORIES,
    items: familyMart,
  },
  {
    id: 'origin',
    name: 'オリジン弁当',
    kind: '飲食店',
    scope: '関東',
    categories: ORIGIN_CATEGORIES,
    items: origin,
  },
  {
    id: 'sukiya',
    name: 'すき家',
    kind: '飲食店',
    categories: SUKIYA_CATEGORIES,
    items: sukiya,
  },
  {
    id: 'mos',
    name: 'モスバーガー',
    kind: '飲食店',
    categories: MOS_CATEGORIES,
    items: mos,
  },
  {
    id: 'mcdonalds',
    name: 'マクドナルド',
    kind: '飲食店',
    categories: MCDONALDS_CATEGORIES,
    items: mcdonalds,
  },
  {
    id: 'matsuya',
    name: '松屋',
    kind: '飲食店',
    categories: MATSUYA_CATEGORIES,
    items: matsuya,
  },
  {
    id: 'nissin',
    name: '日清食品',
    kind: 'メーカー',
    scope: '関東',
    categories: NISSIN_CATEGORIES,
    items: nissin,
  },
  {
    id: 'maruchan',
    name: 'マルちゃん（東洋水産）',
    kind: 'メーカー',
    scope: '関東',
    categories: MARUCHAN_CATEGORIES,
    items: maruchan,
  },
  {
    id: 'myojo',
    name: '明星食品',
    kind: 'メーカー',
    scope: '関東',
    categories: MYOJO_CATEGORIES,
    items: myojo,
  },
  {
    id: 'morinaga-milk',
    name: '森永乳業',
    kind: 'メーカー',
    categories: MORINAGA_MILK_CATEGORIES,
    items: morinagaMilk,
  },
  {
    id: 'yoshinoya',
    name: '吉野家',
    kind: '飲食店',
    categories: YOSHINOYA_CATEGORIES,
    items: yoshinoya,
  },
  {
    id: 'primaham',
    name: 'プリマハム',
    kind: 'メーカー',
    categories: PRIMAHAM_CATEGORIES,
    items: primaham,
  },
  {
    id: 'itoham',
    name: '伊藤ハム',
    kind: 'メーカー',
    categories: ITOHAM_CATEGORIES,
    items: itoham,
  },
  {
    id: 'basefood',
    name: 'BASE FOOD',
    kind: 'メーカー',
    categories: BASEFOOD_CATEGORIES,
    items: basefood,
  },
  {
    id: 'danone',
    name: 'ダノン',
    kind: 'メーカー',
    categories: DANONE_CATEGORIES,
    items: danone,
  },
  {
    id: 'meiji',
    name: '明治',
    kind: 'メーカー',
    categories: MEIJI_CATEGORIES,
    items: meiji,
  },
  {
    id: 'amatake',
    name: 'アマタケ',
    kind: 'メーカー',
    categories: AMATAKE_CATEGORIES,
    items: amatake,
  },
];

/** JAN コード → 商品と、その商品を載せているお店。 */
const BY_JAN = new Map(
  CATALOG_STORES.flatMap((store) =>
    store.items.flatMap((item) =>
      (item.jans ?? []).map((jan) => [jan, { store, item }] as const),
    ),
  ),
);

/** バーコードの数字からカタログの商品を探す。 */
export function findCatalogItemByJan(jan: string) {
  return BY_JAN.get(jan);
}
