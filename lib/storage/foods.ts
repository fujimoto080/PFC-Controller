'use client';

import { FoodItem } from '../types';
import { cloudState, readErrorMessage, refreshUI } from './state';
import { getLogs } from './logs';
import { toast } from '../toast';

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

  try {
    const res = await fetch('/api/foods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, '食品の保存に失敗しました'));
    }
  } catch (error) {
    setFoods(snapshot);
    toast.fromError('食品の保存に失敗しました', error);
  }
}

export async function updateFoodInDictionary(updatedItem: FoodItem): Promise<void> {
  const snapshot = cloudState.foods;
  const index = snapshot.findIndex((f) => f.id === updatedItem.id);
  if (index === -1) return;

  const next = [...snapshot];
  next[index] = updatedItem;
  setFoods(next);

  try {
    const { id, ...input } = updatedItem;
    const res = await fetch(`/api/foods/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, '食品の更新に失敗しました'));
    }
  } catch (error) {
    setFoods(snapshot);
    toast.fromError('食品の更新に失敗しました', error);
  }
}

export async function deleteFoodFromDictionary(id: string): Promise<void> {
  const snapshot = cloudState.foods;
  setFoods(snapshot.filter((f) => f.id !== id));

  try {
    const res = await fetch(`/api/foods/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, '食品の削除に失敗しました'));
    }
  } catch (error) {
    setFoods(snapshot);
    toast.fromError('食品の削除に失敗しました', error);
  }
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
