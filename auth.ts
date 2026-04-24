import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import PostgresAdapter from '@auth/pg-adapter';
import type { Adapter } from 'next-auth/adapters';
import { getPool } from '@/lib/pg-pool';
import { ensureAuthSchema } from '@/lib/auth-schema';

function withAuthSchemaInit(adapter: Adapter): Adapter {
  const wrapped = {} as Adapter;
  for (const key of Object.keys(adapter) as (keyof Adapter)[]) {
    const original = adapter[key];
    if (typeof original !== 'function') continue;
    // @ts-expect-error dynamic wrap
    wrapped[key] = async (...args: unknown[]) => {
      await ensureAuthSchema();
      // @ts-expect-error dynamic wrap
      return original(...args);
    };
  }
  return wrapped;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: withAuthSchemaInit(PostgresAdapter(getPool())),
  providers: [Google],
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
}));
