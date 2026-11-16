import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { logItemInputSchema } from '@/lib/api/schemas';
import { saveScanEntries } from '@/lib/server/scan-registration';

const batchSchema = z.array(z.unknown()).min(1);
const entrySchema = z.object({
  id: z.uuid().toLowerCase(),
  input: logItemInputSchema,
  barcodes: z.array(z.string()),
});

export const POST = defineRoute(
  { label: 'スキャン一括保存', auth: true, body: batchSchema },
  async (_request, { userId, body }) => {
    const entries = body.flatMap((value) => {
      const entry = entrySchema.safeParse(value);
      return entry.success ? [entry.data] : [];
    });
    if (entries.length === 0)
      throw new ApiError('保存できる商品がありません', 400);
    return NextResponse.json(await saveScanEntries(userId, entries));
  },
);
