import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// 伊藤ハム公式サイトの商品シリーズ一覧ページと商品詳細ページの HTML から栄養成分を機械的に読み取る。
// シリーズ一覧ページ（serieslist.html?catid=）に商品番号（pdid）が並び、名前と栄養成分は商品詳細ページにある。
// 価格は公式サイトに載っていないので省く。robots.txt は /searchresults.html だけを禁止している。
// 商品詳細ページは同時 4 件で取得する。

const BASE_URL = 'https://www.itoham.co.jp/product/product';

/** 商品詳細ページを同時に取得する件数。 */
const FETCH_CONCURRENCY = 4;

/**
 * 集める商品カテゴリ。そのまま食べられるチルドのたんぱく質系の個食（副菜）と、1 枚で 1 食になるピザ（主食）に絞る。
 * 集めないシリーズと理由:
 * - ハム・ベーコン・ソーセージ・チーズ・ジャーキー・サラミ・おつまみ: 大袋・複数個入りで 1 食分が分からない、またはおつまみ・菓子
 * - 生肉・生だんご・ナゲット・フライドチキン・ハンバーグ・煮物などの惣菜: 加熱調理が必要、または 100g あたりしか栄養成分が無い
 */
export const ITOHAM_CATEGORIES = [
  { slug: 'salad-chicken', label: 'サラダチキン', role: 'side' },
  { slug: 'aburiyaki-chicken', label: 'あぶり焼チキン', role: 'side' },
  { slug: 'gaburitsuki-chicken', label: 'がぶりつきチキン', role: 'side' },
  { slug: 'pizza', label: 'ピザ', role: 'main' },
] as const satisfies readonly CatalogCategory[];

/** 集めるシリーズ（catid）と入れるカテゴリ。 */
const SERIES = [
  { catid: '47', category: 'salad-chicken' },
  { catid: '45', category: 'aburiyaki-chicken' },
  { catid: '287', category: 'gaburitsuki-chicken' },
  { catid: '60', category: 'pizza' },
  { catid: '250', category: 'pizza' },
  { catid: '62', category: 'pizza' },
] as const;

/** 栄養成分の単位として 1 食分とみなす表記。「1本」は 2 本入りの 1 本分なので 1 食分とみなさない。 */
const SERVING_UNIT = /^1(?:パック|袋|個|枚)/;

/** ピザ生地だけでトッピングが無く、そのままでは食事にならない商品。 */
const NOT_A_MEAL = 'ピザクラスト';

/** 商品詳細ページから読み取った名前と栄養成分。 */
interface ProductDetail {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** シリーズ一覧ページの商品番号。同じ番号は 1 回だけ。 */
export function parseSeriesList(html: string): string[] {
  const ids = [
    ...new Set(
      [
        ...html.matchAll(/<div class="dbPhoto"><a href="[^"]*pdid=(\d+)"/g),
      ].flatMap((m) => m[1] ?? []),
    ),
  ];
  if (ids.length === 0) throw new Error('商品の一覧が読み取れません');
  return ids;
}

/** HTML の文字参照（&amp; のみ使われている）を戻す。 */
const decode = (text: string) => text.replaceAll('&amp;', '&');

/**
 * 商品詳細ページの名前（「Renewal」などの札は含めない）と、1 食分の栄養成分。
 * 栄養成分を載せていない商品、単位が 1 パック・1 袋・1 個・1 枚でない商品（2 本入りの 1 本分など）、
 * 値が範囲（「0.7~3.1g」）で 1 食分が決まらない商品、トッピングの無いピザ生地は undefined にする。
 * 栄養成分が複数載っている商品（ピザ 1 枚と添付ソース合計 / ピザ 1 枚）は先頭の表を使う。
 * 載っているのに読めなければ、ページの形が変わったとみなして例外にする。
 */
export function parseProductPage(html: string): ProductDetail | undefined {
  const name = normalizeText(
    decode(
      matchRequired(
        html,
        /<div class="dbName"><h3>商品名<\/h3><div>([^<]*)/,
        '商品名',
      ),
    ),
  );
  if (name.includes(NOT_A_MEAL)) return undefined;
  if (!html.includes('productNutritionfacts')) return undefined;

  const unit = normalizeText(
    matchRequired(
      html,
      /<div class="nutritionfacts_desc">([^<]*)<\/div>/,
      '栄養成分の単位',
    ),
  ).replace(/^[（(]\s*(?:ピザ)?/, '');
  if (!SERVING_UNIT.test(unit)) return undefined;

  const table = matchRequired(html, /<table>([\s\S]*?)<\/table>/, '栄養成分表');
  const values = new Map<string, string>();
  const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  for (let i = 0; i + 1 < rows.length; i += 2) {
    const labels = [...(rows[i] ?? '').matchAll(/<th>([^<]*)<\/th>/g)];
    const cells = [...(rows[i + 1] ?? '').matchAll(/<td>([^<]*)<\/td>/g)];
    labels.forEach((label, index) => {
      values.set(
        normalizeText(label[1] ?? ''),
        normalizeText(cells[index]?.[1] ?? ''),
      );
    });
  }

  /** 数値。単位は付いていない商品もある。範囲の値は undefined。 */
  const read = (label: string, unitPattern: string) => {
    const text = values.get(label);
    if (text === undefined) throw new Error(`${label}が読み取れません`);
    if (text.includes('~')) return undefined;
    const value = new RegExp(`^([\\d.,]+)\\s*(?:${unitPattern})?$`).exec(
      text,
    )?.[1];
    if (value === undefined) {
      throw new Error(`${label}が読み取れません: ${text}`);
    }
    return toNumber(value);
  };
  const calories = read('熱量', 'kcal');
  const protein = read('たんぱく質', 'g');
  const fat = read('脂質', 'g');
  const carbs = read('炭水化物', 'g');
  if (
    calories === undefined ||
    protein === undefined ||
    fat === undefined ||
    carbs === undefined
  ) {
    return undefined;
  }
  return { name, calories, protein, fat, carbs };
}

export async function scrapeItoham(): Promise<CatalogItem[]> {
  const listed = new Map<string, string>();
  for (const series of SERIES) {
    const html = await fetchText(
      `${BASE_URL}/serieslist.html?catid=${series.catid}`,
    );
    for (const id of parseSeriesList(html)) {
      if (!listed.has(id)) listed.set(id, series.category);
    }
  }
  const entries = [...listed];
  const details = await mapConcurrent(entries, FETCH_CONCURRENCY, ([id]) =>
    fetchText(`${BASE_URL}/detail.html?pdid=${id}`).then((html) => {
      try {
        return parseProductPage(html);
      } catch (error) {
        throw new Error(`商品番号 ${id} の読み取りに失敗`, { cause: error });
      }
    }),
  );
  return entries.flatMap(([id, category], index): CatalogItem[] => {
    const detail = details[index];
    if (detail === undefined) return [];
    return [
      {
        id,
        category,
        url: `${BASE_URL}/detail.html?pdid=${id}`,
        ...detail,
      },
    ];
  });
}
