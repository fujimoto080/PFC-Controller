'use client';

import {
  SportActivityInput,
  SportActivityLog,
  SportDefinition,
} from '../types';
import { cloudState, refreshUI, runOptimistic, toSportDefinition } from './state';
import { apiDelete, apiPost } from '../api-client';
import { getLogForDate } from './logs';
import { getSettings, saveSettings } from './settings';

export function addSportDefinition(sport: SportDefinition) {
  const settings = getSettings();
  const sports = [...(settings.sports ?? [])];
  const normalized = toSportDefinition(sport);

  if (sports.some((item) => item.id === normalized.id)) return;

  sports.push(normalized);
  saveSettings({ ...settings, sports });
}

export function updateSportDefinition(updatedSport: SportDefinition) {
  const settings = getSettings();
  const sports = [...(settings.sports ?? [])];
  const index = sports.findIndex((item) => item.id === updatedSport.id);
  if (index === -1) return;

  sports[index] = toSportDefinition(updatedSport);
  saveSettings({ ...settings, sports });
}

export function deleteSportDefinition(id: string) {
  const settings = getSettings();
  const sports = (settings.sports ?? []).filter((sport) => sport.id !== id);
  saveSettings({ ...settings, sports });
  // 過去ログ上の activities は履歴として残す方針のため触らない。
}

export async function addSportActivity(
  date: string,
  sport: SportDefinition,
): Promise<void> {
  const log = getLogForDate(date);
  const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timestamp = Date.now();
  const tempActivity: SportActivityLog = {
    id: tempId,
    sportId: sport.id,
    name: sport.name,
    caloriesBurned: sport.caloriesBurned,
    timestamp,
  };

  const snapshot = cloudState.logs;
  const activities = [...(log.activities ?? []), tempActivity];
  cloudState.logs = {
    ...snapshot,
    [date]: { ...log, activities },
  };
  refreshUI();

  const input: SportActivityInput = {
    sportId: sport.id,
    name: sport.name,
    caloriesBurned: sport.caloriesBurned,
    timestamp,
  };
  await runOptimistic({
    rollback: () => {
      cloudState.logs = snapshot;
      refreshUI();
    },
    request: () =>
      apiPost<{ activity: SportActivityLog; date: string }>(
        '/api/log-activities',
        input,
        '運動記録の追加に失敗しました',
      ),
    errorLabel: '運動の追加に失敗しました',
    rethrow: true,
    onSuccess: (data) => {
      const cur = cloudState.logs[date];
      if (cur?.activities) {
        const next = cur.activities.map((a) => (a.id === tempId ? data.activity : a));
        cloudState.logs = {
          ...cloudState.logs,
          [date]: { ...cur, activities: next },
        };
        refreshUI();
      }
    },
  });
}

export async function deleteSportActivity(
  date: string,
  activityId: string,
): Promise<void> {
  const log = getLogForDate(date);
  if (!log.activities?.length) return;
  const snapshot = cloudState.logs;
  const activities = log.activities.filter((a) => a.id !== activityId);
  cloudState.logs = {
    ...snapshot,
    [date]: { ...log, activities },
  };
  refreshUI();

  await runOptimistic({
    rollback: () => {
      cloudState.logs = snapshot;
      refreshUI();
    },
    request: () =>
      apiDelete(
        `/api/log-activities/${encodeURIComponent(activityId)}`,
        '運動記録の削除に失敗しました',
      ),
    errorLabel: '運動の削除に失敗しました',
    rethrow: true,
  });
}
