import 'server-only';

import { findChainStore } from '@/lib/chain-stores';
import { distanceMeters } from '@/lib/meal-schedule';
import type { GeoPoint, NearbyStore } from '@/lib/types';

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_M = 600;
const STATION_RADIUS_M = 1200;
const MAX_STORES_PER_PLACE = 25;

const CATEGORY_LABELS: Record<string, string> = {
  convenience: 'コンビニ',
  supermarket: 'スーパー',
  bakery: 'パン屋',
  deli: '惣菜',
  restaurant: '飲食店',
  fast_food: 'ファストフード',
  cafe: 'カフェ',
  food_court: 'フードコート',
};

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface PlaceSurroundings {
  near: string;
  point: GeoPoint;
  stations: string[];
  stores: NearbyStore[];
}

function buildQuery({ lat, lon }: GeoPoint): string {
  const around = `(around:${SEARCH_RADIUS_M},${lat},${lon})`;
  const categories = Object.keys(CATEGORY_LABELS);
  return `[out:json][timeout:15];
(
  nwr${around}[shop~"^(${categories.join('|')})$"][name];
  nwr${around}[amenity~"^(${categories.join('|')})$"][name];
  node(around:${STATION_RADIUS_M},${lat},${lon})[railway=station][name];
);
out center tags;`;
}

/** 地点の周辺にある飲食店・小売店と最寄り駅を OpenStreetMap から取得する。失敗しても空で返す。 */
async function fetchSurroundings(
  near: string,
  point: GeoPoint,
): Promise<PlaceSurroundings> {
  const empty = { near, point, stations: [], stores: [] };
  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PFC-Balance/1.0 (meal suggestion)',
      },
      body: new URLSearchParams({ data: buildQuery(point) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.error('Overpass API error:', response.status);
      return empty;
    }
    const { elements } = (await response.json()) as {
      elements: OverpassElement[];
    };
    return { near, point, ...toSurroundings(near, point, elements) };
  } catch (error) {
    console.error('Overpass API failed:', error);
    return empty;
  }
}

function toSurroundings(
  near: string,
  origin: GeoPoint,
  elements: OverpassElement[],
) {
  const stations = new Map<string, number>();
  const stores: NearbyStore[] = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const name = tags.name;
    if (lat === undefined || lon === undefined || !name) continue;
    const point = { lat, lon };
    const distanceM = distanceMeters(origin, point);

    if (tags.railway === 'station') {
      stations.set(name, Math.min(stations.get(name) ?? Infinity, distanceM));
      continue;
    }
    const chain = findChainStore(name, tags.brand, tags['brand:ja']);
    const category = tags.shop ?? tags.amenity ?? '';
    const cuisine = tags.cuisine ? `（${tags.cuisine}）` : '';
    stores.push({
      id: `${element.type}/${element.id}`,
      name: chain && !name.includes(chain) ? `${chain} ${name}` : name,
      category: `${CATEGORY_LABELS[category] ?? category}${cuisine}`,
      point,
      near,
      distanceM,
      isChain: chain !== undefined,
    });
  }
  // 栄養値を調べられるチェーンを優先し、近い順に並べる
  stores.sort(
    (a, b) =>
      Number(b.isChain) - Number(a.isChain) || a.distanceM - b.distanceM,
  );
  return {
    stations: [...stations.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([name]) => name),
    stores: stores.slice(0, MAX_STORES_PER_PLACE),
  };
}

/** 複数地点の周辺を並行して調べる。同じお店は最初の地点のものだけ残す。 */
export async function findSurroundings(
  places: { near: string; point: GeoPoint }[],
): Promise<PlaceSurroundings[]> {
  const results = await Promise.all(
    places.map(({ near, point }) => fetchSurroundings(near, point)),
  );
  const seen = new Set<string>();
  return results.map((result) => ({
    ...result,
    stores: result.stores.filter((store) => {
      if (seen.has(store.id)) return false;
      seen.add(store.id);
      return true;
    }),
  }));
}
