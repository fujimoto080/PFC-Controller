'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { flushUsageEvents, trackUsage, usageNameOf } from '@/lib/client/usage';

/** 使われていない機能を見つけるため、画面表示とクリックした操作を記録する。 */
export function UsageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackUsage('page', pathname);
  }, [pathname]);

  useEffect(() => {
    const onClick = ({ target }: MouseEvent) => {
      if (!(target instanceof Element)) return;
      const name = usageNameOf(target);
      if (name) trackUsage('click', name);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushUsageEvents();
    };
    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}
