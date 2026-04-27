import { useState, useCallback, useMemo } from 'react';
import { getLogs } from '@/lib/storage/logs';
import { useSubscribeToPfcUpdate } from './use-pfc-update';

export function useAllLogs() {
    const [version, setVersion] = useState(0);

    const refresh = useCallback(() => {
        setVersion(v => v + 1);
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const logs = useMemo(() => getLogs(), [version]);

    useSubscribeToPfcUpdate(refresh);

    return { logs, refresh };
}
