import { NextResponse } from 'next/server';

import { listBarcodeMappings } from '@/lib/barcode-kv';

export async function GET() {
  try {
    const mappings = await listBarcodeMappings();
    return NextResponse.json(mappings, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/barcode/mappings:', error);
    return NextResponse.json({ error: 'Failed to retrieve barcode mappings' }, { status: 500 });
  }
}
