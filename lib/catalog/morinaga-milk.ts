import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// 森永乳業公式サイトの商品ページから栄養成分を機械的に読み取る。
// カテゴリの商品一覧ページ（/products/<カテゴリ>/）から商品ページ（/products/<カテゴリ>/<シリーズ>/<商品番号>.html）をたどり、
// 商品ページの「栄養成分（1個(100g)当たり）」の表または 1 行の文を読む。
// 栄養成分の一覧は PDF でも出ているが、商品ページの方が 1 個・1 本当たりで載っているのでこちらを読む。
// 公式サイトには価格が載っていないので価格は持たない。robots.txt は無く、商品ページは禁止されていない。

const BASE_URL = 'https://www.morinagamilk.co.jp';

const CONCURRENCY = 4;

/**
 * 集める商品カテゴリ（公式サイトの商品紹介のカテゴリ）。1 本・1 個で食べられるたんぱく質系の物だけに絞る。
 * 牛乳・コーヒーや紅茶などの普通の飲料・菓子（デザート・アイス）・チーズ・バター・クリープやスキムミルク・豆腐・
 * ベビー用品・ヘルスケア（サプリ・粉末・医療用のエンジョイ）は、たんぱく質を補う 1 食の単位にならないので集めない。
 * ドリンクはプロテイン飲料（inPROTEIN、マウントレーニア プロテイン）だけを集める。
 */
export const MORINAGA_MILK_CATEGORIES = [
  { slug: 'yoghurt', label: 'ヨーグルト', role: 'side' },
  { slug: 'drink', label: 'プロテイン飲料', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/** カテゴリ内で名前がこれに合う物だけを集める。ドリンクは普通の飲料が大半なのでプロテイン飲料に絞る。 */
const NAME_FILTERS: Partial<Record<string, RegExp>> = {
  drink: /プロテイン|protein/i,
};

/** 商品一覧ページにある、category の商品ページの URL（パスの形が変わって 1 件も無ければ例外）。 */
export function parseProductLinks(html: string, category: string): string[] {
  const links = [
    ...new Set(
      [
        ...html.matchAll(
          new RegExp(
            `href="(/products/${category}/[a-z0-9_]+/\\d+\\.html)"`,
            'g',
          ),
        ),
      ].map((m) => `${BASE_URL}${m[1] ?? ''}`),
    ),
  ];
  if (links.length === 0) {
    throw new Error(`${category} の商品ページが読み取れません`);
  }
  return links;
}

/** 文字列の中の「<数値>g」「<数値>ml」の数値の合計。 */
const totalAmount = (text: string) =>
  [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:g|ml)/gi)].reduce(
    (sum, m) => sum + Number(m[1]),
    0,
  );

/** 栄養成分の文から値を取る。表（項目名と値の組）も 1 行の文（エネルギー:99kcal、…）も「項目名:値」になっている。 */
const nutrient = (text: string, label: string, unit: string) =>
  toNumber(
    matchRequired(
      text,
      new RegExp(`${label}:\\s*(?:${label}:)?\\s*([\\d.,]+)\\s*${unit}`),
      label,
    ),
  );

/**
 * 商品ページから、1 個・1 本の商品を読む。
 * 次の商品は除く。
 * - 内容量が 1 つの量でない物（4 ポットなど複数個入り、サイズ違い、名前に入っていない入り数）
 * - 栄養成分の対象が内容量全体でない物（大容量パックの 100g 当たり、コップ 1 杯当たり、2 パック当たりなど）
 * - 栄養成分が載っていない物
 * - category に決めた名前（プロテイン飲料）に合わない物
 * 栄養成分の対象は内容量と同じ量でなければ、1 個分の値と言えないので換算せず除く。
 * 栄養成分が載っているのに読めなければ、ページの形が変わったとみなして例外にする。
 */
export function parseProductPage(
  html: string,
  category: string,
  url: string,
): CatalogItem[] {
  const name = normalizeText(
    matchRequired(html, /<h1>([\s\S]*?)<\/h1>/, '商品名').replace(
      /<[^>]+>/g,
      ' ',
    ),
  );
  if (!(NAME_FILTERS[category]?.test(name) ?? true)) return [];

  const amount = normalizeText(
    matchRequired(
      html,
      /<dt>内容量<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/,
      `${name} の内容量`,
    ),
  );
  if (!/^\d+(?:\.\d+)? ?(?:g|ml)$/i.test(amount)) return [];

  const block = /class="ingredients"[\s\S]*?<\/section>/.exec(html)?.[0];
  const text = normalizeText(
    (block ?? '').replace(/<\/dt>/g, ':').replace(/<[^>]+>/g, ' '),
  ).replace(/\s*:\s*/g, ':');
  if (!text.includes('エネルギー:')) return [];

  const basis = normalizeText(
    matchRequired(
      html,
      /<h2>\s*栄養成分\s*<small>([\s\S]*?)<\/small>/,
      `${name} の栄養成分の対象`,
    ),
  );
  if (totalAmount(basis) !== totalAmount(amount)) return [];

  return [
    {
      id: matchRequired(url, /\/(\d+)\.html$/, '商品番号'),
      name,
      category,
      url,
      calories: nutrient(text, 'エネルギー', 'kcal'),
      protein: nutrient(text, 'たんぱく質', 'g'),
      fat: nutrient(text, '脂質', 'g'),
      carbs: nutrient(text, '炭水化物', 'g'),
    },
  ];
}

export async function scrapeMorinagaMilk(): Promise<CatalogItem[]> {
  // サイトに負荷をかけないよう、カテゴリは 1 つずつ、商品ページは同時 4 件で取る
  const items = await mapConcurrent(
    MORINAGA_MILK_CATEGORIES,
    1,
    async ({ slug }) => {
      const links = parseProductLinks(
        await fetchText(`${BASE_URL}/products/${slug}/`),
        slug,
      );
      const pages = await mapConcurrent(links, CONCURRENCY, async (url) =>
        parseProductPage(await fetchText(url), slug, url),
      );
      return pages.flat();
    },
  );
  return items.flat();
}
