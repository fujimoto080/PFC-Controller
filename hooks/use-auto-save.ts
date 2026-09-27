'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 入力が止まってから保存するまでの待ち時間
const SAVE_DELAY_MS = 800;

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'invalid';

/**
 * value が変わったら、入力が止まってから save で自動保存する。
 * マウント時の値は保存済みとみなす。画面を離れる・閉じるときは待たずに保存する。
 * canSave が false の間（入力途中で不正な値など）は保存しない。戻り値は保存状態の表示用。
 */
export function useAutoSave<T>(
  value: T,
  save: (value: T) => Promise<boolean>,
  canSave = true,
): AutoSaveStatus {
  const serialized = JSON.stringify(value);
  const [savedSerialized, setSavedSerialized] = useState(serialized);
  const [inFlight, setInFlight] = useState(false);
  const [failed, setFailed] = useState(false);
  const [everSaved, setEverSaved] = useState(false);

  // タイマーやアンマウント時の保存からも最新の値・関数を使うため ref に持つ
  const latestRef = useRef({ value, serialized, save, canSave });
  const savedRef = useRef(serialized);
  useEffect(() => {
    latestRef.current = { value, serialized, save, canSave };
  });

  const flush = useCallback(() => {
    const {
      value: current,
      serialized: next,
      save: run,
      canSave: valid,
    } = latestRef.current;
    if (!valid || next === savedRef.current) return;
    savedRef.current = next;
    setInFlight(true);
    setFailed(false);
    void run(current).then((ok) => {
      setInFlight(false);
      if (ok) {
        setSavedSerialized(next);
        setEverSaved(true);
      } else {
        // 失敗した値は次の変更で改めて保存できるよう未保存に戻す
        savedRef.current = '';
        setFailed(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!canSave || serialized === savedRef.current) return;
    const timer = window.setTimeout(flush, SAVE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [serialized, canSave, flush]);

  // 画面遷移（アンマウント）やタブを閉じるときは待たずに保存する
  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  if (inFlight) return 'saving';
  if (failed) return 'error';
  if (serialized !== savedSerialized) return canSave ? 'saving' : 'invalid';
  return everSaved ? 'saved' : 'idle';
}
