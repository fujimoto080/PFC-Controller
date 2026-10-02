/**
 * セブン-イレブン公式サイト（関東）の商品ページから栄養成分を集め、data/seven-eleven.json に書き出す。
 * AI は使わず、ページの決まった表記を正規表現で読み取る。GitHub Actions で週 1 回実行する。
 *
 * 使い方: pnpm scrape:seven-eleven
 */
import { readFile, writeFile } from 'node:fs/promises';
import {
  SEVEN_ELEVEN_CATEGORIES,
  categoryUrl,
  itemUrl,
  parseItemPage,
  parseListPage,
  type SevenElevenItem,
} from '../lib/seven-eleven.ts';

const OUTPUT = new URL('../data/seven-eleven.json', import.meta.url);
const CONCURRENCY = 4;
const RETRIES = 3;
/** 前回よりこの割合を下回る件数しか取れなければ、サイトの形が変わったとみなして書き出さない。 */
const MIN_RATIO_TO_PREVIOUS = 0.8;

async function fetchHtml(url: string): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt >= RETRIES)
        throw new Error(`${url} の取得に失敗しました`, { cause: error });
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

/** カテゴリの一覧ページ（小分類・ページ送りを含む）をたどり、商品番号を集める。 */
async function collectItemIds(category: string): Promise<string[]> {
  const visited = new Set<string>();
  const queue = [categoryUrl(category)];
  const itemIds = new Set<string>();
  for (let url = queue.shift(); url; url = queue.shift()) {
    if (visited.has(url)) continue;
    visited.add(url);
    const page = parseListPage(await fetchHtml(url), category);
    for (const id of page.itemIds) itemIds.add(id);
    queue.push(...page.listUrls);
  }
  if (itemIds.size === 0) throw new Error(`${category} の商品が見つかりません`);
  return [...itemIds];
}

async function readPreviousCount(): Promise<number> {
  try {
    return (JSON.parse(await readFile(OUTPUT, 'utf8')) as unknown[]).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
}

async function main() {
  // 複数カテゴリに載る商品は最初のカテゴリに入れる
  const categoryById = new Map<string, string>();
  for (const { slug } of SEVEN_ELEVEN_CATEGORIES) {
    for (const id of await collectItemIds(slug)) {
      if (!categoryById.has(id)) categoryById.set(id, slug);
    }
  }

  const queue = [...categoryById];
  const items: SevenElevenItem[] = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        const [id, category] = entry;
        const page = parseItemPage(await fetchHtml(itemUrl(id)));
        if (page) items.push({ id, category, ...page });
      }
    }),
  );

  const previousCount = await readPreviousCount();
  if (items.length < previousCount * MIN_RATIO_TO_PREVIOUS) {
    throw new Error(
      `取得できた商品が ${items.length} 件と前回 (${previousCount} 件) より大幅に少ないため中止します`,
    );
  }
  items.sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(OUTPUT, `${JSON.stringify(items, null, 2)}\n`);
  console.log(
    `${categoryById.size} 件中、栄養成分のある ${items.length} 件を書き出しました`,
  );
}

await main();
