import { fetchText, matchRequired, normalizeText, toNumber } from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// ファミリーマート公式サイトの商品一覧ページ（価格・小分類）と
// アレルゲン・栄養成分ページ（商品名・対象地域・栄養成分）を突き合わせ、関東で売っている商品を読み取る。

const BASE_URL = 'https://www.family.co.jp';

/**
 * 集める商品カテゴリ。slug は公式サイトの商品タグ（familymart:goods/category/ の後ろ）で、
 * 先頭の区切りまでが一覧ページの名前。店で買ってそのまま食べられる食事になる物に絞る。
 * パン・チルド日配品・冷凍食品などは栄養成分を公開していないため含めない。
 */
export const FAMILYMART_CATEGORIES = [
  { slug: 'omusubi', label: 'おむすび', role: 'main' },
  { slug: 'sushi', label: '寿司', role: 'main' },
  { slug: 'obento', label: '弁当', role: 'main' },
  { slug: 'sandwich', label: 'サンドイッチ', role: 'main' },
  { slug: 'noodle', label: '麺', role: 'main' },
  { slug: 'pasta', label: 'パスタ', role: 'main' },
  { slug: 'deli/gratin', label: 'グラタン', role: 'main' },
  { slug: 'deli/okonomiyaki', label: 'お好み焼き・たこ焼き', role: 'main' },
  { slug: 'deli/soup', label: 'スープ', role: 'side' },
  { slug: 'sidedishes', label: '惣菜', role: 'side' },
  { slug: 'salad', label: 'サラダ', role: 'side' },
  { slug: 'friedfoods', label: 'ホットスナック', role: 'side' },
  { slug: 'oden', label: 'おでん', role: 'side' },
  { slug: 'chukaman', label: '中華まん', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/** 一覧ページの名前 → そのカテゴリのアレルゲン・栄養成分ページ（/goods/safety/ の下）の名前。 */
const NUTRITION_PAGES: Record<string, string> = {
  omusubi: 'goods010',
  obento: 'goods020',
  sushi: 'goods030',
  sandwich: 'goods040',
  noodle: 'goods060',
  pasta: 'goods070',
  salad: 'goods080',
  sidedishes: 'goods090',
  deli: 'goods100',
  friedfoods: 'friedfoods',
  chukaman: 'chukaman',
  oden: 'oden',
};

/** 栄養成分ページの対象地域のうち、この地域で売っている商品を集める。 */
const TARGET_AREA = '関東';

const decodeEntities = (text: string) =>
  text.replaceAll('&#034;', '"').replaceAll('&amp;', '&');

/** 一覧ページの商品。tags は商品タグから familymart:goods/category/ を除いたもの。 */
interface ListedItem {
  id: string;
  tags: string[];
  price: number;
}

/** 商品一覧ページの商品番号・商品タグ・税込価格。 */
export function parseListPage(html: string): ListedItem[] {
  return html
    .split('<li class="ly-mod-layout-clm">')
    .slice(1)
    .map((block) => {
      const meta = JSON.parse(
        decodeEntities(
          matchRequired(
            block,
            /<input type="hidden" name="metaData" value="([^"]*)">/,
            '一覧の商品タグ',
          ),
        ),
      ) as { tags: string[] };
      return {
        id: matchRequired(
          block,
          /<a href="https:\/\/www\.family\.co\.jp\/goods\/[a-z_]+\/(\d+)\.html" class="ly-mod-infoset3-link">/,
          '一覧の商品番号',
        ),
        tags: meta.tags.map((tag) =>
          tag.replace(/^familymart:goods\/category\//, ''),
        ),
        price: toNumber(
          matchRequired(
            block,
            /<p class="ly-mod-infoset3-price">[^<]*（税込([\d,]+)円）/,
            '一覧の価格',
          ),
        ),
      };
    });
}

/** 栄養成分ページの 1 件。同じ商品でも地域ごとに中身が違えば別の件になる。 */
interface NutritionEntry extends Omit<
  CatalogItem,
  'category' | 'price' | 'area'
> {
  /** 対象地域（公式サイトの表記のまま）。全地域なら無し */
  area?: string;
  /** 対象地域に TARGET_AREA を含むか */
  inTargetArea: boolean;
}

/**
 * アレルゲン・栄養成分ページの商品。商品ページへのリンクの無い件（別添ソースなどの副材）は除く。
 * 栄養成分の表の形が想定と違えばページの形が変わったとみなして例外にする。
 */
export function parseNutritionPage(html: string): NutritionEntry[] {
  return html
    .split('<div class="item_basic_info">')
    .slice(1)
    .flatMap((block) => {
      const link =
        /^\s*<p class="name">\s*<a href="(https:\/\/www\.family\.co\.jp\/goods\/[a-z_]+\/(\d+)\.html)">([^<]+)<\/a>/.exec(
          block,
        );
      if (!link) return [];
      const [, url = '', id = '', name = ''] = link;
      const areas = [
        ...block.matchAll(
          /ly-mod-tag-area-(on|off)">(?:<em>)?([^<]+)(?:<\/em>)?<\/li>/g,
        ),
      ];
      const onAreas = areas
        .filter((m) => m[1] === 'on')
        .map((m) => normalizeText(m[2] ?? ''));
      if (onAreas.length === 0)
        throw new Error(`${id} の対象地域が読み取れません`);
      const table = matchRequired(
        block,
        /<table class="item_nutritional_info">([\s\S]*?)<\/table>/,
        `${id} の栄養成分`,
      );
      const labels = [
        ...table.matchAll(/<th class="tit_nut">([^<]+)<br>/g),
      ].map((m) => m[1]);
      const values = [
        ...table.matchAll(/<td class="con_nut">([^<]*)<\/td>/g),
      ].map((m) => (m[1] ?? '').trim());
      const value = (label: string) => {
        const text = values[labels.indexOf(label)];
        if (
          labels.length !== values.length ||
          !text ||
          !/^[\d,.]+$/.test(text)
        ) {
          throw new Error(`${id} の栄養成分の${label}が読み取れません`);
        }
        return toNumber(text);
      };
      return [
        {
          id,
          name: normalizeText(decodeEntities(name)),
          url,
          ...(areas.length === onAreas.length
            ? {}
            : { area: onAreas.join('、') }),
          inTargetArea: onAreas.includes(TARGET_AREA),
          calories: value('熱量'),
          protein: value('たんぱく質'),
          fat: value('脂質'),
          carbs: value('炭水化物'),
        },
      ];
    });
}

/**
 * 一覧ページの商品に栄養成分を付け、集めるカテゴリに振り分ける。
 * 集めるカテゴリに当たらない商品、栄養成分の載っていない商品、関東で売っていない商品は除く。
 */
export function combineItems(
  listed: readonly ListedItem[],
  nutrition: readonly NutritionEntry[],
): CatalogItem[] {
  return listed.flatMap(({ id, tags, price }) => {
    const category = FAMILYMART_CATEGORIES.find(({ slug }) =>
      tags.includes(slug),
    )?.slug;
    if (category === undefined) return [];
    const entries = nutrition.filter(
      (entry) => entry.id === id && entry.inTargetArea,
    );
    if (entries.length > 1) {
      throw new Error(`${id} の${TARGET_AREA}の栄養成分が複数あります`);
    }
    const [entry] = entries;
    if (entry === undefined) return [];
    const { inTargetArea: _, ...item } = entry;
    return [{ ...item, category, price }];
  });
}

export async function scrapeFamilyMart(): Promise<CatalogItem[]> {
  const pages = [
    ...new Set(
      FAMILYMART_CATEGORIES.map(({ slug }) => slug.split('/')[0] ?? ''),
    ),
  ];
  const items: CatalogItem[] = [];
  // 一覧ページと栄養成分ページの 2 件ずつなので、カテゴリは順番に取る
  for (const page of pages) {
    const nutritionPage = NUTRITION_PAGES[page];
    if (nutritionPage === undefined) {
      throw new Error(`${page} の栄養成分ページがありません`);
    }
    const [listHtml, nutritionHtml] = await Promise.all([
      fetchText(`${BASE_URL}/goods/${page}.html`),
      fetchText(`${BASE_URL}/goods/safety/${nutritionPage}.html`),
    ]);
    const found = combineItems(
      parseListPage(listHtml),
      parseNutritionPage(nutritionHtml),
    );
    if (found.length === 0) throw new Error(`${page} の商品が見つかりません`);
    // 複数の一覧ページに載る商品は最初のカテゴリに入れる
    items.push(
      ...found.filter(({ id }) => !items.some((item) => item.id === id)),
    );
  }
  return items;
}
