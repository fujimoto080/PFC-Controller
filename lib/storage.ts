'use client';

export {
  isCloudDataLoaded,
  loadCloudData,
  refreshUI,
} from './storage/state';

export {
  addFoodItem,
  deleteLogItem,
  getAdjustedCalorieTarget,
  getAllLogItems,
  getBalancedWeeklyTargets,
  getLogForDate,
  getLogs,
  getPfcDebt,
  getTodayString,
  getWeeklyLog,
  updateLogItem,
} from './storage/logs';

export { getSettings, saveSettings } from './storage/settings';

export {
  addSportActivity,
  addSportDefinition,
  deleteSportActivity,
  deleteSportDefinition,
  updateSportDefinition,
} from './storage/sports';

export {
  addFoodToDictionary,
  deleteFoodFromDictionary,
  getFoodDictionary,
  getUniqueStores,
  saveFoodDictionary,
  updateFoodInDictionary,
} from './storage/foods';

export {
  getFavoriteFoods,
  isFavoriteFood,
  toggleFavoriteFood,
} from './storage/favorites';
