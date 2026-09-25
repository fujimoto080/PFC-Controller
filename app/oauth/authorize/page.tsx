import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { PageTitle } from '@/components/ui/page-title';
import { publicOrigin, stringParams } from '@/lib/oauth';
import { resolveAuthorizeRequest } from '@/lib/server/oauth';
import { submitConsent } from './actions';

export const metadata = {
  title: '外部アプリの連携 | PFC Balance',
};

/** OAuth 認可エンドポイント兼同意画面。 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = stringParams(Object.entries(await searchParams));

  // 未ログインの利用者にクライアントのメタデータ取得を行わせないよう、先にログインを求める
  const session = await auth();
  if (!session?.user.id) {
    const self = `/oauth/authorize?${new URLSearchParams(params).toString()}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(self)}`);
  }

  const resolution = await resolveAuthorizeRequest(
    params,
    publicOrigin(await headers()),
  );
  if (resolution.type === 'redirect') redirect(resolution.url);
  if (resolution.type === 'invalid') {
    return (
      <div className="space-y-4 py-10 text-center">
        <PageTitle>連携できません</PageTitle>
        <p className="text-muted-foreground text-sm">{resolution.message}</p>
      </div>
    );
  }

  const { client, redirectUri } = resolution.request;
  return (
    <div className="space-y-6 py-10">
      <PageTitle>外部アプリの連携</PageTitle>
      <div className="space-y-2 text-sm leading-7">
        <p>
          <span className="font-semibold">{client.name}</span>（
          {new URL(redirectUri).host}）が、あなたの PFC Balance
          のデータの読み取りを求めています。
        </p>
        <p className="text-muted-foreground">
          許可すると、食事記録・目標 PFC・プロフィール・登録食品を {client.name}{' '}
          から読み取れるようになります。書き込みはできません。
        </p>
        <p className="text-muted-foreground">
          ログイン中のアカウント: {session.user.email}
        </p>
      </div>
      <form action={submitConsent} className="flex gap-3">
        {Object.entries(params)
          .filter(([name]) => name !== 'decision')
          .map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        <Button
          type="submit"
          name="decision"
          value="deny"
          variant="outline"
          className="flex-1"
        >
          拒否
        </Button>
        <Button
          type="submit"
          name="decision"
          value="approve"
          className="flex-1"
        >
          許可
        </Button>
      </form>
    </div>
  );
}
