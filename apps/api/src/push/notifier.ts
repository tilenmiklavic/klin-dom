import webpush from 'web-push';

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

/** Real delivery over Web Push (VAPID). 404/410 mean the subscription is gone; it never throws. */
export function webPushNotifier(vapid: { publicKey: string; privateKey: string; subject: string }): Notifier {
  const details = { vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey } };
  return {
    async send(sub, payload) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { ...details, TTL: 60 * 60 * 12 },
        );
        return 'ok';
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        return status === 404 || status === 410 ? 'gone' : 'error';
      }
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
