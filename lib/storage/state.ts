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
import { apiGet, apiPost } from '../api-client';
import generatedFoodsRaw from '@/data/generated_foods.json';

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

// localStorage に保存するキャッシュのバージョン。スキーマ変更時にインクリメント
const CACHE_VERSION = 1;
const CACHE_KEY_PREFIX = `pfc:cache:v${CACHE_VERSION}:`;

let currentUserId: string | null = null;

function cacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

interface CachedSnapshot {
  logs: Record<string, DailyLog>;
  settings: StoredSettings;
  foods: FoodItem[];
  sports: SportDefinition[];
}

function readCache(userId: string): CachedSnapshot | null {
  if (!isClient) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as CachedSnapshot;
  } catch {
    return null;
  }
}

function writeCache(userId: string) {
  if (!isClient) return;
  try {
    const snapshot: CachedSnapshot = {
      logs: cloudState.logs,
      settings: cloudState.settings,
      foods: cloudState.foods,
      sports: cloudState.sports,
    };
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(snapshot));
  } catch {
    // 容量超過などは無視
  }
}

function persistCache() {
  if (currentUserId && cloudState.loaded) {
    writeCache(currentUserId);
  }
}

export function refreshUI() {
  if (isClient) {
    window.dispatchEvent(new Event('pfc-update'));
  }
  persistCache();
}

export function isCloudDataLoaded(): boolean {
  return cloudState.loaded;
}

function serializeSettings(settings: StoredSettings): Record<string, unknown> {
  return {
    targetPFC: settings.targetPFC,
    profile: settings.profile,
    favoriteFoodIds: settings.favoriteFoodIds ?? [],
  };
}

/**
 * 楽観的更新の定型（API 呼び出し → 失敗時ロールバック + toast）をまとめる。
 * 呼び出し側は runOptimistic を呼ぶ前に cloudState を楽観的に更新しておき、
 * rollback にはスナップショットへ戻す処理を渡す。
 */
export async function runOptimistic<T>(params: {
  rollback: () => void;
  request: () => Promise<T>;
  errorLabel: string;
  onSuccess?: (result: T) => void;
  rethrow?: boolean;
}): Promise<void> {
  try {
    const result = await params.request();
    params.onSuccess?.(result);
  } catch (error) {
    params.rollback();
    toast.fromError(params.errorLabel, error);
    if (params.rethrow) throw error;
  }
}

async function syncPost(endpoint: string, body: unknown, label: string) {
  if (!cloudState.loaded) return;

  try {
    await apiPost(endpoint, body, 'クラウド保存に失敗しました');
  } catch (error) {
    toast.fromError(`クラウド同期失敗 (${label})`, error, 'クラウド保存に失敗しました');
  }
}

export function syncSettings() {
  return syncPost(
    '/api/settings',
    { settings: serializeSettings(cloudState.settings) },
    'settings',
  );
}

export function syncSports() {
  return syncPost('/api/sports', { sports: cloudState.sports }, 'sports');
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

/**
 * localStorage に保存されたキャッシュを cloudState に流し込み、即時に loaded=true にする。
 * キャッシュが無い場合は何もしない。fetchCloudData() を別途呼び出すこと。
 */
export function hydrateFromCache(userId: string): boolean {
  currentUserId = userId;
  const cached = readCache(userId);
  if (!cached) return false;

  cloudState.logs = cached.logs ?? {};
  cloudState.foods = mergeGeneratedFoods(
    Array.isArray(cached.foods) ? cached.foods : [],
  );
  const sports = normalizeSports(cached.sports);
  cloudState.sports = sports.length > 0 ? sports : [...DEFAULT_SPORTS];
  cloudState.settings = {
    targetPFC: cached.settings?.targetPFC ?? DEFAULT_TARGET,
    profile: cached.settings?.profile,
    favoriteFoodIds: Array.isArray(cached.settings?.favoriteFoodIds)
      ? cached.settings.favoriteFoodIds
      : [],
  };
  cloudState.loaded = true;
  refreshUI();
  return true;
}

export async function loadCloudData(userId?: string): Promise<boolean> {
  if (userId) currentUserId = userId;
  try {
    const data = await apiGet<CloudFetchResponse>(
      '/api/cloud-data',
      'ユーザーデータ取得に失敗しました',
    );

    const payload = data.payload;
    const settingsFromCloud = (payload?.settings ?? null) as
      | (UserSettings & Record<string, unknown>)
      | null;
    const storedSports = normalizeSports(payload?.sports);

    cloudState.logs = (payload?.logs ?? {}) as Record<string, DailyLog>;
    const rawFoods = Array.isArray(payload?.foods)
      ? (payload!.foods as FoodItem[])
      : [];
    // 既定食品(generated_foods.json)は毎回クライアント側でマージするだけで DB には保存しない。
    // 編集された既定食品は /api/foods 側の upsert で行が作られる。
    cloudState.foods = mergeGeneratedFoods(rawFoods);
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

    refreshUI();
    return true;
  } catch (error) {
    toast.fromError('ユーザーデータ読み込み失敗', error, 'ユーザーデータ取得に失敗しました');
    return false;
  }
}
