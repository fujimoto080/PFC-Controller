import { useState, useCallback, useMemo } from 'react';
import { getLogForDate, getSettings, getPfcDebt, getTodayString } from '@/lib/storage';
import { useSubscribeToPfcUpdate } from './use-pfc-update';

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

    useSubscribeToPfcUpdate(refresh);

    return { log, settings, debt, refresh };
}
