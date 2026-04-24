import { useEffect } from 'react';

export function useSubscribeToPfcUpdate(handler: () => void) {
  useEffect(() => {
    window.addEventListener('pfc-update', handler);
    return () => window.removeEventListener('pfc-update', handler);
  }, [handler]);
}
