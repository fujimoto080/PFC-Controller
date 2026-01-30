import { useState, useEffect, useCallback, useMemo } from 'react';
import { getLogForDate, getSettings, getPfcDebt, getTodayString } from '@/lib/storage';

export function usePfcData(selectedDate: string = getTodayString()) {
    const [version, setVersion] = useState(0);

    const refresh = useCallback(() => {
        setVersion(v => v + 1);
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const log = useMemo(() => getLogForDate(selectedDate), [selectedDate, version]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const settings = useMemo(() => getSettings(), [version]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debt = useMemo(() => getPfcDebt(selectedDate), [selectedDate, version]);

    useEffect(() => {
        const handleUpdate = () => refresh();
        window.addEventListener('pfc-update', handleUpdate);
        return () => window.removeEventListener('pfc-update', handleUpdate);
    }, [refresh]);

    return { log, settings, debt, isLoading: false, refresh };
}
