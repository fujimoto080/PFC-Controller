import 'server-only';

import type { Account } from 'next-auth';
import { describeCalendarEvents, type CalendarEvent } from '@/lib/calendar';
import { getPool } from '@/lib/server/db';
import { shiftDate, toJstTimestamp } from '@/lib/utils';

// 食事提案に今日の予定を渡すための Google カレンダー連携。
// 通知の定期実行はセッション無しで動くため、連携時に得たリフレッシュトークンを accounts に保存して使う。

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

/** 設定画面の「連携する」で Google に追加で求める同意。オフラインアクセスでリフレッシュトークンを得る。 */
export const CALENDAR_AUTHORIZATION_PARAMS = {
  scope: `openid email profile ${CALENDAR_SCOPE}`,
  access_type: 'offline',
  prompt: 'consent',
  include_granted_scopes: 'true',
};

const hasCalendarScope = (scope: string | null | undefined) =>
  scope?.split(' ').includes(CALENDAR_SCOPE) ?? false;

/**
 * カレンダーの同意付きでサインインしたときにトークンを保存する。
 * Auth.js は既存アカウントの再サインインでは accounts を更新しないため自前で書き込む。
 */
export async function saveCalendarTokens(account: Account): Promise<void> {
  if (account.provider !== 'google' || !hasCalendarScope(account.scope)) {
    return;
  }
  await getPool().query(
    `UPDATE accounts SET
       access_token = $3, expires_at = $4, scope = $5,
       refresh_token = COALESCE($6, refresh_token)
     WHERE provider = $1 AND "providerAccountId" = $2`,
    [
      account.provider,
      account.providerAccountId,
      account.access_token,
      account.expires_at,
      account.scope,
      account.refresh_token,
    ],
  );
}

interface CalendarAccount {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
}

async function getCalendarAccount(
  userId: string,
): Promise<CalendarAccount | undefined> {
  const result = await getPool().query<CalendarAccount & { scope: string }>(
    `SELECT id, access_token, refresh_token, expires_at, scope FROM accounts
     WHERE "userId" = $1 AND provider = 'google' AND refresh_token IS NOT NULL`,
    [userId],
  );
  return result.rows.find((row) => hasCalendarScope(row.scope));
}

export async function isCalendarConnected(userId: string): Promise<boolean> {
  return (await getCalendarAccount(userId)) !== undefined;
}

/** 連携を解除する。Google 側の許可も取り消す。 */
export async function disconnectCalendar(userId: string): Promise<void> {
  const account = await getCalendarAccount(userId);
  if (!account?.refresh_token) return;
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    body: new URLSearchParams({ token: account.refresh_token }),
  }).catch((error: unknown) => {
    console.error('Google トークンの取り消しに失敗', error);
  });
  await getPool().query(
    `UPDATE accounts SET access_token = NULL, refresh_token = NULL, expires_at = NULL, scope = NULL
     WHERE id = $1`,
    [account.id],
  );
}

/** 有効なアクセストークン。期限が近ければリフレッシュトークンで取り直して保存する。 */
async function getAccessToken(account: CalendarAccount): Promise<string> {
  const expiresAtMs = Number(account.expires_at ?? 0) * 1000;
  if (account.access_token && expiresAtMs - Date.now() > 60_000) {
    return account.access_token;
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? '',
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? '',
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token ?? '',
    }),
  });
  if (!response.ok) {
    throw new Error(
      `トークンの更新に失敗: ${response.status} ${await response.text()}`,
    );
  }
  const token = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  await getPool().query(
    'UPDATE accounts SET access_token = $2, expires_at = $3 WHERE id = $1',
    [
      account.id,
      token.access_token,
      Math.floor(Date.now() / 1000) + token.expires_in,
    ],
  );
  return token.access_token;
}

/**
 * JST の date の予定を提案プロンプト用の箇条書きで返す。
 * 連携していない・取得に失敗した場合は undefined（提案自体は予定なしで続ける）。
 */
export async function getCalendarEventLines(
  userId: string,
  date: string,
): Promise<string[] | undefined> {
  const account = await getCalendarAccount(userId);
  if (!account) return undefined;
  try {
    const params = new URLSearchParams({
      timeMin: new Date(toJstTimestamp(date)).toISOString(),
      timeMax: new Date(toJstTimestamp(shiftDate(date, 1))).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      timeZone: 'Asia/Tokyo',
      maxResults: '50',
    });
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: { authorization: `Bearer ${await getAccessToken(account)}` },
      },
    );
    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}`);
    }
    const { items } = (await response.json()) as { items?: CalendarEvent[] };
    return describeCalendarEvents(items ?? [], Date.now());
  } catch (error) {
    console.error('Google カレンダーの取得に失敗', error);
    return undefined;
  }
}
