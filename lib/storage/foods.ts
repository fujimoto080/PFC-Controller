'use client';

import { FoodItem } from '../types';
import { cloudState, refreshUI, syncResource } from './state';
import { getLogs } from './logs';

const isClient = typeof window !== 'undefined';

export function getFoodDictionary(): FoodItem[] {
  if (!isClient) return [];
  return cloudState.foods;
}

export function saveFoodDictionary(foods: FoodItem[]) {
  cloudState.foods = foods;
  refreshUI();
  void syncResource('foods');
}

export function addFoodToDictionary(item: FoodItem) {
  saveFoodDictionary([...cloudState.foods, item]);
}

export function updateFoodInDictionary(updatedItem: FoodItem) {
  const index = cloudState.foods.findIndex((f) => f.id === updatedItem.id);
  if (index === -1) return;

  const next = [...cloudState.foods];
  next[index] = updatedItem;
  saveFoodDictionary(next);
}

export function deleteFoodFromDictionary(id: string) {
  saveFoodDictionary(cloudState.foods.filter((f) => f.id !== id));
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
