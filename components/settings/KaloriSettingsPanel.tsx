import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { publicOrigin } from '@/lib/oauth';
import {
  KALORI_PENDING_COOKIE,
  beginKaloriAuthorization,
  disconnectKalori,
  isKaloriConnected,
} from '@/lib/server/kalori';

/** Kalori（kalori.jp）の商品カタログを使うための連携。 */
export async function KaloriSettingsPanel() {
  const session = await auth();
  if (!session?.user) return null;
  const connected = await isKaloriConnected(session.user.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kalori</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {connected
            ? '連携中。Kalori の商品カタログを参照できます。'
            : '連携すると、Kalori の商品カタログを参照できます。商品の参照のみで、Kalori の記録は変更しません。'}
        </p>
        <form
          action={async () => {
            'use server';
            const current = await auth();
            if (!current?.user) return;
            if (connected) {
              await disconnectKalori(current.user.id);
              revalidatePath('/settings');
              return;
            }
            const origin = publicOrigin(await headers());
            const { url, pending } = await beginKaloriAuthorization(origin);
            (await cookies()).set(
              KALORI_PENDING_COOKIE,
              JSON.stringify(pending),
              {
                httpOnly: true,
                secure: origin.startsWith('https:'),
                sameSite: 'lax',
                path: '/api/kalori',
                maxAge: 600,
              },
            );
            redirect(url);
          }}
        >
          <Button type="submit" variant="outline" className="w-full">
            {connected ? '連携を解除' : 'Kalori と連携'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
