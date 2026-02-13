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
    })(baseConfig)
  : baseConfig;

export default nextConfig;
