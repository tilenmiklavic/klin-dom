import { ApiError, type ApiClient } from '@klindom/shared';
import type { Push, PushEnv, PushState, PushSubscriptionLike } from './push';

export type { Push, PushEnv, PushState } from './push';

const STORAGE_KEY = 'klindom.pushSubscriptionId';

/** The VAPID public key arrives as base64url; `subscribe` wants the raw bytes. */
function urlBase64ToUint8Array(value: string): Uint8Array {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function createPush(env: PushEnv): Push {
  const nav = () => env.navigator;
  const isIos = () => {
    const ua = nav()?.userAgent ?? '';
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav()?.maxTouchPoints ?? 0) > 1);
  };
  const standalone = () => nav()?.standalone === true || env.matchMedia?.('(display-mode: standalone)').matches === true;
  const needsInstall = () => isIos() && !standalone();
  const supported = () => Boolean(nav()?.serviceWorker && env.hasPushManager && env.Notification);
  const storedId = () => {
    try {
      return env.storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  };
  const remember = (id: string | null) => {
    try {
      if (id) env.storage?.setItem(STORAGE_KEY, id);
      else env.storage?.removeItem(STORAGE_KEY);
    } catch {
      // storage can be blocked; the subscription still works, the screen just reads "off" next time
    }
  };
  // The server key is fetched ahead of the tap (in state) so enable can ask for permission
  // straight away: Safari/iOS drop the prompt if a network round-trip comes first.
  let cachedKey: string | null | undefined;
  const subscribeBody = (sub: PushSubscriptionLike) => {
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Incomplete push subscription');
    return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, userAgent: nav()?.userAgent };
  };
  const registration = () => nav()!.serviceWorker!.ready;

  async function state(api: ApiClient): Promise<PushState> {
    if (needsInstall()) return 'needs-install';
    if (!supported()) return 'unsupported';
    const permission = env.Notification!.permission;
    if (permission === 'denied') return 'denied';
    if (permission !== 'granted') {
      api
        .pushPublicKey()
        .then((r) => (cachedKey = r.publicKey))
        .catch(() => undefined);
      return 'off';
    }
    const sub = await (await registration()).pushManager.getSubscription();
    if (!sub) return 'off';
    // The subscription belongs to the browser, not the account: re-register it so it follows whoever is signed in.
    try {
      remember((await api.subscribePush(subscribeBody(sub))).id);
      return 'on';
    } catch {
      return 'off';
    }
  }

  async function enable(api: ApiClient): Promise<PushState> {
    // iOS only allows push from the installed app, so don't even ask in the browser tab.
    if (needsInstall()) return 'needs-install';
    if (!supported()) return 'unsupported';
    if (cachedKey === null) return 'unsupported';
    // No await before this: it must run inside the user's tap.
    const permission = await env.Notification!.requestPermission();
    if (permission === 'denied') return 'denied';
    if (permission !== 'granted') return 'off';
    if (cachedKey === undefined) cachedKey = (await api.pushPublicKey()).publicKey;
    const publicKey = cachedKey;
    if (!publicKey) return 'unsupported';
    const reg = await registration();
    const sub: PushSubscriptionLike =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    const { id } = await api.subscribePush(subscribeBody(sub));
    remember(id);
    return 'on';
  }

  async function disable(api: ApiClient): Promise<PushState> {
    if (!supported()) return 'unsupported';
    const sub = await (await registration()).pushManager.getSubscription();
    const id = storedId();
    await sub?.unsubscribe();
    remember(null);
    if (id) {
      try {
        await api.unsubscribePush(id);
      } catch (e) {
        // Already gone on the server (e.g. it belonged to another account): nothing left to remove.
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
    }
    return 'off';
  }

  return { state, enable, disable };
}

/** Bound to the real browser. Members are read lazily so it is safe to import during static rendering. */
const browserEnv: PushEnv = {
  get navigator() {
    return typeof navigator === 'undefined' ? undefined : (navigator as unknown as PushEnv['navigator']);
  },
  get Notification() {
    return typeof Notification === 'undefined' ? undefined : Notification;
  },
  get hasPushManager() {
    return typeof window !== 'undefined' && 'PushManager' in window;
  },
  get matchMedia() {
    return typeof window === 'undefined' ? undefined : window.matchMedia.bind(window);
  },
  get storage() {
    try {
      return typeof localStorage === 'undefined' ? undefined : localStorage;
    } catch {
      return undefined;
    }
  },
};

export const push: Push = createPush(browserEnv);
