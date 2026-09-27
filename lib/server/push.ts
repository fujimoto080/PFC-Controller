import 'server-only';

import webpush from 'web-push';
import { ApiError } from '@/lib/api/handler';
import { getPool } from '@/lib/server/db';

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Service Worker の push イベントに渡す内容。 */
export interface PushPayload {
  title: string;
  body: string;
  /** 通知をタップしたときに開くパス */
  url: string;
}

let configured = false;

function configureVapid() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new ApiError('VAPID キーが設定されていません', 500);
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    publicKey,
    privateKey,
  );
  configured = true;
}

export async function saveSubscription(
  userId: string,
  { endpoint, keys }: PushSubscriptionInput,
): Promise<void> {
  await getPool().query(
    `INSERT INTO pfc_push_subscriptions (endpoint, user_id, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [endpoint, userId, keys.p256dh, keys.auth],
  );
}

export async function deleteSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  await getPool().query(
    'DELETE FROM pfc_push_subscriptions WHERE user_id = $1 AND endpoint = $2',
    [userId, endpoint],
  );
}

/** 通知を購読しているユーザー ID の一覧。 */
export async function listSubscribedUserIds(): Promise<string[]> {
  const result = await getPool().query<{ user_id: string }>(
    'SELECT DISTINCT user_id FROM pfc_push_subscriptions',
  );
  return result.rows.map((row) => row.user_id);
}

/** ユーザーの全端末へ通知を送る。失効した購読（404/410）は削除する。 */
export async function sendPush(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  configureVapid();
  const result = await getPool().query<{
    endpoint: string;
    p256dh: string;
    auth: string;
  }>(
    'SELECT endpoint, p256dh, auth FROM pfc_push_subscriptions WHERE user_id = $1',
    [userId],
  );
  await Promise.all(
    result.rows.map(async ({ endpoint, p256dh, auth }) => {
      try {
        await webpush.sendNotification(
          { endpoint, keys: { p256dh, auth } },
          JSON.stringify(payload),
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await deleteSubscription(userId, endpoint);
          return;
        }
        console.error('push send failed:', error);
      }
    }),
  );
}
