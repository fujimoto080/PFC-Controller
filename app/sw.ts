/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/turbopack/worker';
import {
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // ユーザーデータ系 API は常にサーバー最新を返す必要があるためキャッシュしない。
    // オフライン時の表示は localStorage キャッシュが担う。
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith('/api/'),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// 食事提案の通知。payload は lib/server/push.ts の PushPayload
self.addEventListener('push', (event) => {
  const payload = (event.data?.json() ?? {}) as {
    title?: string;
    body?: string;
    url?: string;
  };
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'PFC Balance', {
      body: payload.body,
      icon: '/icon.png',
      badge: '/icon.png',
      data: { url: payload.url ?? '/suggest' },
    }),
  );
});

// 通知タップで該当画面を開く。既に開いているウィンドウがあればそれを使う
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url } = event.notification.data as { url: string };
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const client = windows[0];
      if (client) {
        await client.navigate(url);
        await client.focus();
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
