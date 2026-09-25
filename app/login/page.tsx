import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { Button } from '@/components/ui/button';

/** オープンリダイレクトを防ぐため、同一オリジンのパスだけを戻り先として受け付ける。 */
function safeCallbackUrl(value: string | string[] | undefined): string {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl);
  const session = await auth();
  if (session?.user.id) {
    redirect(callbackUrl);
  }

  return (
    <div className="flex flex-col items-center space-y-6 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">PFC Balance</h1>
        <p className="text-muted-foreground text-sm">
          Google アカウントでログインしてデータを同期します。
        </p>
      </div>
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: callbackUrl });
        }}
      >
        <Button type="submit" size="lg">
          Google でログイン
        </Button>
      </form>
    </div>
  );
}
