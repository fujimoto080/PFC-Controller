import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { NextConfig } from 'next';

const require = createRequire(import.meta.url);

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
  existsSync(join(process.cwd(), 'node_modules', 'next-pwa'));

const nextConfig: NextConfig = hasNextPwa
  ? require('next-pwa')({
      dest: 'public',
      disable: process.env.NODE_ENV !== 'production',
      register: true,
      skipWaiting: true,
    })(baseConfig)
  : baseConfig;

export default nextConfig;
