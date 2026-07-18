'use client';

import { FoodItem } from '../types';
import { cloudState, refreshUI, runOptimistic } from './state';
import { apiDelete, apiPatch, apiPost } from '../api-client';
import { getLogs } from './logs';

const isClient = typeof window !== 'undefined';

export function getFoodDictionary(): FoodItem[] {
  if (!isClient) return [];
  return cloudState.foods;
}

function setFoods(foods: FoodItem[]) {
  cloudState.foods = foods;
  refreshUI();
}

export async function addFoodToDictionary(item: FoodItem): Promise<void> {
  const snapshot = cloudState.foods;
  setFoods([...snapshot, item]);

  await runOptimistic({
    rollback: () => { setFoods(snapshot); },
    request: () => apiPost('/api/foods', item, '食品の保存に失敗しました'),
    errorLabel: '食品の保存に失敗しました',
    rethrow: true,
  });
}

export async function updateFoodInDictionary(updatedItem: FoodItem): Promise<void> {
  const snapshot = cloudState.foods;
  const index = snapshot.findIndex((f) => f.id === updatedItem.id);
  if (index === -1) return;

  const next = [...snapshot];
  next[index] = updatedItem;
  setFoods(next);

  const { id, ...input } = updatedItem;
  await runOptimistic({
    rollback: () => { setFoods(snapshot); },
    request: () => apiPatch(`/api/foods/${encodeURIComponent(id)}`, input, '食品の更新に失敗しました'),
    errorLabel: '食品の更新に失敗しました',
  });
}

export async function deleteFoodFromDictionary(id: string): Promise<void> {
  const snapshot = cloudState.foods;
  setFoods(snapshot.filter((f) => f.id !== id));

  await runOptimistic({
    rollback: () => { setFoods(snapshot); },
    request: () => apiDelete(`/api/foods/${encodeURIComponent(id)}`, '食品の削除に失敗しました'),
    errorLabel: '食品の削除に失敗しました',
  });
}

export function getUniqueStores(): string[] {
  const stores = new Set<string>();
  for (const item of getFoodDictionary()) {
    if (item.store) stores.add(item.store);
  }
  for (const log of Object.values(getLogs())) {
    for (const item of log.items) {
      if (item.store) stores.add(item.store);
    }
  }
  return Array.from(stores).sort();
}
