import { useState, useEffect, useCallback } from 'react';
import { DailyLog, UserSettings, DEFAULT_TARGET, PFC } from '@/lib/types';
import { getLogForDate, getSettings, getPfcDebt, getTodayString } from '@/lib/storage';

export function usePfcData(selectedDate: string = getTodayString()) {
    const [log, setLog] = useState<DailyLog | null>(null);
    const [settings, setSettings] = useState<UserSettings>({ targetPFC: DEFAULT_TARGET });
    const [debt, setDebt] = useState<PFC>({ protein: 0, fat: 0, carbs: 0, calories: 0 });
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(() => {
        queueMicrotask(() => {
             setLog(getLogForDate(selectedDate));
             setSettings(getSettings());
             setDebt(getPfcDebt(selectedDate));
             setIsLoading(false);
        });
    }, [selectedDate]);

    useEffect(() => {
        refresh(); // Initial load
        
        const handleUpdate = () => refresh();
        window.addEventListener('pfc-update', handleUpdate);
        return () => window.removeEventListener('pfc-update', handleUpdate);
    }, [refresh]);

    return { log, settings, debt, isLoading, refresh };
}
