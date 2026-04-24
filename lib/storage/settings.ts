'use client';

import { UserSettings } from '../types';
import {
  cloudState,
  normalizeSports,
  refreshUI,
  syncResource,
} from './state';

export function getSettings(): UserSettings {
  return {
    ...cloudState.settings,
    sports: cloudState.sports,
  };
}

export function saveSettings(settings: UserSettings) {
  const { sports, ...rest } = settings;
  const normalizedSports = normalizeSports(sports);
  const sportsChanged =
    normalizedSports.length !== cloudState.sports.length ||
    normalizedSports.some((sport, i) => {
      const prev = cloudState.sports[i];
      return (
        !prev ||
        prev.id !== sport.id ||
        prev.name !== sport.name ||
        prev.caloriesBurned !== sport.caloriesBurned
      );
    });

  cloudState.settings = rest;
  cloudState.sports = normalizedSports;
  refreshUI();
  void syncResource('settings');
  if (sportsChanged) {
    void syncResource('sports');
  }
}
