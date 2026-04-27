import { NextResponse } from 'next/server';
import { z } from 'zod';

import { normalizeBarcodes, type BarcodeFood } from '@/lib/barcode-mapping';
import { getBarcodeMapping, saveBarcodeMapping } from '@/lib/barcode-kv';
import { ApiError, defineRoute } from '@/lib/api/handler';

export const GET = defineRoute(
  { label: 'バーコード取得' },
  async (request) => {
    const code = request.nextUrl.searchParams.get('code');
    if (!code) {
      throw new ApiError('バーコードが指定されていません', 400);
    }

    const foodData = await getBarcodeMapping(code);
    if (!foodData) {
      throw new ApiError('該当する商品が見つかりません', 404);
    }
    return NextResponse.json(foodData);
  },
);

const postSchema = z.object({
  barcode: z.string().optional(),
  barcodes: z.array(z.string()).optional(),
  foodData: z.custom<BarcodeFood>((v) => !!v && typeof v === 'object', {
    message: 'foodData は必須です',
  }),
});

export const POST = defineRoute(
  { label: 'バーコード保存', body: postSchema },
  async (_req, { body }) => {
    const normalizedBarcodes = normalizeBarcodes(body.barcodes ?? body.barcode ?? '');
    if (normalizedBarcodes.length === 0) {
      throw new ApiError('バーコードを1件以上指定してください', 400);
    }

    await Promise.all(
      normalizedBarcodes.map((code) => saveBarcodeMapping(code, body.foodData)),
    );
    return NextResponse.json({
      message: 'Barcode data saved successfully',
      count: normalizedBarcodes.length,
    });
  },
);
