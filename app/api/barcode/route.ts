import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, defineRoute, noContent } from '@/lib/api/handler';
import { barcodeFoodSchema } from '@/lib/api/schemas';
import { normalizeBarcodes, toBarcodeFood } from '@/lib/barcode';
import { findCatalogItemByJan } from '@/lib/catalog/stores';
import { foodCandidateKey } from '@/lib/food-suggestions';
import { getBarcodeMapping, saveBarcodeMapping } from '@/lib/server/barcode-kv';
import { findFoodByAlias } from '@/lib/server/foods';
import { findOpenFoodFactsByBarcode } from '@/lib/server/open-food-facts';

export const GET = defineRoute(
  { label: 'バーコード取得', auth: true },
  async (request, { userId }) => {
    const code = request.nextUrl.searchParams.get('code');
    if (!code) throw new ApiError('バーコードが指定されていません', 400);

    // 登録が無ければ、公式サイトから集めた商品カタログの JAN コード、次に Open Food Facts で探す
    const registered = await getBarcodeMapping(code);
    const found = registered ? undefined : findCatalogItemByJan(code);
    const food =
      registered ??
      (found
        ? toBarcodeFood({ ...found.item, store: found.store.name })
        : await findOpenFoodFactsByBarcode(code));
    if (!food) throw new ApiError('該当する商品が見つかりません', 404);
    const target = await findFoodByAlias(userId, foodCandidateKey(food));
    return NextResponse.json(
      target
        ? { ...toBarcodeFood(target), storeGroup: target.storeGroup }
        : food,
    );
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
