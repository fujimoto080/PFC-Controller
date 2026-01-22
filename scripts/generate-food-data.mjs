import fs from 'fs';
import path from 'path';

const STORES_DIR = './data/stores';
const OUTPUT_FILE = './data/generated_foods.json';

function parseCsv(content) {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const dataLines = lines.slice(1);

    return dataLines.map((line) => {
        const values = line.split(',').map(v => v.trim());
        const item = {};
        headers.forEach((header, i) => {
            item[header] = values[i];
        });
        return item;
    });
}

function generate() {
    if (!fs.existsSync(STORES_DIR)) {
        fs.mkdirSync(STORES_DIR, { recursive: true });
    }

    const files = fs.readdirSync(STORES_DIR);
    let allFoods = [];

    files.forEach(file => {
        if (path.extname(file).toLowerCase() === '.csv') {
            const storeName = path.basename(file, '.csv');
            const content = fs.readFileSync(path.join(STORES_DIR, file), 'utf8');
            const foods = parseCsv(content);

            foods.forEach((food, idx) => {
                allFoods.push({
                    id: `csv_${storeName}_${idx}`,
                    name: food.name,
                    protein: parseFloat(food.protein) || 0,
                    fat: parseFloat(food.fat) || 0,
                    carbs: parseFloat(food.carbs) || 0,
                    calories: parseFloat(food.calories) || 0,
                    store: food.store || storeName,
                    image: food.image || null,
                });
            });
        }
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allFoods, null, 2));
    console.log(`Generated ${allFoods.length} foods from CSVs.`);
}

generate();
