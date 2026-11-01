import webpush from 'web-push';
import type { Config } from '../config.js';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export type SendResult = 'ok' | 'gone' | 'error';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface Notifier {
  send(sub: PushTarget, payload: PushPayload): Promise<SendResult>;
}

/** Sends run one after another under the jobs' advisory lock, so a push service that never answers must not hang them. */
export const PUSH_SEND_TIMEOUT_MS = 10_000;

/** Real delivery over Web Push (VAPID). 404/410 mean the subscription is gone, a timeout is an error; it never throws. */
export function webPushNotifier(vapid: { publicKey: string; privateKey: string; subject: string }): Notifier {
  const details = { vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey } };
  return {
    async send(sub, payload) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { ...details, TTL: 60 * 60 * 12, timeout: PUSH_SEND_TIMEOUT_MS },
        );
        return 'ok';
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        return status === 404 || status === 410 ? 'gone' : 'error';
      }
    },
  };
}

/** Web Push when VAPID is configured; otherwise a notifier that logs and reports every send as failed. */
export function notifierFromConfig(config: Pick<Config, 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY' | 'VAPID_SUBJECT'>): Notifier {
  if (config.VAPID_PUBLIC_KEY) {
    return webPushNotifier({ publicKey: config.VAPID_PUBLIC_KEY, privateKey: config.VAPID_PRIVATE_KEY!, subject: config.VAPID_SUBJECT! });
  }
  return {
    async send(sub) {
      console.warn(`Push not configured (no VAPID keys); dropping notification for ${sub.endpoint}`);
      return 'error';
    },
  };
}

/** For tests: records what was sent; `failWith` (keyed by endpoint) forces a result. */
export function memoryNotifier(): Notifier & {
  sent: { endpoint: string; payload: PushPayload }[];
  failWith: Map<string, SendResult>;
} {
  const sent: { endpoint: string; payload: PushPayload }[] = [];
  const failWith = new Map<string, SendResult>();
  return {
    sent,
    failWith,
    async send(sub, payload) {
      const forced = failWith.get(sub.endpoint);
      if (forced) return forced;
      sent.push({ endpoint: sub.endpoint, payload });
      return 'ok';
    },
  };
}
