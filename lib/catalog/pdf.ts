import { extractTextItems } from 'unpdf';
import { fetchBytes } from './scrape.ts';

// 栄養成分の PDF（Excel から出力された表）を、文字の座標から表として組み立てるための共通部品。
// scripts/scrape-catalog.ts が Node から直接読み込むため、@/ の import は使わない。

/** PDF の文字列 1 つ分。ページ左下からの座標で、x は左端、y は縦の中心（文字の大きさが違っても高さを比べられるように）。 */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
}

/** 同じ行とみなすベースラインのずれ */
export const SAME_LINE = 1.5;
/** 結合セルの見出しの位置と、割り当てた行のまとまりの中心とのずれの許容値 */
const CENTER_TOLERANCE = 3;

/** y の降順（ページの上から順） */
export const byTop = (a: { y: number }, b: { y: number }) => b.y - a.y;

/** 同じ高さに並ぶ文字をまとめる。y は先頭の文字の位置、items は左から順。 */
export function groupLines(
  items: readonly PdfTextItem[],
): { y: number; items: PdfTextItem[] }[] {
  const lines: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of [...items].sort(byTop)) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - item.y) <= SAME_LINE) {
      line.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines;
}

export const joinLine = (line: { items: PdfTextItem[] }) =>
  line.items.map((item) => item.str).join(' ');

/**
 * 上から並んだ行を、結合セルの見出し（labels）ごとに分け、行と見出しの組にする。
 * 結合セルの見出しはまとまりの縦の中心に書かれるので、上から順に中心が見出しの位置に合う範囲を探す。
 * 合う範囲が無い・余る行があれば、表の形が変わったとみなして例外にする。
 */
export function assignBlocks<R extends { y: number }>(
  rows: readonly R[],
  labels: readonly { y: number; value: string }[],
  what: string,
): [R, string][] {
  const assigned: [R, string][] = [];
  let rest = rows;
  for (const label of labels) {
    const [first] = rest;
    if (first === undefined) {
      throw new Error(`${what}「${label.value}」の行がありません`);
    }
    const gaps = rest.map((row) => Math.abs((first.y + row.y) / 2 - label.y));
    const closest = Math.min(...gaps);
    if (closest > CENTER_TOLERANCE) {
      throw new Error(`${what}「${label.value}」の行が読み取れません`);
    }
    const count = gaps.indexOf(closest) + 1;
    for (const row of rest.slice(0, count)) assigned.push([row, label.value]);
    rest = rest.slice(count);
  }
  if (rest.length > 0) throw new Error(`${what}の無い行があります`);
  return assigned;
}

/** PDF の URL から、ページごとの文字（y は文字の縦の中心）を読む。 */
export async function readPdfPages(url: string): Promise<PdfTextItem[][]> {
  const { items } = await extractTextItems(await fetchBytes(url));
  return items.map((page) =>
    page.map((item) => ({
      str: item.str,
      x: item.x,
      y: item.y + item.height / 2,
    })),
  );
}
