// お店の公式サイトから商品を集める処理の共通部品。
// scripts/scrape-catalog.ts が Node から直接読み込むため、@/ の import は使わない。

const RETRIES = 3;

/** URL の応答を read で読む。失敗したら間を空けて取り直し、それでも駄目なら例外にする。 */
async function fetchWithRetry<T>(
  url: string,
  read: (response: Response) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await read(response);
    } catch (error) {
      if (attempt >= RETRIES) {
        throw new Error(`${url} の取得に失敗しました`, { cause: error });
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

/** URL の本文（テキスト）。 */
export const fetchText = (url: string) =>
  fetchWithRetry(url, (response) => response.text());

/** URL の本文（PDF などのバイナリ）。 */
export const fetchBytes = (url: string) =>
  fetchWithRetry(
    url,
    async (response) => new Uint8Array(await response.arrayBuffer()),
  );

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
