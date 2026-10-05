import { NextResponse } from 'next/server';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { publicOrigin } from '@/lib/oauth';
import {
  KALORI_PENDING_COOKIE,
  completeKaloriAuthorization,
  parsePendingAuthorization,
} from '@/lib/server/kalori';

/** Kalori の認可画面から戻る先。認可コードをトークンに替えて保存し、設定画面へ戻す。 */
export const GET = defineRoute(
  { label: 'Kalori 連携', auth: true },
  async (request, { userId }) => {
    const params = request.nextUrl.searchParams;
    const error = params.get('error');
    if (error) throw new ApiError(`Kalori 連携が拒否されました: ${error}`, 400);

    const cookie = request.cookies.get(KALORI_PENDING_COOKIE)?.value;
    const code = params.get('code');
    const state = params.get('state');
    const iss = params.get('iss');
    if (!cookie || !code || !state || !iss) {
      throw new ApiError('Kalori 連携の応答が不正です', 400);
    }

    try {
      await completeKaloriAuthorization(
        userId,
        parsePendingAuthorization(cookie),
        { code, state, iss },
      );
    } catch (cause) {
      console.error('Kalori 連携に失敗', cause);
      throw new ApiError('Kalori 連携に失敗しました', 400);
    }

    const response = NextResponse.redirect(
      new URL('/settings', publicOrigin(request.headers)),
    );
    response.cookies.delete(KALORI_PENDING_COOKIE);
    return response;
  },
);
