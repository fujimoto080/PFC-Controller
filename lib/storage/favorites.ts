'use client';

import { FoodItem, UserSettings } from '../types';
import { getSettings, saveSettings } from './settings';
import { getFoodDictionary } from './foods';

const getFavoriteFoodIds = (settings: UserSettings): string[] =>
  Array.isArray(settings.favoriteFoodIds) ? [...settings.favoriteFoodIds] : [];

export function getFavoriteFoods(): FoodItem[] {
  const settings = getSettings();
  const favoriteIds = getFavoriteFoodIds(settings);

  if (favoriteIds.length === 0) return [];

  const dictionary = getFoodDictionary();
  return favoriteIds
    .map((id) => dictionary.find((item) => item.id === id))
    .filter((item): item is FoodItem => item !== undefined);
}

export function toggleFavoriteFood(id: string) {
  const settings = getSettings();
  const favoriteIds = getFavoriteFoodIds(settings);

  const index = favoriteIds.indexOf(id);
  if (index === -1) {
    favoriteIds.push(id);
  } else {
    favoriteIds.splice(index, 1);
  }

  saveSettings({ ...settings, favoriteFoodIds: favoriteIds });
}

export function isFavoriteFood(id: string): boolean {
  const settings = getSettings();
  const favoriteIds = getFavoriteFoodIds(settings);
  return favoriteIds.includes(id);
}
