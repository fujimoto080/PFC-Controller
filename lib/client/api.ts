import type { BarcodeFood, BarcodeMappingRow } from '@/lib/barcode';

/**
 * クライアント側の fetch ラッパ。
 * JSON ヘッダの付与・`res.ok` チェック・エラーメッセージ抽出・JSON パースを一元化する。
 * サーバ側の `defineRoute`（lib/api/handler.ts）と対になる。
 */

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown } | null;
    if (typeof data?.error === 'string' && data.error) return data.error;
  } catch {
    // JSON 以外のレスポンスは fallback を使う
  }
  return fallback;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  errorMessage: string,
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
    throw new HttpError(
      await readErrorMessage(response, errorMessage),
      response.status,
    );
  }
  // 204 など本文が無いレスポンスでも壊れないようにする
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(url: string, errorMessage: string) =>
    request<T>('GET', url, errorMessage),
  post: <T>(url: string, body: unknown, errorMessage: string) =>
    request<T>('POST', url, errorMessage, body),
  put: (url: string, body: unknown, errorMessage: string) =>
    request<undefined>('PUT', url, errorMessage, body),
  patch: <T>(url: string, body: unknown, errorMessage: string) =>
    request<T>('PATCH', url, errorMessage, body),
  delete: (url: string, errorMessage: string) =>
    request<undefined>('DELETE', url, errorMessage),
};

/** バーコードから登録済み食品を引く。未登録(404)は null、その他のエラーは throw。 */
export async function fetchBarcodeFood(
  code: string,
): Promise<BarcodeFood | null> {
  try {
    return await api.get<BarcodeFood>(
      `/api/barcode?code=${encodeURIComponent(code)}`,
      '商品情報の取得に失敗しました',
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

export function fetchBarcodeMappings(): Promise<BarcodeMappingRow[]> {
  return api.get(
    '/api/barcode/mappings',
    'バーコードマッピングの取得に失敗しました',
  );
}

export async function saveBarcodeMapping(
  barcodes: string[],
  food: BarcodeFood,
): Promise<void> {
  await api.post(
    '/api/barcode',
    { barcodes, food },
    'バーコードの保存に失敗しました',
  );
}

/** テキストから AI で PFC・カロリーを推定する。 */
export function estimateNutrition(text: string): Promise<BarcodeFood> {
  return api.post('/api/ai-nutrition', { text }, 'AI推定に失敗しました');
}

/** 画像(dataURL)から OCR でテキストを抽出する。抽出できない場合は空文字。 */
export async function ocrImage(imageDataUrl: string): Promise<string> {
  const result = await api.post<{ text: string }>(
    '/api/ocr',
    { imageDataUrl },
    'OCRに失敗しました',
  );
  return result.text.trim();
}
