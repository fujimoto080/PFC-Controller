import 'server-only';

import { Redis } from '@upstash/redis';
import type { BarcodeMappingRow, FoodItemForKVS } from '@/lib/barcode-mapping';

const BARCODE_MAPPING_KEY_PREFIX = 'barcode:mapping:';
const BARCODE_MAPPING_INDEX_KEY = 'barcode:mappings:index';

const redis = Redis.fromEnv();

function buildBarcodeMappingKey(barcode: string): string {
  return `${BARCODE_MAPPING_KEY_PREFIX}${barcode}`;
}

export async function getBarcodeMapping(barcode: string): Promise<FoodItemForKVS | null> {
  const key = buildBarcodeMappingKey(barcode);
  const value = await redis.get<FoodItemForKVS>(key);

  if (!value) {
    return null;
  }

  return value;
}

export async function saveBarcodeMapping(barcode: string, foodData: FoodItemForKVS): Promise<void> {
  const key = buildBarcodeMappingKey(barcode);

  await redis.set(key, foodData);
  await redis.sadd(BARCODE_MAPPING_INDEX_KEY, barcode);
}

export async function listBarcodeMappings(): Promise<BarcodeMappingRow[]> {
  const barcodes = await redis.smembers<string[]>(BARCODE_MAPPING_INDEX_KEY);

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
