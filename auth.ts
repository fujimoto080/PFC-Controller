import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import PostgresAdapter from '@auth/pg-adapter';
import { getPool } from '@/lib/pg-pool';

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: PostgresAdapter(getPool()),
  providers: [Google],
  // JWT 方式にすることで、認証付きリクエストごとの sessions テーブル参照
  // (クロスリージョンDB往復) を無くす。サインイン時のみアダプタでユーザー/アカウントを永続化する。
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      // 初回サインイン時のみ user が渡る。DB のユーザー ID をトークンに焼き込む。
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === 'string') {
        session.user.id = token.id;
      }
      return session;
    },
  },
}));
