import { revalidatePath } from 'next/cache';
import { auth, signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CALENDAR_AUTHORIZATION_PARAMS,
  disconnectCalendar,
  isCalendarConnected,
} from '@/lib/server/google-calendar';

/** 食事提案に今日の予定を渡すための Google カレンダー連携。 */
export async function CalendarSettingsPanel() {
  const session = await auth();
  if (!session?.user) return null;
  const connected = await isCalendarConnected(session.user.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google カレンダー</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {connected
            ? '連携中。提案で今日の予定を考慮します。'
            : '連携すると、提案で今日の予定を考慮します（読み取りのみ）。'}
        </p>
        <form
          action={async () => {
            'use server';
            if (connected) {
              const current = await auth();
              if (current?.user) await disconnectCalendar(current.user.id);
              revalidatePath('/settings');
            } else {
              await signIn(
                'google',
                { redirectTo: '/settings' },
                CALENDAR_AUTHORIZATION_PARAMS,
              );
            }
          }}
        >
          <Button type="submit" variant="outline" className="w-full">
            {connected ? '連携を解除' : 'Google カレンダーと連携'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
