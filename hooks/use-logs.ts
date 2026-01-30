import { useState, useEffect, useCallback, useMemo } from 'react';
import { getLogs } from '@/lib/storage';

export function useAllLogs() {
    const [version, setVersion] = useState(0);

    const refresh = useCallback(() => {
        setVersion(v => v + 1);
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const logs = useMemo(() => getLogs(), [version]);

    useEffect(() => {
        const handleUpdate = () => refresh();
        window.addEventListener('pfc-update', handleUpdate);
        return () => window.removeEventListener('pfc-update', handleUpdate);
    }, [refresh]);

    return { logs, refresh };
}
