import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  requireJan,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// ダノンジャパン公式サイトの商品ページの HTML から栄養成分を機械的に読み取る。
// ブランドごとにページの作りが違うので、オイコス（ラインナップページのモーダル）、
// ダノンヨーグルト（商品ページ）、ダノン ビオ（一覧ページと商品ページ）を別々に読む。
// robots.txt は /wp/wp-admin/ だけを禁止している。ビオの商品ページは同時 4 件で取得する。
// 公式サイトに価格は載っていない（販売店の価格は店ごとに違う）ので価格は付けない。

const BASE_URL = 'https://www.danone.co.jp';
const OIKOS_URL = `${BASE_URL}/oikos/`;
const DANONE_URL = `${BASE_URL}/danone/products/`;
const BIO_LINEUP_URL = `${BASE_URL}/bio/lineup/`;

/** ビオの商品ページを同時に取得する件数。 */
const FETCH_CONCURRENCY = 4;

/**
 * 集める商品カテゴリ。1 カップ・1 本で食べ切る個食のヨーグルトとヨーグルトドリンクを、
 * 主食に足してたんぱく質を補う副菜として集める。
 * 集めない物と理由:
 * - 大容量パック（400g 以上のヨーグルトや 900ml のドリンクなど）: 1 食分が分からない。
 *   このページに載っているのは個食のカップ・ボトルだけ
 * - ベビー向け商品（ベビーダノン・プチダノン）: 乳幼児向けで食事の組み合わせの対象外
 * - アルプロ（植物性食品）: 別サイトで日本の公式サイトに栄養成分が載っていない
 */
export const DANONE_CATEGORIES = [
  { slug: 'yogurt', label: 'ヨーグルト', role: 'side' },
  { slug: 'drink', label: 'ヨーグルトドリンク', role: 'side' },
] as const satisfies readonly CatalogCategory[];

type DanoneCategory = (typeof DANONE_CATEGORIES)[number]['slug'];

/** ページから読み取った 1 商品。id と URL は呼び出し側が付ける。 */
interface DanoneProduct {
  id: string;
  name: string;
  category: DanoneCategory;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  jans?: string[];
}

/** 栄養成分の見出しの 1 個あたりの単位。「1カップ」「1本」の後ろに量が付く。 */
const SERVING = /^1(?:カップ|本)\s*[(（]\s*([\d.]+)\s*(?:g|ml)\s*[)）]/;

/**
 * 栄養成分の値。label と値の間の区切りはサイトごとに違うので between で指定する。
 * 熱量は kcal、他は g。
 */
function nutrientsOf(text: string, between: string) {
  const value = (label: string, unit: string) =>
    toNumber(
      matchRequired(
        text,
        new RegExp(`${label}${between}([\\d.,]+)\\s*${unit}`),
        label,
      ),
    );
  return {
    calories: value('エネルギー', 'kcal'),
    protein: value('たんぱく質', 'g'),
    fat: value('脂質', 'g'),
    carbs: value('炭水化物', 'g'),
  };
}

/**
 * 内容量の表記から、名前に付ける入り数の注記を返す。栄養成分は 1 個分なので、
 * 4 個パックなら「（4カップ入りの1カップ）」のように 1 個分の値だと分かるようにする。
 * 1 個入りなら注記は空。内容量が 1 個の量でも「1個の量×入り数」でもなければ形が変わったとみなして例外にする。
 */
function packNote(content: string, serving: string): string {
  const text = normalizeText(content);
  if (/^[\d.]+ ?(?:g|ml)$/.test(text)) {
    if (toNumber(text.replace(/[^\d.]/g, '')) !== toNumber(serving)) {
      throw new Error(`内容量が栄養成分の単位と合いません: ${text}`);
    }
    return '';
  }
  const pack = /^[\d.]+ ?g ?\(([\d.]+) ?g ?[x×] ?(\d+) ?カップ ?\)$/.exec(text);
  if (pack === null || toNumber(pack[1] ?? '') !== toNumber(serving)) {
    throw new Error(`内容量が読み取れません: ${text}`);
  }
  return `（${pack[2]}カップ入りの1カップ）`;
}

