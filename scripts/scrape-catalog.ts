/**
 * お店の公式サイトから商品の栄養成分を集め、data/<店舗 ID>.json に書き出す。
 * AI は使わず、ページの決まった表記を機械的に読み取る。GitHub Actions で週 1 回実行する。
 * 1 店で失敗しても他の店は書き出し、最後に失敗した店があれば終了コード 1 で終わる。
 *
 * 使い方: pnpm scrape:catalog [店舗 ID ...]（省略時は全店）
 */
import { readFile, writeFile } from 'node:fs/promises';
import { scrapeFamilyMart } from '../lib/catalog/familymart.ts';
import { scrapeLawson } from '../lib/catalog/lawson.ts';
import { scrapeMaruchan } from '../lib/catalog/maruchan.ts';
import { scrapeMatsuya } from '../lib/catalog/matsuya.ts';
import { scrapeMcdonalds } from '../lib/catalog/mcdonalds.ts';
import { scrapeMos } from '../lib/catalog/mos.ts';
import { scrapeNissin } from '../lib/catalog/nissin.ts';
import { scrapeOrigin } from '../lib/catalog/origin.ts';
import { scrapeSevenEleven } from '../lib/catalog/seven-eleven.ts';
import { scrapeSukiya } from '../lib/catalog/sukiya.ts';
import { scrapeYoshinoya } from '../lib/catalog/yoshinoya.ts';
import type { CatalogItem } from '../lib/catalog/types.ts';

/** 店舗 ID → 商品を集める関数。ID は data/<ID>.json と lib/catalog/stores.ts の id に揃える。 */
const SCRAPERS: Record<string, () => Promise<CatalogItem[]>> = {
  'seven-eleven': scrapeSevenEleven,
  lawson: scrapeLawson,
  familymart: scrapeFamilyMart,
  origin: scrapeOrigin,
  sukiya: scrapeSukiya,
  mos: scrapeMos,
  mcdonalds: scrapeMcdonalds,
  matsuya: scrapeMatsuya,
  nissin: scrapeNissin,
  maruchan: scrapeMaruchan,
  yoshinoya: scrapeYoshinoya,
};

/**
 * 前回よりこの割合を下回る件数しか取れなければ、サイトの形が変わったとみなして書き出さない。
 * おでん・中華まんなど季節で空になるカテゴリがあるので、カテゴリごとの件数は確かめない。
 */
const MIN_RATIO_TO_PREVIOUS = 0.8;

const outputOf = (storeId: string) =>
  new URL(`../data/${storeId}.json`, import.meta.url);

async function readPreviousCount(storeId: string): Promise<number> {
  try {
    const text = await readFile(outputOf(storeId), 'utf8');
    return (JSON.parse(text) as unknown[]).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
}

async function scrapeStore(storeId: string) {
  const scrape = SCRAPERS[storeId];
  if (!scrape) throw new Error(`${storeId} という店舗はありません`);
  const items = await scrape();
  if (items.length === 0) throw new Error('商品が 1 件も取れませんでした');
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error('商品 ID が重複しています');
  }
  const previousCount = await readPreviousCount(storeId);
  if (items.length < previousCount * MIN_RATIO_TO_PREVIOUS) {
    throw new Error(
      `取得できた商品が ${items.length} 件と前回 (${previousCount} 件) より大幅に少ないため中止します`,
    );
  }
  items.sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(outputOf(storeId), `${JSON.stringify(items, null, 2)}\n`);
  console.log(`[${storeId}] ${items.length} 件を書き出しました`);
}

const storeIds = process.argv.slice(2);
const failed: string[] = [];
for (const storeId of storeIds.length > 0 ? storeIds : Object.keys(SCRAPERS)) {
  try {
    await scrapeStore(storeId);
  } catch (error) {
    console.error(`[${storeId}] 失敗:`, error);
    failed.push(storeId);
  }
}
if (failed.length > 0) process.exit(1);
