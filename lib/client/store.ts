'use client';

import { useSyncExternalStore } from 'react';
import { api } from '@/lib/client/api';
import { toast } from '@/lib/toast';
import type { UserData } from '@/lib/types';

/**
 * ログインユーザーのデータを保持するクライアントストア。
 * 状態は不変オブジェクトとして丸ごと差し替え、useSyncExternalStore で購読する。
 * 起動直後は localStorage のキャッシュで即時表示し、裏でサーバーから最新を取得する。
 */
export type AppState = UserData;

// localStorage のキャッシュ形式。AppState の形を変えたらインクリメントする。
const CACHE_KEY_PREFIX = 'pfc:cache:v4:';

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

function setState(updater: (current: AppState) => AppState) {
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

function selectUser(userId: string) {
  if (currentUserId === userId) return;
  currentUserId = userId;
  state = null;
}

/** キャッシュがあれば即座にストアへ反映する。 */
export function hydrateFromCache(userId: string) {
  selectUser(userId);
  if (state) return;
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + userId);
    if (raw) replaceState(JSON.parse(raw) as AppState);
  } catch {
    // 壊れたキャッシュは無視してサーバー取得を待つ
  }
}

export async function loadUserData(userId: string): Promise<boolean> {
  selectUser(userId);
  try {
    const data = await api.get<UserData>('/api/user-data');
    if (currentUserId !== userId) return false;
    replaceState(data);
    return true;
  } catch (error) {
    toast.fromError('ユーザーデータの読み込みに失敗しました', error);
    return false;
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
