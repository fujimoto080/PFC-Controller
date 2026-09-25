'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import {
  authorizationResponseUrl,
  publicOrigin,
  stringParams,
} from '@/lib/oauth';
import {
  createAuthorizationCode,
  resolveAuthorizeRequest,
} from '@/lib/server/oauth';

/** 同意画面の送信。hidden の認可パラメータは改ざんされ得るため再検証する。 */
export async function submitConsent(formData: FormData): Promise<void> {
  const session = await auth();
  const userId = session?.user.id;
  if (!userId) throw new Error('ログインが必要です');

  const origin = publicOrigin(await headers());
  const params = stringParams(formData);
  const resolution = await resolveAuthorizeRequest(params, origin);
  if (resolution.type === 'invalid') throw new Error(resolution.message);
  if (resolution.type === 'redirect') redirect(resolution.url);

  const { request } = resolution;
  if (params.decision !== 'approve') {
    redirect(
      authorizationResponseUrl(request.redirectUri, origin, {
        error: 'access_denied',
        state: request.state,
      }),
    );
  }
  const code = await createAuthorizationCode(userId, request);
  redirect(
    authorizationResponseUrl(request.redirectUri, origin, {
      code,
      state: request.state,
    }),
  );
}
