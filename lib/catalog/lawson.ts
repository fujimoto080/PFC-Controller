import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// ローソン公式サイトのオリジナル商品ページから栄養成分を機械的に読み取る。
// 一覧は全国共通で、栄養成分は関東地域の物が載っている。取り扱い地域の注記から関東で買えない商品は除く。

const BASE_URL = 'https://www.lawson.co.jp';

/**
 * 集める商品カテゴリ（公式サイトの /recommend/original/ 以下のパス）。店で買ってそのまま食べられる食事になる物に絞る。
 * ベーカリーは菓子パンや複数個入りの袋パンが大半、おでんは栄養成分が 100g 当たりで 1 個分が分からず、
 * まちかど厨房は店内厨房のある店舗だけの商品のため含めない。
 */
export const LAWSON_CATEGORIES = [
  { slug: 'rice', label: 'おにぎり', role: 'main' },
  { slug: 'sushi', label: '寿司', role: 'main' },
  { slug: 'bento', label: '弁当', role: 'main' },
  { slug: 'chilledbento', label: 'チルド弁当', role: 'main' },
  { slug: 'sandwich', label: 'サンドイッチ', role: 'main' },
  { slug: 'noodle', label: '麺', role: 'main' },
  { slug: 'pasta', label: 'パスタ', role: 'main' },
  { slug: 'gratin', label: 'グラタン・ドリア', role: 'main' },
  { slug: 'konamono', label: 'お好み焼・たこ焼', role: 'main' },
  { slug: 'select/osozai', label: '惣菜', role: 'side' },
  { slug: 'select/salad', label: 'サラダチキン', role: 'side' },
  { slug: 'salad', label: 'サラダ', role: 'side' },
  { slug: 'soup', label: 'スープ', role: 'side' },
  { slug: 'fry', label: 'ホットスナック', role: 'side' },
  { slug: 'chukaman', label: '中華まん', role: 'side' },
] as const satisfies readonly CatalogCategory[];

const CONCURRENCY = 4;

const categoryUrl = (category: string) =>
  `${BASE_URL}/recommend/original/${category}/`;

const itemUrl = (id: string) =>
  `${BASE_URL}/recommend/original/detail/${id}.html`;

/** 取り扱い地域についての注記（「〜ではお取り扱いしておりません」など）。それ以外の注記は販売地域ではないので捨てる。 */
const AREA_NOTE = /お取り扱い|販売終了|限定/;

/** 関東の都県。地域リストに都県名で書かれることがある。 */
const KANTO_PREFECTURES = [
  '東京',
  '神奈川',
  '埼玉',
  '千葉',
  '茨城',
  '栃木',
  '群馬',
];

const ONLY_NOTE =
  /^(.+)地域のローソン(?:、ナチュラルローソン)?のみのお取り扱いとなります。$/;
const EXCLUDED_NOTE =
  /^(.+)地域のローソン(?:、ナチュラルローソン)?ではお取り扱いしておりません。$/;

/**
 * 注記の 1 文から、関東のローソンで買える商品かどうか。地域に触れない注記は true。
 * 「〜のみ」は地域リストに関東（「関東(一部)」なども含む）か関東の都県があれば買える。
 * 「〜ではお取り扱いしておりません」は地域リストに括弧の付かない「関東」があれば買えない。
 * どちらの型にも当てはまらない「〜のみ」「〜ではお取り扱いしておりません」はページの形が変わったとみなして例外にする。
 */
export function isSoldInKanto(note: string): boolean {
  const only = ONLY_NOTE.exec(note)?.[1];
  if (only !== undefined) {
    return only
      .split('・')
      .some((region) =>
        ['関東', ...KANTO_PREFECTURES].some((name) => region.startsWith(name)),
      );
  }
  const excluded = EXCLUDED_NOTE.exec(note)?.[1];
  if (excluded !== undefined) return !excluded.split('・').includes('関東');
  if (note === 'ナチュラルローソンではお取り扱いしておりません。') return true;
  if (/のみ|お取り扱いしておりません/.test(note)) {
    throw new Error(`取り扱い地域の注記が読み取れません: ${note}`);
  }
  return true;
}

