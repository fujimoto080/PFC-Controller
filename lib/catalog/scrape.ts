// お店の公式サイトから商品を集める処理の共通部品。
// scripts/scrape-catalog.ts が Node から直接読み込むため、@/ の import は使わない。

const RETRIES = 3;

/** URL の本文。失敗したら間を空けて取り直し、それでも駄目なら例外にする。 */
export async function fetchText(url: string): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt >= RETRIES) {
        throw new Error(`${url} の取得に失敗しました`, { cause: error });
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

/** サイトに負荷をかけすぎないよう、同時に concurrency 件ずつ fn を実行する。結果は values の順。 */
export async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < values.length) {
        const index = next;
        next += 1;
        results[index] = await fn(values[index] as T);
      }
    }),
  );
  return results;
}

/** 全角英数・連続する空白などの表記ゆれを揃えた文字列。 */
export const normalizeText = (text: string) =>
  text.normalize('NFKC').replace(/\s+/g, ' ').trim();

/** カンマ区切りの数字を数値にする。 */
export const toNumber = (value: string) => Number(value.replaceAll(',', ''));

/** pattern の 1 番目のグループ。無ければページの形が変わったとみなして例外にする。 */
export function matchRequired(
  text: string,
  pattern: RegExp,
  label: string,
): string {
  const value = pattern.exec(text)?.[1];
  if (value === undefined) throw new Error(`${label}が読み取れません`);
  return value;
}
