'use client';

import { api } from '@/lib/client/api';
import type { GeoPoint } from '@/lib/types';

// ブラウザ（端末）の位置情報と Web Push 通知の操作。

/** 現在地を取得する。許可されない・取得できない場合は undefined。 */
export function getCurrentPosition(): Promise<GeoPoint | undefined> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(undefined);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({ lat: coords.latitude, lon: coords.longitude });
      },
      () => {
        resolve(undefined);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  });
}

/** 端末を短く振動させる。iOS Safari など非対応の端末では何もしない。 */
export function vibrate(ms: number): void {
  if ('vibrate' in navigator) navigator.vibrate(ms);
}

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function getRegistration() {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    throw new Error(
      '通知を使うにはアプリ（PWA）として開いてください。Service Worker が未登録です',
    );
  }
  return registration;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** 通知を許可してもらい、この端末の購読をサーバーへ登録する。 */
export async function subscribePush(): Promise<void> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error('VAPID 公開鍵が設定されていません');
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new Error('通知が許可されませんでした');
  }
  const registration = await getRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    }));
  await api.post('/api/push-subscriptions', subscription.toJSON());
}

export async function unsubscribePush(): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription) return;
  await api.delete('/api/push-subscriptions', {
    endpoint: subscription.endpoint,
  });
  await subscription.unsubscribe();
}
