import { NextResponse } from 'next/server';
import { listBarcodeMappings } from '@/lib/barcode-kv';
import { defineRoute } from '@/lib/api/handler';

export const GET = defineRoute(
  { label: 'バーコードマッピング一覧' },
  async () => {
    const mappings = await listBarcodeMappings();
    return NextResponse.json(mappings);
  },
);
