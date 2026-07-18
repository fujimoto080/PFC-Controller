import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';
import withPWA from '@ducanh2912/next-pwa';

const baseConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

const hasNextPwa =
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_DISABLE_PWA !== 'true' &&
  existsSync(join(process.cwd(), 'node_modules', '@ducanh2912', 'next-pwa'));

const nextConfig: NextConfig = hasNextPwa
  ? withPWA({
      dest: 'public',
      disable: process.env.NODE_ENV !== 'production',
      register: true,
      // 既定の runtimeCaching は残しつつ、先頭に独自ルールを差し込む。
      extendDefaultRuntimeCaching: true,
      workboxOptions: {
        runtimeCaching: [
          {
            // ユーザーデータ系 API は常にサーバー最新を返す必要があるため
            // Service Worker ではキャッシュしない（既定の apis NetworkFirst を上書き）。
            // 追加したデータが古いキャッシュで「消えて見える」不具合を防ぐ。
            // オフライン時の表示は localStorage キャッシュ(lib/storage/state.ts)が担う。
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    })(baseConfig)
  : baseConfig;

export default nextConfig;
