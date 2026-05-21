'use client';

import { useEffect, useRef } from 'react';

// localStorage に入力中の値を自動保存し、再マウント時に復元するための汎用 hook。
// PWA や別タブ遷移でページが破棄されても入力途中のデータが消えないようにする目的で使う。
export function useFormDraft<T>(
  storageKey: string,
  value: T,
  applyDraft: (draft: T) => void,
  options?: { enabled?: boolean; debounceMs?: number },
) {
  const enabled = options?.enabled ?? true;
  const debounceMs = options?.debounceMs ?? 300;
  const hasRestoredRef = useRef(false);
  const applyDraftRef = useRef(applyDraft);

  useEffect(() => {
    applyDraftRef.current = applyDraft;
  }, [applyDraft]);

  // マウント直後に1度だけ下書きを読み込んで適用する
  useEffect(() => {
    if (!enabled || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as T;
      applyDraftRef.current(draft);
    } catch {
      // 破損していたら無視して削除する
      window.localStorage.removeItem(storageKey);
    }
  }, [enabled, storageKey]);

  // 入力値が変わるたびにデバウンスして保存する
  useEffect(() => {
    if (!enabled || !hasRestoredRef.current) return;
    if (typeof window === 'undefined') return;

    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
      } catch {
        // クォータ超過などは無視する
      }
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [enabled, storageKey, value, debounceMs]);
}

export function clearFormDraft(storageKey: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey);
}
