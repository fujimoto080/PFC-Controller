'use client';

import {
  DailyLog,
  FoodItem,
  UserSettings,
  DEFAULT_TARGET,
  SportDefinition,
} from '../types';
import { toast } from '../toast';
import { roundPFC } from '../utils';
import generatedFoodsRaw from '@/data/generated_foods.json';

export type ResourceKey = 'logs' | 'settings' | 'foods' | 'sports';

export type StoredSettings = Omit<UserSettings, 'sports'>;

interface CloudState {
  logs: Record<string, DailyLog>;
  settings: StoredSettings;
  foods: FoodItem[];
  sports: SportDefinition[];
  loaded: boolean;
}

export const DEFAULT_SPORTS: readonly SportDefinition[] = [
  { id: 'walking', name: 'ウォーキング', caloriesBurned: 180 },
  { id: 'running', name: 'ランニング', caloriesBurned: 320 },
  { id: 'cycling', name: 'サイクリング', caloriesBurned: 260 },
];

export const cloudState: CloudState = {
  logs: {},
  settings: { targetPFC: DEFAULT_TARGET },
  foods: [],
  sports: [...DEFAULT_SPORTS],
  loaded: false,
};

const isClient = typeof window !== 'undefined';

export function refreshUI() {
  if (isClient) {
    window.dispatchEvent(new Event('pfc-update'));
  }
}

export function isCloudDataLoaded(): boolean {
  return cloudState.loaded;
}

function endpointFor(resource: ResourceKey): string {
  return `/api/cloud-data/${resource}`;
}

function serializeSettings(settings: StoredSettings): Record<string, unknown> {
  return {
    targetPFC: settings.targetPFC,
    profile: settings.profile,
    favoriteFoodIds: settings.favoriteFoodIds ?? [],
  };
}

function valueFor(resource: ResourceKey): unknown {
  switch (resource) {
    case 'logs':
      return cloudState.logs;
    case 'settings':
      return serializeSettings(cloudState.settings);
    case 'foods':
      return cloudState.foods;
    case 'sports':
      return cloudState.sports;
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown } | null;
    if (data && typeof data.error === 'string' && data.error) {
      return data.error;
    }
  } catch {
    // JSON 以外のレスポンスはそのまま fallback を使う
  }
  return fallback;
}

export async function syncResource(resource: ResourceKey) {
  if (!cloudState.loaded) return;

  try {
    const response = await fetch(endpointFor(resource), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [resource]: valueFor(resource) }),
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'クラウド保存に失敗しました'));
    }
  } catch (error) {
    toast.fromError(`クラウド同期失敗 (${resource})`, error, 'クラウド保存に失敗しました');
  }
}

interface CloudFetchResponse {
  payload: {
    logs?: Record<string, DailyLog>;
    settings?: UserSettings & Record<string, unknown>;
    foods?: FoodItem[];
    sports?: SportDefinition[];
  } | null;
}

const generatedFoods = generatedFoodsRaw as FoodItem[];

export function mergeGeneratedFoods(existing: FoodItem[]): FoodItem[] {
  const merged = [...existing];
  const seen = new Set(merged.map((item) => item.id));
  for (const defaultItem of generatedFoods) {
    if (!seen.has(defaultItem.id)) {
      merged.push(defaultItem);
      seen.add(defaultItem.id);
    }
  }
  return merged;
}

export function normalizeSports(sports: unknown): SportDefinition[] {
  if (!Array.isArray(sports)) return [];

  return sports
    .filter(
      (sport): sport is SportDefinition =>
        !!sport &&
        typeof sport === 'object' &&
        typeof (sport as SportDefinition).id === 'string' &&
        typeof (sport as SportDefinition).name === 'string' &&
        typeof (sport as SportDefinition).caloriesBurned === 'number' &&
        Number.isFinite((sport as SportDefinition).caloriesBurned),
    )
    .map(toSportDefinition);
}

export function toSportDefinition(sport: SportDefinition): SportDefinition {
  return {
    id: sport.id,
    name: sport.name,
    caloriesBurned: Math.max(0, roundPFC(sport.caloriesBurned)),
  };
}

export async function loadCloudData(): Promise<boolean> {
  try {
    const response = await fetch('/api/cloud-data');
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'ユーザーデータ取得に失敗しました'));
    }
    const data = (await response.json()) as CloudFetchResponse;

    const payload = data.payload;
    const settingsFromCloud = (payload?.settings ?? null) as
      | (UserSettings & Record<string, unknown>)
      | null;
    const storedSports = normalizeSports(payload?.sports);

    cloudState.logs = (payload?.logs ?? {}) as Record<string, DailyLog>;
    const rawFoods = Array.isArray(payload?.foods)
      ? (payload!.foods as FoodItem[])
      : [];
    const mergedFoods = mergeGeneratedFoods(rawFoods);
    const foodsChanged = mergedFoods.length !== rawFoods.length;
    cloudState.foods = mergedFoods;
    cloudState.sports =
      storedSports.length > 0 ? storedSports : [...DEFAULT_SPORTS];
    cloudState.settings = {
      targetPFC: settingsFromCloud?.targetPFC ?? DEFAULT_TARGET,
      profile: settingsFromCloud?.profile,
      favoriteFoodIds: Array.isArray(settingsFromCloud?.favoriteFoodIds)
        ? (settingsFromCloud.favoriteFoodIds as string[])
        : [],
    };
    cloudState.loaded = true;

    if (foodsChanged) {
      void syncResource('foods');
    }
    refreshUI();
    return true;
  } catch (error) {
    toast.fromError('ユーザーデータ読み込み失敗', error, 'ユーザーデータ取得に失敗しました');
    return false;
  }
}
