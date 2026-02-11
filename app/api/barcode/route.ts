import { NextRequest, NextResponse } from 'next/server';

import type { FoodItemForKVS } from '@/lib/barcode-mapping';
import { getBarcodeMapping, saveBarcodeMapping } from '@/lib/barcode-kv';

// GET request to retrieve food data by barcode
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Barcode is required' }, { status: 400 });
  }

  try {
    const foodData = await getBarcodeMapping(code);

    if (foodData) {
      return NextResponse.json(foodData);
    }

    return NextResponse.json({ error: 'Product not found in KVS' }, { status: 404 });
  } catch (error) {
    console.error('Error in GET /api/barcode:', error);
    return NextResponse.json({ error: 'Failed to retrieve product data' }, { status: 500 });
  }
}

// POST request to save food data for a barcode
export async function POST(request: NextRequest) {
  const { barcode, foodData }: { barcode: string; foodData: FoodItemForKVS } = await request.json();

  if (!barcode || !foodData) {
    return NextResponse.json({ error: 'Barcode and foodData are required' }, { status: 400 });
  }

  try {
    await saveBarcodeMapping(barcode, foodData);
    return NextResponse.json({ message: 'Barcode data saved successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/barcode:', error);
    return NextResponse.json({ error: 'Failed to save barcode data' }, { status: 500 });
  }
}
