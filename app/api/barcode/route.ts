import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const BARCODE_KVS_FILE = path.join(process.cwd(), 'data', 'barcode_kvs.json');

interface FoodItemForKVS {
    name: string;
    protein: number;
    fat: number;
    carbs: number;
    calories: number;
    store?: string;
}

async function readBarcodeKVS(): Promise<{ [barcode: string]: FoodItemForKVS }> {
    try {
        const fileContents = await fs.readFile(BARCODE_KVS_FILE, 'utf8');
        return JSON.parse(fileContents);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // File does not exist, return empty object
            return {};
        }
        console.error('Error reading barcode KVS file:', error);
        return {}; // Return empty on error to prevent crashing
    }
}

async function writeBarcodeKVS(data: { [barcode: string]: FoodItemForKVS }): Promise<void> {
    try {
        await fs.writeFile(BARCODE_KVS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing barcode KVS file:', error);
        throw new Error('Failed to save barcode data');
    }
}

// GET request to retrieve food data by barcode
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'Barcode is required' }, { status: 400 });
    }

    try {
        const kvs = await readBarcodeKVS();
        const foodData = kvs[code];

        if (foodData) {
            return NextResponse.json(foodData);
        } else {
            return NextResponse.json({ error: 'Product not found in KVS' }, { status: 404 });
        }
    } catch (error) {
        console.error('Error in GET /api/barcode:', error);
        return NextResponse.json({ error: 'Failed to retrieve product data' }, { status: 500 });
    }
}

// POST request to save food data for a barcode
export async function POST(request: NextRequest) {
    const { barcode, foodData }: { barcode: string, foodData: FoodItemForKVS } = await request.json();

    if (!barcode || !foodData) {
        return NextResponse.json({ error: 'Barcode and foodData are required' }, { status: 400 });
    }

    try {
        const kvs = await readBarcodeKVS();
        kvs[barcode] = foodData;
        await writeBarcodeKVS(kvs);
        return NextResponse.json({ message: 'Barcode data saved successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error in POST /api/barcode:', error);
        return NextResponse.json({ error: 'Failed to save barcode data' }, { status: 500 });
    }
}