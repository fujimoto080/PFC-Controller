import 'server-only';

import type { BarcodeMappingRow, FoodItemForKVS } from '@/lib/barcode-mapping';

const BARCODE_MAPPING_KEY_PREFIX = 'barcode:mapping:';
const BARCODE_MAPPING_INDEX_KEY = 'barcode:mappings:index';

type RedisCommandResult<T> = {
  result: T;
  error: string | null;
};

function getKVConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error('Vercel KVの環境変数(KV_REST_API_URL / KV_REST_API_TOKEN)が未設定です');
  }

  return { url, token };
}

async function executePipeline<T = unknown>(commands: string[][]): Promise<RedisCommandResult<T>[]> {
  const { url, token } = getKVConfig();
  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Vercel KVへのアクセスに失敗しました: ${response.status}`);
  }

  return (await response.json()) as RedisCommandResult<T>[];
}

async function executeSingleCommand<T = unknown>(command: string[]): Promise<T | null> {
  const [result] = await executePipeline<T>([command]);

  if (result.error) {
    throw new Error(`Vercel KVコマンドの実行に失敗しました: ${result.error}`);
  }

  return (result.result ?? null) as T | null;
}

function buildBarcodeMappingKey(barcode: string): string {
  return `${BARCODE_MAPPING_KEY_PREFIX}${barcode}`;
}

export async function getBarcodeMapping(barcode: string): Promise<FoodItemForKVS | null> {
  const key = buildBarcodeMappingKey(barcode);
  const value = await executeSingleCommand<string>(['GET', key]);

  if (!value) {
    return null;
  }

  return JSON.parse(value) as FoodItemForKVS;
}

export async function saveBarcodeMapping(barcode: string, foodData: FoodItemForKVS): Promise<void> {
  const key = buildBarcodeMappingKey(barcode);
  const serialized = JSON.stringify(foodData);

  const results = await executePipeline([
    ['SET', key, serialized],
    ['SADD', BARCODE_MAPPING_INDEX_KEY, barcode],
  ]);

  const commandError = results.find((result) => result.error);
  if (commandError?.error) {
    throw new Error(`Vercel KVへの保存に失敗しました: ${commandError.error}`);
  }
}

export async function listBarcodeMappings(): Promise<BarcodeMappingRow[]> {
  const barcodes = await executeSingleCommand<string[]>(['SMEMBERS', BARCODE_MAPPING_INDEX_KEY]);

  if (!barcodes || barcodes.length === 0) {
    return [];
  }

  const rows = await Promise.all(
    barcodes.map(async (barcode) => {
      const food = await getBarcodeMapping(barcode);
      if (!food) {
        return null;
      }
      return { barcode, food };
    }),
  );

  return rows
    .filter((row): row is BarcodeMappingRow => row !== null)
    .sort((left, right) => left.barcode.localeCompare(right.barcode));
}
