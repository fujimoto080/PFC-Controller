'use client';

import { useSyncExternalStore } from 'react';
import { api, HttpError } from '@/lib/client/api';
import { toast } from '@/lib/toast';
import type { AppData, UserDataResponse } from '@/lib/types';

/**
 * ログインユーザーのデータを保持するクライアントストア。
 * 状態は不変オブジェクトとして丸ごと差し替え、useSyncExternalStore で購読する。
 * 起動直後は localStorage のキャッシュで即時表示し、裏でサーバーから最新を取得する。
 */
export type AppState = AppData;

// localStorage のキャッシュ形式。AppState の形を変えたらインクリメントする。
const CACHE_KEY_PREFIX = 'pfc:cache:v6:';

let state: AppState | null = null;
let currentUserId: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => null;

function writeCache() {
  if (!currentUserId || !state) return;
  try {
    localStorage.setItem(
      CACHE_KEY_PREFIX + currentUserId,
      JSON.stringify(state),
    );
  } catch {
    // 容量超過などは無視
  }
}

function replaceState(next: AppState) {
  state = next;
  writeCache();
  for (const listener of listeners) listener();
}

export function getState(): AppState {
  if (!state) throw new Error('ユーザーデータが未読み込みです');
  return state;
}

export function setState(updater: (current: AppState) => AppState) {
  replaceState(updater(getState()));
}

/** 読み込み前は null。CloudDataProvider がロード完了まで子を描画しないため、画面側は useAppState を使う。 */
export function useStoreSnapshot(): AppState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useAppState(): AppState {
  const snapshot = useStoreSnapshot();
  if (!snapshot) throw new Error('ユーザーデータが未読み込みです');
  return snapshot;
}

/** 最後にデータを取得できたユーザー。起動直後にどのキャッシュを表示するかに使う。 */
const LAST_USER_KEY = 'pfc:last-user';

/** 前回のユーザーのキャッシュがあれば即座にストアへ反映する。 */
export function hydrateFromCache() {
  if (state) return;
  try {
    const userId = localStorage.getItem(LAST_USER_KEY);
    const raw = userId && localStorage.getItem(CACHE_KEY_PREFIX + userId);
    if (!raw) return;
    currentUserId = userId;
    replaceState(JSON.parse(raw) as AppState);
  } catch {
    // 壊れたキャッシュは無視してサーバー取得を待つ
  }
}

function clearUser() {
  currentUserId = null;
  state = null;
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // 削除できなくても次回の取得で正しいユーザーに切り替わる
  }
  for (const listener of listeners) listener();
}

export type LoadResult = 'ok' | 'unauthenticated' | 'failed';

/** サーバーから最新を取得する。未ログインならキャッシュの表示もやめる。 */
export async function loadUserData(): Promise<LoadResult> {
  try {
    const { userId, data } = await api.get<UserDataResponse>('/api/user-data');
    currentUserId = userId;
    try {
      localStorage.setItem(LAST_USER_KEY, userId);
    } catch {
      // 保存できなくても次回はサーバー取得を待つだけ
    }
    replaceState(data);
    return 'ok';
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      clearUser();
      return 'unauthenticated';
    }
    toast.fromError('ユーザーデータの読み込みに失敗しました', error);
    return 'failed';
  }
}

/**
 * 楽観的更新の定型。apply で即座に状態を更新してから request を送り、
 * 失敗したら更新前の状態へ戻してエラートーストを出す。成功したかどうかを返す。
 */
export async function optimistic<T>(params: {
  apply: (current: AppState) => AppState;
  request: () => Promise<T>;
  errorMessage: string;
  onSuccess?: (current: AppState, result: T) => AppState;
}): Promise<boolean> {
  const { apply, request, errorMessage, onSuccess } = params;
  const snapshot = getState();
  replaceState(apply(snapshot));
  try {
    const result = await request();
    if (onSuccess) setState((current) => onSuccess(current, result));
    return true;
  } catch (error) {
    replaceState(snapshot);
    toast.fromError(errorMessage, error);
    return false;
  }
}