/**
 * 一覧ページのうち関東で買える商品の商品番号と、取り扱い地域の注記（無ければ undefined）。
 * 一覧ページは 1 ページに全商品が載っていて、ページ送りは無い。
 */
export function parseListPage(
  html: string,
): { id: string; area: string | undefined }[] {
  const items = new Map<string, string | undefined>();
  for (const m of html.matchAll(
    /<p class="img"><a href="\/recommend\/original\/detail\/(\d+_\d+)\.html">[\s\S]*?<p class="price">[\s\S]*?<\/p>\s*(?:<div class="smalltxt"[^>]*><ul>([\s\S]*?)<\/ul><\/div>)?/g,
  )) {
    const notes = [...(m[2] ?? '').matchAll(/<li>※?([^<]+)<\/li>/g)].map(
      (note) => normalizeText(note[1] ?? ''),
    );
    if (!notes.every(isSoldInKanto)) continue;
    const areaNotes = notes.filter((note) => AREA_NOTE.test(note));
    items.set(
      m[1] ?? '',
      areaNotes.length > 0 ? areaNotes.join(' ') : undefined,
    );
  }
  return [...items].map(([id, area]) => ({ id, area }));
}

/** 「3.1〜3.6」のような幅のある表記は真ん中の値にする。 */
function toNutrient(value: string): number {
  const [low = '', high = low] = value.split('〜');
  return Math.round(((toNumber(low) + toNumber(high)) / 2) * 10) / 10;
}

/**
 * 商品ページの商品名・税込価格・栄養成分。
 * 栄養成分を載せていない商品、栄養成分が 100g 当たりなど重さ当たりで 1 個分が分からない商品、
 * 店頭で売っていないデリバリー専用の商品は undefined。載っているのに読めなければページの形が変わったとみなして例外にする。
 */
export function parseItemPage(
  html: string,
): Omit<CatalogItem, 'id' | 'category' | 'url' | 'area'> | undefined {
  const basis = /<h3>栄養成分<span>([^<]*)<\/span><\/h3>/.exec(html)?.[1];
  if (basis === undefined) return undefined;
  if (/^【[^【】\d]*[\d.]+g当たり】$/.test(basis)) return undefined;
  if (html.includes('<dt>ローソン標準価格</dt><dd>デリバリー価格')) {
    return undefined;
  }
  const value = (label: string, unit: string) =>
    toNutrient(
      matchRequired(
        html,
        new RegExp(
          `<dt>${label}</dt>\\s*<dd>([\\d,.]+(?:〜[\\d,.]+)?)${unit}</dd>`,
        ),
        `栄養成分の${label}`,
      ),
    );
  return {
    name: normalizeText(
      matchRequired(html, /<h2 class="ttl">([^<]+)<\/h2>/, '商品名'),
    ),
    price: toNumber(
      matchRequired(
        html,
        /<dt>ローソン標準価格<\/dt><dd><span>([\d,]+)<\/span><span>円\(税込\)<\/span><\/dd>/,
        '価格',
      ),
    ),
    calories: value('熱量', 'kcal'),
    protein: value('たんぱく質', 'g'),
    fat: value('脂質', 'g'),
    carbs: value('炭水化物', 'g'),
  };
}

export async function scrapeLawson(): Promise<CatalogItem[]> {
  // 複数カテゴリに載る商品は最初のカテゴリに入れる
  const listed = new Map<string, { category: string; area?: string }>();
  for (const { slug } of LAWSON_CATEGORIES) {
    const items = parseListPage(await fetchText(categoryUrl(slug)));
    if (items.length === 0) throw new Error(`${slug} の商品が見つかりません`);
    for (const { id, area } of items) {
      if (!listed.has(id)) listed.set(id, { category: slug, area });
    }
  }
  const items = await mapConcurrent(
    [...listed],
    CONCURRENCY,
    async ([id, { category, area }]) => {
      const url = itemUrl(id);
      const page = parseItemPage(await fetchText(url));
      return page && { id, category, url, ...page, area };
    },
  );
  return items.filter((item) => item !== undefined);
}
