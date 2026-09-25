import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { listBarcodeMappings } from '@/lib/server/barcode-kv';

export const GET = defineRoute({ label: 'バーコードマッピング一覧', auth: true }, async () =>
  NextResponse.json(await listBarcodeMappings()),
);
