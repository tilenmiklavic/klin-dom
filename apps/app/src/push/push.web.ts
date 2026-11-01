import type { ApiClient } from '@klindom/shared';
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
  const registration = () => nav()!.serviceWorker!.ready;

  async function state(): Promise<PushState> {
    if (needsInstall()) return 'needs-install';
    if (!supported()) return 'unsupported';
    const permission = env.Notification!.permission;
    if (permission === 'denied') return 'denied';
    if (permission !== 'granted') return 'off';
    const sub = await (await registration()).pushManager.getSubscription();
    return sub && storedId() ? 'on' : 'off';
  }

  async function enable(api: ApiClient): Promise<PushState> {
    // iOS only allows push from the installed app, so don't even ask in the browser tab.
    if (needsInstall()) return 'needs-install';
    if (!supported()) return 'unsupported';
    const { publicKey } = await api.pushPublicKey();
    if (!publicKey) return 'unsupported';
    const permission = await env.Notification!.requestPermission();
    if (permission === 'denied') return 'denied';
    if (permission !== 'granted') return 'off';
    const reg = await registration();
    const sub: PushSubscriptionLike =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Incomplete push subscription');
    const { id } = await api.subscribePush({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: nav()?.userAgent,
    });
    remember(id);
    return 'on';
  }

  async function disable(api: ApiClient): Promise<PushState> {
    if (!supported()) return state();
    const sub = await (await registration()).pushManager.getSubscription();
    const id = storedId();
    await sub?.unsubscribe();
    if (id) await api.unsubscribePush(id);
    remember(null);
    return state();
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
