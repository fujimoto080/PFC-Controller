import type {
  BarcodeFood,
  BarcodeMappingRow,
  ImageReading,
} from '@/lib/barcode';
import { recordAiReading } from '@/lib/client/ai-readings';
import { toast } from '@/lib/toast';

/**
 * クライアント側の fetch ラッパ。
 * JSON ヘッダの付与・`res.ok` チェック・エラーメッセージ抽出・JSON パースを一元化する。
 * サーバ側の `defineRoute`（lib/api/handler.ts）と対になる。
 */

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** サーバーが返した `{ error }` を取り出す。JSON でなければ HTTP ステータスを示す文言にする。 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown } | null;
    if (typeof data?.error === 'string' && data.error) return data.error;
  } catch {
    // JSON 以外のレスポンスは既定の文言を使う
  }
  return `通信に失敗しました (HTTP ${response.status})`;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: 'no-store',
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) {
    throw new HttpError(await readErrorMessage(response), response.status);
  }
  // 204 など本文が無いレスポンスでも壊れないようにする
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T = undefined>(url: string, body: unknown) =>
    request<T>('POST', url, body),
  put: (url: string, body: unknown) => request<undefined>('PUT', url, body),
  patch: (url: string, body: unknown) => request<undefined>('PATCH', url, body),
  delete: (url: string, body?: unknown) =>
    request<undefined>('DELETE', url, body),
};

/** バーコードから登録済み食品を引く。未登録(404)は null、その他のエラーは throw。 */
export async function fetchBarcodeFood(
  code: string,
): Promise<BarcodeFood | null> {
  try {
    return await api.get<BarcodeFood>(
      `/api/barcode?code=${encodeURIComponent(code)}`,
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

export function fetchBarcodeMappings(): Promise<BarcodeMappingRow[]> {
  return api.get('/api/barcode/mappings');
}

export function saveBarcodeMapping(
  barcodes: string[],
  food: BarcodeFood,
): Promise<void> {
  return api.post('/api/barcode', { barcodes, food });
}

/** 公式サイトのカタログ、無ければ Kalori から商品を探す。 */
export function searchCatalogFoods(
  query: string,
): Promise<{ source: 'catalog' | 'kalori'; foods: BarcodeFood[] }> {
  return api.get(`/api/catalog-search?q=${encodeURIComponent(query)}`);
}

/** テキストから AI で PFC・カロリーを推定する。 */
export function estimateNutrition(text: string): Promise<BarcodeFood> {
  return api.post('/api/ai-nutrition', { text });
}

/**
 * 同じ商品を撮った画像(dataURL)の栄養成分表示・商品名を AI で読み取る。
 * 表示が無ければ写っている料理から推定する。送った画像と応答は確認用に残す。
 */
export async function estimateNutritionFromImages(
  imageDataUrls: string[],
): Promise<BarcodeFood> {
  let reading: ImageReading;
  try {
    reading = await api.post<ImageReading>('/api/ai-nutrition/image', {
      imageDataUrls,
    });
  } catch (error) {
    recordAiReading({
      images: imageDataUrls,
      foods: [],
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  const { foods, response } = reading;
  recordAiReading({ images: imageDataUrls, response, foods });
  const [first] = foods;
  if (!first) throw new Error('栄養値を読み取れませんでした');
  if (first.confidence !== 'high') {
    toast.info('読み取りに自信のない値があります。数値を確認してください');
  }
  return first.food;
}

/** 要望・不具合を GitHub Issue として起票する。 */
export function sendFeedback(feedback: {
  title: string;
  body: string;
}): Promise<{ url: string }> {
  return api.post('/api/feedback', feedback);
}
