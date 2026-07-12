'use client';

/**
 * クライアント側の fetch ラッパ。
 * JSON ヘッダの付与・`res.ok` チェック・エラーメッセージ抽出・JSON パースを一元化する。
 * サーバ側の `defineRoute`（lib/api/handler.ts）に対応するクライアント側の対物。
 */

export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown } | null;
    if (data && typeof data.error === 'string' && data.error) {
      return data.error;
    }
  } catch {
    // JSON 以外のレスポンスはそのまま fallback を使う
  }
  return fallback;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

async function parseJson<T>(response: Response): Promise<T> {
  // 204 など本文が無いレスポンスでも壊れないようにする
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function send<T>(url: string, init: RequestInit, errorMessage: string): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, errorMessage));
  }
  return parseJson<T>(response);
}

export function apiGet<T = unknown>(
  url: string,
  errorMessage: string,
  init?: RequestInit,
): Promise<T> {
  return send<T>(url, { method: 'GET', ...init }, errorMessage);
}

export function apiPost<T = unknown>(
  url: string,
  body: unknown,
  errorMessage: string,
): Promise<T> {
  return send<T>(
    url,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) },
    errorMessage,
  );
}

export function apiPatch<T = unknown>(
  url: string,
  body: unknown,
  errorMessage: string,
): Promise<T> {
  return send<T>(
    url,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) },
    errorMessage,
  );
}

export function apiDelete<T = unknown>(url: string, errorMessage: string): Promise<T> {
  return send<T>(url, { method: 'DELETE' }, errorMessage);
}
