import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// 松屋の公式サイトのメニューページ。カテゴリの一覧ページから商品ページをたどり、
// 商品ページに載っているサイズごとの税込価格と栄養成分を読み取る。

const BASE_URL = 'https://www.matsuyafoods.co.jp';

const CONCURRENCY = 4;

/**
 * 集める商品カテゴリ。slug は公式サイトのメニューの URL（/matsuya/menu/<slug>/）。
 * 次のカテゴリは 1 食の主食や副菜にならないため集めない。
 * - 限定メニュー（limited）: 他のカテゴリにも載っている同じ商品
 * - ランチセット・カレーランチセット・ワンピースセット・お子様メニュー・ミニ丼などのセット（lunch, currylunch, onepiece, okosama, topping）: 単品を組み合わせたセットで、組み合わせ提案が主食と副菜を組むので除く
 * - ドリンク（drink）: 食事にならない
 */
export const MATSUYA_CATEGORIES = [
  { slug: 'gyumeshi', label: '牛めし', role: 'main' },
  { slug: 'curry', label: 'カレー', role: 'main' },
  { slug: 'don', label: '丼', role: 'main' },
  { slug: 'teishoku', label: '定食', role: 'main' },
  { slug: 'morning', label: '朝定食', role: 'main' },
  { slug: 'sidemenu', label: 'サイドメニュー', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/**
 * 集めない商品名。朝定食のページにある「＜選べる小鉢＞」はセットに付ける小鉢で、同じ物がサイドメニューにある。
 * ゼリーはデザートなので除く。
 */
const EXCLUDED_NAME_PATTERN = /<選べる|ゼリー/;

/** 商品ページの 1 サイズ分。size はサイズの無い商品や既定のサイズでは空文字。 */
export interface MatsuyaVariant {
  size: string;
  price?: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** カテゴリの一覧ページにある、同じカテゴリの商品ページの URL。ほかのカテゴリへのリンクと一覧ページ自身は除く。 */
export function parseMenuListPage(html: string, slug: string): string[] {
  const pattern = new RegExp(`/matsuya/menu/${slug}/([\\w.-]+\\.html)"`, 'g');
  return [
    ...new Set(
      [...html.matchAll(pattern)]
        .map((m) => m[1] ?? '')
        .filter((file) => file !== 'index.html')
        .map((file) => `${BASE_URL}/matsuya/menu/${slug}/${file}`),
    ),
  ];
}

/** 栄養成分の文字列（「カロリー／507kcal<br>たんぱく質／13.1g…」）から項目を読む。 */
function parseNutrition(text: string) {
  const read = (label: string, unit: string) =>
    toNumber(
      matchRequired(
        text,
        new RegExp(`${label}／([\\d.]+)${unit}`),
        `栄養成分の${label}`,
      ),
    );
  return {
    calories: read('カロリー', 'kcal'),
    protein: read('たんぱく質', 'g'),
    fat: read('脂質', 'g'),
    carbs: read('炭水化物', 'g'),
  };
}

/**
 * 商品ページの商品名と、サイズごとの税込価格・栄養成分。
 * 栄養成分の欄が無い商品は variants が空。価格はサイズの表記（無ければ空文字）で栄養成分と突き合わせ、載っていなければ省く。
 */
export function parseMenuPage(html: string): {
  name: string;
  variants: MatsuyaVariant[];
} {
  const name = normalizeText(
    matchRequired(
      html,
      /<h1 class="ttl">([\s\S]*?)<\/h1>/,
      '商品名',
    ).replaceAll(/<br\s*\/?>/g, ''),
  );

  const priceBlock = /<ul class="ul-text">([\s\S]*?)<\/ul>/.exec(html)?.[1];
  const prices = new Map(
    [
      ...(priceBlock ?? '').matchAll(
        /<li>\s*(?:<p class="th">([^<]*)<\/p>\s*)?<p class="td"><span class="clr">([\d,]+)<\/span>/g,
      ),
    ].map((m) => [normalizeText(m[1] ?? ''), toNumber(m[2] ?? '')]),
  );

  const nutritionBlock = /<div class="nourishment">([\s\S]*?)<\/ul>/.exec(
    html,
  )?.[1];
  if (nutritionBlock === undefined) return { name, variants: [] };
  const variants = [
    ...nutritionBlock.matchAll(
      /<li>\s*<h3 class="txt">([^<]*)<\/h3>\s*<p>([\s\S]*?)<\/p>/g,
    ),
  ].map((m) => {
    const size = normalizeText(m[1] ?? '');
    const price = prices.get(size);
    return {
      size,
      ...(price === undefined ? {} : { price }),
      ...parseNutrition(m[2] ?? ''),
    };
  });
  if (variants.length === 0) {
    throw new Error(`${name}の栄養成分が読み取れません`);
  }
  return { name, variants };
}

export async function scrapeMatsuya(): Promise<CatalogItem[]> {
  const targets = [];
  for (const category of MATSUYA_CATEGORIES) {
    const html = await fetchText(
      `${BASE_URL}/matsuya/menu/${category.slug}/index.html`,
    );
    for (const url of parseMenuListPage(html, category.slug)) {
      targets.push({ category: category.slug, url });
    }
  }
  if (targets.length === 0) throw new Error('松屋の商品が見つかりません');
  const pages = await mapConcurrent(targets, CONCURRENCY, async (target) => ({
    ...target,
    ...parseMenuPage(await fetchText(target.url)),
  }));
  return pages
    .filter((page) => !EXCLUDED_NAME_PATTERN.test(page.name))
    .flatMap((page) =>
      page.variants.map(({ size, ...rest }) => {
        const name = size === '' ? page.name : `${page.name} ${size}`;
        return {
          id: name,
          name,
          category: page.category,
          url: page.url,
          ...rest,
        };
      }),
    );
}
