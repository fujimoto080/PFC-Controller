'use client';

import { DailyLog, SportActivityLog, SportDefinition } from '../types';
import { cloudState, refreshUI, syncResource, toSportDefinition } from './state';
import { getLogForDate, saveLog } from './logs';
import { getSettings, saveSettings } from './settings';

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

  const logs = cloudState.logs;
  let changed = false;
  const nextLogs: Record<string, DailyLog> = {};

  Object.entries(logs).forEach(([date, log]) => {
    if (!log.activities?.length) {
      nextLogs[date] = log;
      return;
    }

    const nextActivities = log.activities.filter((activity) => activity.id !== id);
    if (nextActivities.length !== log.activities.length) {
      nextLogs[date] = { ...log, activities: nextActivities };
      changed = true;
    } else {
      nextLogs[date] = log;
    }
  });

  if (changed) {
    cloudState.logs = nextLogs;
    refreshUI();
    void syncResource('logs');
  }
}

export function addSportActivity(date: string, sport: SportDefinition) {
  const log = getLogForDate(date);
  const activities = log.activities || [];
  const activity: SportActivityLog = {
    ...toSportDefinition(sport),
    timestamp: Date.now(),
  };

  saveLog({ ...log, activities: [...activities, activity] });
}

export function deleteSportActivity(date: string, timestamp: number) {
  const log = getLogForDate(date);
  if (!log.activities?.length) return;

  saveLog({
    ...log,
    activities: log.activities.filter((activity) => activity.timestamp !== timestamp),
  });
}
