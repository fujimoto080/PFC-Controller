import 'server-only';

import { Redis } from '@upstash/redis';
import type { BarcodeFood, BarcodeMappingRow } from '@/lib/barcode';

const KEY_PREFIX = 'barcode:mapping:';
const INDEX_KEY = 'barcode:mappings:index';

const redis = Redis.fromEnv();

const mappingKey = (barcode: string) => `${KEY_PREFIX}${barcode}`;

export function getBarcodeMapping(
  barcode: string,
): Promise<BarcodeFood | null> {
  return redis.get<BarcodeFood>(mappingKey(barcode));
}

export async function saveBarcodeMappings(
  mappings: BarcodeMappingRow[],
): Promise<void> {
  const [first, ...rest] = mappings;
  if (!first) return;
  const values = Object.fromEntries(
    mappings.map(({ barcode, food }) => [mappingKey(barcode), food]),
  );
  await redis
    .multi()
    .mset(values)
    .sadd(INDEX_KEY, first.barcode, ...rest.map(({ barcode }) => barcode))
    .exec();
}

export async function listBarcodeMappings(): Promise<BarcodeMappingRow[]> {
  const barcodes = (await redis.smembers(INDEX_KEY)).sort();
  if (barcodes.length === 0) return [];

  const foods = await redis.mget<(BarcodeFood | null)[]>(
    ...barcodes.map(mappingKey),
  );
  return barcodes.flatMap((barcode, i) => {
    const food = foods[i];
    return food ? [{ barcode, food }] : [];
  });
}
