import type { FoodItemForKVS } from './barcode-mapping';

export async function saveBarcodeMappingRequest(
  barcodes: string[],
  foodData: FoodItemForKVS,
): Promise<void> {
  if (barcodes.length === 0) return;

  await fetch('/api/barcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcodes, foodData }),
  });
}
