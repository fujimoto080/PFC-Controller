'use client';

import {
  SportActivityInput,
  SportActivityLog,
  SportDefinition,
} from '../types';
import { cloudState, readErrorMessage, refreshUI, toSportDefinition } from './state';
import { getLogForDate } from './logs';
import { getSettings, saveSettings } from './settings';
import { toast } from '../toast';

export function addSportDefinition(sport: SportDefinition) {
  const settings = getSettings();
  const sports = [...(settings.sports || [])];
  const normalized = toSportDefinition(sport);

  if (sports.some((item) => item.id === normalized.id)) return;

  sports.push(normalized);
  saveSettings({ ...settings, sports });
}

export function updateSportDefinition(updatedSport: SportDefinition) {
  const settings = getSettings();
  const sports = [...(settings.sports || [])];
  const index = sports.findIndex((item) => item.id === updatedSport.id);
  if (index === -1) return;

  sports[index] = toSportDefinition(updatedSport);
  saveSettings({ ...settings, sports });
}

export function deleteSportDefinition(id: string) {
  const settings = getSettings();
  const sports = (settings.sports || []).filter((sport) => sport.id !== id);
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

  try {
    const input: SportActivityInput = {
      sportId: sport.id,
      name: sport.name,
      caloriesBurned: sport.caloriesBurned,
      timestamp,
    };
    const res = await fetch('/api/log-activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, '運動記録の追加に失敗しました'));
    }
    const data = (await res.json()) as { activity: SportActivityLog; date: string };
    const cur = cloudState.logs[date];
    if (cur?.activities) {
      const next = cur.activities.map((a) => (a.id === tempId ? data.activity : a));
      cloudState.logs = {
        ...cloudState.logs,
        [date]: { ...cur, activities: next },
      };
      refreshUI();
    }
  } catch (error) {
    cloudState.logs = snapshot;
    refreshUI();
    toast.fromError('運動の追加に失敗しました', error);
    throw error;
  }
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

  try {
    const res = await fetch(
      `/api/log-activities/${encodeURIComponent(activityId)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, '運動記録の削除に失敗しました'));
    }
  } catch (error) {
    cloudState.logs = snapshot;
    refreshUI();
    toast.fromError('運動の削除に失敗しました', error);
    throw error;
  }
}
