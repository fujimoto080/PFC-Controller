'use client';

import { useCallback, useEffect, useRef } from 'react';

const SAVE_DEBOUNCE_MS = 300;

/**
 * 入力中の値を localStorage に自動保存し、マウント時に復元する。
 * PWA や別タブ遷移でページが破棄されても入力途中のデータが消えないようにする。
 * 戻り値は下書きを破棄する関数（保存待ちの書き込みも取り消す）。
 */
export function useFormDraft<T>(
  storageKey: string,
  value: T,
  applyDraft: (draft: T) => void,
  enabled: boolean,
): () => void {
  const hasRestoredRef = useRef(false);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const applyDraftRef = useRef(applyDraft);
  useEffect(() => {
    applyDraftRef.current = applyDraft;
  });

  useEffect(() => {
    if (!enabled || hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) applyDraftRef.current(JSON.parse(raw) as T);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!enabled || !hasRestoredRef.current) return;
    saveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch {
        // クォータ超過などは無視する
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(saveTimerRef.current);
    };
  }, [enabled, storageKey, value]);

  return useCallback(() => {
    window.clearTimeout(saveTimerRef.current);
    localStorage.removeItem(storageKey);
  }, [storageKey]);
}
