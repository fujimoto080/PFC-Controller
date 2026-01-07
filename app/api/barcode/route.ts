
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'Barcode is required' }, { status: 400 });
    }

    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
        const data = await response.json();

        if (data.status === 0) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        const product = data.product;
        const nutriments = product.nutriments;

        // Extract relevant data
        // Try to get per serving data first, fallback to per 100g
        const servingSize = product.serving_size || '100g';

        // Helper to get nutrient value (either serving or 100g)
        // Prefer explicit value fields if available
        const getNutrient = (key: string) => {
            // First check for _value (parsed)
            if (nutriments[`${key}_value`] !== undefined) return Number(nutriments[`${key}_value`]);
            // Fallback to _100g
            if (nutriments[`${key}_100g`] !== undefined) return Number(nutriments[`${key}_100g`]);
            return 0;
        };

        // We prioritize "1 package" or "1 serving" if available, but API structure varies.
        // For simplicity in this prototype, we return 100g data and let user adjust,
        // OR if serving data is clearly available.
        // Let's try to get data per 100g as a standard baseline, 
        // effectively, `nutriments.protein_100g`.
        // Ideally we should return both and let frontend decide, but let's stick to simple structure.

        const result = {
            name: product.product_name_ja || product.product_name || 'Unknown Product',
            protein: nutriments.proteins_100g || 0,
            fat: nutriments.fat_100g || 0,
            carbs: nutriments.carbohydrates_100g || 0,
            calories: nutriments['energy-kcal_100g'] || 0,
            store: product.brands || '',
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error fetching product:', error);
        return NextResponse.json({ error: 'Failed to fetch product data' }, { status: 500 });
    }
}
