import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// セブン-イレブン公式サイト（関東）の商品ページから栄養成分を機械的に読み取る。

const BASE_URL = 'https://www.sej.co.jp';

/**
 * 集める商品カテゴリ（公式サイトの URL の slug）。店で買ってそのまま食べられる食事になる物に絞る。
 * パンは複数個入りの袋パンや菓子パンが大半で 1 食の単位にならないため含めない。
 */
export const SEVEN_ELEVEN_CATEGORIES = [
  { slug: 'onigiri', label: 'おにぎり', role: 'main' },
  { slug: 'sushi', label: '寿司', role: 'main' },
  { slug: 'bento', label: '弁当', role: 'main' },
  { slug: 'sandwich', label: 'サンドイッチ', role: 'main' },
  { slug: 'men', label: '麺', role: 'main' },
  { slug: 'pasta', label: 'パスタ', role: 'main' },
  { slug: 'gratin', label: 'グラタン・ドリア', role: 'main' },
  { slug: 'dailydish', label: '惣菜', role: 'side' },
  { slug: 'salad', label: 'サラダ', role: 'side' },
  { slug: 'hotsnack', label: 'ホットスナック', role: 'side' },
  { slug: 'oden', label: 'おでん', role: 'side' },
  { slug: 'chukaman', label: '中華まん', role: 'side' },
] as const satisfies readonly CatalogCategory[];

const CONCURRENCY = 4;

const categoryUrl = (category: string) =>
  `${BASE_URL}/products/a/${category}/kanto/`;

const itemUrl = (id: string) => `${BASE_URL}/products/a/item/${id}/kanto/`;

/** 一覧ページの商品番号と、たどるべき一覧ページ（小分類・ページ送り・表示件数の切り替え。地域の無いリンクは関東に揃える）。 */
export function parseListPage(
  html: string,
  category: string,
): { itemIds: string[]; listUrls: string[] } {
  const itemIds = [
    ...html.matchAll(/href="\/products\/a\/item\/(\d+)\/(?:kanto\/)?"/g),
  ].map((m) => m[1] ?? '');
  const listUrls = [
    ...html.matchAll(
      /href="\/products\/a\/(cat\/\d+|[a-z_]+)\/(?:kanto\/)?(\d+\/l\d+\/)?"/g,
    ),
  ]
    .filter((m) => m[1] === category || m[1]?.startsWith('cat/'))
    .map((m) => `${BASE_URL}/products/a/${m[1]}/kanto/${m[2] ?? ''}`);
  return { itemIds: [...new Set(itemIds)], listUrls: [...new Set(listUrls)] };
}

/**
 * 商品ページの商品名・価格・販売地域・栄養成分。
 * 栄養成分を載せていない商品（メーカー品など）は undefined。載っているのに読めなければページの形が変わったとみなして例外にする。
 */
export function parseItemPage(
  html: string,
): Omit<CatalogItem, 'id' | 'category' | 'url'> | undefined {
  const nutrition = /<th>栄養成分<\/th>\s*<td>([^<]*)<\/td>/.exec(html)?.[1];
  if (nutrition === undefined) return undefined;
  const value = (label: string, unit: string) =>
    toNumber(
      matchRequired(
        nutrition,
        new RegExp(`${label}：([\\d,.]+)${unit}`),
        `栄養成分の${label}`,
      ),
    );
  return {
    name: normalizeText(
      matchRequired(
        html,
        /<div class="item_ttl">\s*<h1>([^<]+)<\/h1>/,
        '商品名',
      ),
    ),
    price: Math.round(
      toNumber(
        matchRequired(
          html,
          /<div class="item_price">\s*<p>[\d,]+円（税込([\d,.]+)円）<\/p>/,
          '価格',
        ),
      ),
    ),
    area: normalizeText(
      matchRequired(html, /販売地域：<\/span>([^<]+)</, '販売地域'),
    ),
    calories: value('熱量', 'kcal'),
    protein: value('たんぱく質', 'g'),
    fat: value('脂質', 'g'),
    carbs: value('炭水化物', 'g'),
  };
}

/** カテゴリの一覧ページ（小分類・ページ送りを含む）をたどり、商品番号を集める。 */
async function collectItemIds(category: string): Promise<string[]> {
  const visited = new Set<string>();
  const queue = [categoryUrl(category)];
  const itemIds = new Set<string>();
  for (let url = queue.shift(); url; url = queue.shift()) {
    if (visited.has(url)) continue;
    visited.add(url);
    const page = parseListPage(await fetchText(url), category);
    for (const id of page.itemIds) itemIds.add(id);
    queue.push(...page.listUrls);
  }
  return [...itemIds];
}

export async function scrapeSevenEleven(): Promise<CatalogItem[]> {
  // 複数カテゴリに載る商品は最初のカテゴリに入れる
  const categoryById = new Map<string, string>();
  for (const { slug } of SEVEN_ELEVEN_CATEGORIES) {
    for (const id of await collectItemIds(slug)) {
      if (!categoryById.has(id)) categoryById.set(id, slug);
    }
  }
  const items = await mapConcurrent(
    [...categoryById],
    CONCURRENCY,
    async ([id, category]) => {
      const url = itemUrl(id);
      const page = parseItemPage(await fetchText(url));
      return page && { id, category, url, ...page };
    },
  );
  return items.filter((item) => item !== undefined);
}
