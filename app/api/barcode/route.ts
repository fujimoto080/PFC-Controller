import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, defineRoute, noContent } from '@/lib/api/handler';
import { barcodeFoodSchema } from '@/lib/api/schemas';
import { normalizeBarcodes } from '@/lib/barcode';
import { getBarcodeMapping, saveBarcodeMapping } from '@/lib/server/barcode-kv';

export const GET = defineRoute({ label: 'バーコード取得', auth: true }, async (request) => {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) throw new ApiError('バーコードが指定されていません', 400);

  const food = await getBarcodeMapping(code);
  if (!food) throw new ApiError('該当する商品が見つかりません', 404);
  return NextResponse.json(food);
});

const postSchema = z.object({
  barcodes: z.array(z.string()),
  food: barcodeFoodSchema,
});

export const POST = defineRoute(
  { label: 'バーコード保存', auth: true, body: postSchema },
  async (_req, { body }) => {
    const barcodes = normalizeBarcodes(body.barcodes);
    if (barcodes.length === 0) throw new ApiError('バーコードを1件以上指定してください', 400);

    await Promise.all(barcodes.map((code) => saveBarcodeMapping(code, body.food)));
    return noContent();
  },
);
