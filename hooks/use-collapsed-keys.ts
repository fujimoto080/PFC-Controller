'use client';

import { useEffect, useState } from 'react';
import { toggleItem } from '@/lib/utils';

function readKeys(storageKey: string): string[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? '[]',
    );
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** 折りたたみ中のセクションのキー一覧を localStorage に保持する。 */
export function useCollapsedKeys(storageKey: string) {
  const [collapsed, setCollapsed] = useState(() => readKeys(storageKey));

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(collapsed));
  }, [storageKey, collapsed]);

  return {
    isCollapsed: (key: string) => collapsed.includes(key),
    toggle: (key: string) => {
      setCollapsed((prev) => toggleItem(prev, key));
    },
  };
}