/** HTML のコメントを除く。公式サイトは販売終了した商品のブロックをコメントアウトして残している。 */
const stripComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');

/**
 * オイコスのモーダルの JAN コード。公式サイトは JAN を文字で載せておらず、モーダルの販売店リンクのうち
 * 楽天マートの商品ページの URL（sm.rakuten.co.jp/item/<JAN>）の末尾が商品の JAN になっている。
 * 8 桁か 13 桁の数字でなければ例外にする。
 */
function oikosJans(block: string): string[] {
  const jan = matchRequired(
    block,
    /sm\.rakuten\.co\.jp\/item\/([^/"?]+)/,
    '楽天マートの商品 URL',
  );
  return [requireJan(jan)];
}

/**
 * オイコスのラインナップページの、商品ごとのモーダルから商品を読む。
 * ヨーグルト（1 カップ）とドリンク（1 本）があり、モーダルの id が drink- で始まる物をドリンクとする。
 * 栄養成分表示が無いモーダル（商品以外の説明）は除く。栄養成分があるのに読めなければ例外にする。
 */
export function parseOikos(html: string): DanoneProduct[] {
  const blocks = stripComments(html).split(
    /<div id="(?=[^"]+" class="modal_box")/,
  );
  const products = blocks.slice(1).flatMap((block): DanoneProduct[] => {
    const id = matchRequired(block, /^([^"]+)"/, 'モーダルの id');
    const heading = /<h4>栄養成分表示<span>([^<]*)<\/span>/.exec(block)?.[1];
    if (heading === undefined) return [];
    const serving = SERVING.exec(normalizeText(heading).replace(/^※/, ''))?.[1];
    if (serving === undefined) {
      throw new Error(`栄養成分の単位が読み取れません: ${heading}`);
    }
    const title = matchRequired(
      block,
      /modal_products__header pc-only">\s*<h3[^>]*>([\s\S]*?)<\/h3>/,
      '商品名',
    );
    const content = matchRequired(
      block,
      /内容量\s*[:：]\s*([\d.]+\s*(?:g|ml))/,
      '内容量',
    );
    packNote(content, serving);
    return [
      {
        id: `oikos-${id}`,
        name: normalizeText(`オイコス ${title.replace(/<br\s*\/?>/g, ' ')}`),
        category: id.startsWith('drink-') ? 'drink' : 'yogurt',
        ...nutrientsOf(block, '：'),
        jans: oikosJans(block),
      },
    ];
  });
  if (products.length === 0) throw new Error('オイコスの商品が読み取れません');
  return products;
}

/**
 * ダノンヨーグルトの商品ページから商品を読む。商品は section の id ごとのブロックにあり、
 * 販売終了した商品のブロックはコメントアウトされているので読まない。4 カップ入りの 1 カップ分の値。
 */
export function parseDanoneYogurt(html: string): DanoneProduct[] {
  const blocks = stripComments(html).split(
    /<section id="(?=[^"]+" class="p-section)/,
  );
  const products = blocks.slice(1).map((block): DanoneProduct => {
    const id = matchRequired(block, /^([^"]+)"/, 'セクションの id');
    const name = matchRequired(block, /o-productbox_ttl">([^<]*)</, '商品名');
    const heading = matchRequired(
      block,
      /栄養成分表示\s*<span>\s*([^<]*?)\s*<\/span>/,
      '栄養成分の単位',
    );
    const serving = SERVING.exec(normalizeText(heading))?.[1];
    if (serving === undefined) {
      throw new Error(`栄養成分の単位が読み取れません: ${heading}`);
    }
    const content = matchRequired(
      block,
      /<dt><span>内容量<\/span><\/dt>\s*<dd><span>([^<]*)<\/span>/,
      '内容量',
    );
    return {
      id: `danone-${id}`,
      name: normalizeText(`${name}${packNote(content, serving)}`),
      category: 'yogurt',
      ...nutrientsOf(block, '</span>\\s*'),
    };
  });
  if (products.length === 0) {
    throw new Error('ダノンヨーグルトの商品が読み取れません');
  }
  return products;
}

/** ビオの一覧ページの商品。 */
interface BioListed {
  slug: string;
  name: string;
  category: DanoneCategory;
}

/**
 * ビオの一覧ページから、商品ページの slug・名前・カテゴリを読む。コメントアウトされた商品は読まない。
 * 一覧の項目の class が filtDrink ならドリンク。
 * 「腸活これだけ」と「脂肪燃焼ヨーグルトドリンク」は商品名だけでは何か分からないので、シリーズ名を名前に含める。
 */
export function parseBioList(html: string): BioListed[] {
  const products = [
    ...stripComments(html).matchAll(
      /<li class="(filt\w+)">\s*<a href="([^"/]+)\/">[\s\S]*?<p>([^<]*)<\/p>\s*<em>([^<]*)<\/em>/g,
    ),
  ].map(([, kind, slug, name, series]): BioListed => {
    const named = kind === 'filtKoredake' || kind === 'filtDrink';
    return {
      slug: slug ?? '',
      name: normalizeText(`ダノン ビオ ${named ? `${series} ${name}` : name}`),
      category: kind === 'filtDrink' ? 'drink' : 'yogurt',
    };
  });
  if (products.length === 0)
    throw new Error('ビオの商品の一覧が読み取れません');
  return products;
}

/**
 * ビオの商品ページの栄養成分を読む。栄養成分のブロックが無い商品は undefined にする。
 * 1 カップ（4 個パックの 1 個分）または 1 本あたりの値で、内容量から名前に付ける入り数の注記を返す。
 */
export function parseBioPage(
  html: string,
): (ReturnType<typeof nutrientsOf> & { note: string }) | undefined {
  const text = stripComments(html);
  const block = /<section class="seibun-block">([\s\S]*?)<\/section>/.exec(
    text,
  )?.[1];
  if (block === undefined) return undefined;
  const heading = matchRequired(
    block,
    /栄養成分表示<span>([^<]*)<\/span>/,
    '栄養成分の単位',
  );
  const serving = SERVING.exec(normalizeText(heading).replace(/^※/, ''))?.[1];
  if (serving === undefined) {
    throw new Error(`栄養成分の単位が読み取れません: ${heading}`);
  }
  const content = matchRequired(text, /●内容量：([^<]*)</, '内容量');
  return {
    ...nutrientsOf(block, '（[^）]*）\\s*</dt>\\s*<dd>\\s*'),
    note: packNote(content, serving),
  };
}

export async function scrapeDanone(): Promise<CatalogItem[]> {
  const [oikosHtml, danoneHtml, bioListHtml] = await Promise.all([
    fetchText(OIKOS_URL),
    fetchText(DANONE_URL),
    fetchText(BIO_LINEUP_URL),
  ]);
  const toItem = (product: DanoneProduct, url: string): CatalogItem => ({
    ...product,
    url,
  });

  const bioListed = parseBioList(bioListHtml);
  const bioDetails = await mapConcurrent(
    bioListed,
    FETCH_CONCURRENCY,
    (product) =>
      fetchText(`${BIO_LINEUP_URL}${product.slug}/`).then((html) => {
        try {
          return parseBioPage(html);
        } catch (error) {
          throw new Error(`${product.name} の読み取りに失敗`, { cause: error });
        }
      }),
  );
  const bio = bioListed.flatMap((product, index): CatalogItem[] => {
    const detail = bioDetails[index];
    if (detail === undefined) return [];
    const { note, ...nutrition } = detail;
    return [
      {
        id: `bio-${product.slug}`,
        name: normalizeText(`${product.name}${note}`),
        category: product.category,
        url: `${BIO_LINEUP_URL}${product.slug}/`,
        ...nutrition,
      },
    ];
  });

  const items = [
    ...parseOikos(oikosHtml).map((product) => toItem(product, OIKOS_URL)),
    ...parseDanoneYogurt(danoneHtml).map((product) =>
      toItem(product, DANONE_URL),
    ),
    ...bio,
  ];
  return items;
}
