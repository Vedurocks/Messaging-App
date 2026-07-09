// lib/push.ts
import 'server-only';
import webpush from 'web-push';
import { sql } from '@/lib/db';

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) {
    return false; // push not configured — callers should no-op, not throw
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

/** Sends a push notification to every subscription belonging to userId. Silently no-ops if VAPID isn't configured. Prunes subscriptions the push service reports as gone (410/404). */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  const subs = await sql`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}`;
  if (subs.rows.length === 0) return;

  const json = JSON.stringify(payload);

  await Promise.all(
    subs.rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          json
        );
      } catch (err: any) {
        // 404/410 means the browser/OS invalidated this subscription —
        // clean it up so we stop wasting sends on it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE id = ${sub.id}`;
        } else {
          console.error('Push send error:', err?.message || err);
        }
      }
    })
  );
}

/** Sends to multiple users at once (e.g. all other participants in a conversation). */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!ensureConfigured() || userIds.length === 0) return;
  await Promise.all(userIds.map((id) => sendPushToUser(id, payload)));
}
