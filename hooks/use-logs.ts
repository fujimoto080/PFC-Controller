import { useState, useEffect, useCallback } from 'react';
import { DailyLog } from '@/lib/types';
import { getLogs } from '@/lib/storage';

export function useAllLogs() {
    const [logs, setLogs] = useState<Record<string, DailyLog>>({});

    const refresh = useCallback(() => {
        queueMicrotask(() => {
            setLogs(getLogs());
        });
    }, []);

    useEffect(() => {
        refresh();
        const handleUpdate = () => refresh();
        window.addEventListener('pfc-update', handleUpdate);
        return () => window.removeEventListener('pfc-update', handleUpdate);
    }, [refresh]);

    return { logs, refresh };
}
