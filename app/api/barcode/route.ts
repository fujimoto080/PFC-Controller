import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, defineRoute, noContent } from '@/lib/api/handler';
import { barcodeFoodSchema } from '@/lib/api/schemas';
import { normalizeBarcodes, toBarcodeFood } from '@/lib/barcode';
import { findCatalogItemByJan } from '@/lib/catalog/stores';
import { getBarcodeMapping, saveBarcodeMapping } from '@/lib/server/barcode-kv';
import { findOpenFoodFactsByBarcode } from '@/lib/server/open-food-facts';

export const GET = defineRoute(
  { label: 'バーコード取得', auth: true },
  async (request) => {
    const code = request.nextUrl.searchParams.get('code');
    if (!code) throw new ApiError('バーコードが指定されていません', 400);

    const food = await getBarcodeMapping(code);
    if (food) return NextResponse.json(food);
    // 登録が無ければ、公式サイトから集めた商品カタログの JAN コード、次に Open Food Facts で探す
    const found = findCatalogItemByJan(code);
    if (found) {
      return NextResponse.json(
        toBarcodeFood({ ...found.item, store: found.store.name }),
      );
    }
    const openFoodFacts = await findOpenFoodFactsByBarcode(code);
    if (!openFoodFacts) throw new ApiError('該当する商品が見つかりません', 404);
    return NextResponse.json(openFoodFacts);
  },
);

const postSchema = z.object({
  barcodes: z.array(z.string()),
  food: barcodeFoodSchema,
});

export const POST = defineRoute(
  { label: 'バーコード保存', auth: true, body: postSchema },
  async (_req, { body }) => {
    const barcodes = normalizeBarcodes(body.barcodes);
    if (barcodes.length === 0)
      throw new ApiError('バーコードを1件以上指定してください', 400);

    await Promise.all(
      barcodes.map((code) => saveBarcodeMapping(code, body.food)),
    );
    return noContent();
  },
);
