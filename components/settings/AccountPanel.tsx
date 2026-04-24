import { auth, signOut } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export async function AccountPanel() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>アカウント</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          {session.user.name && <p className="font-medium">{session.user.name}</p>}
          {session.user.email && (
            <p className="text-muted-foreground">{session.user.email}</p>
          )}
        </div>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}
        >
          <Button type="submit" variant="outline" className="w-full">
            ログアウト
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
