import type { ApiClient } from '@klindom/shared';
import { createPush } from '../src/push/push.web';
import type { PushEnv } from '../src/push/push';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

// base64url of bytes [251, 255, 254, 1]: exercises the - and _ alphabet and the missing padding.
const KEY = '-__-AQ';

function fakeEnv(over: { userAgent?: string; permission?: string; requested?: string; pushManager?: boolean; standalone?: boolean; stored?: string } = {}) {
  const store = new Map<string, string>();
  if (over.stored) store.set('klindom.pushSubscriptionId', over.stored);
  let current: ReturnType<typeof makeSub> | null = null;
  const makeSub = () => ({
    toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' } }),
    unsubscribe: jest.fn(async () => {
      current = null;
      return true;
    }),
  });
  const pushManager = {
    getSubscription: jest.fn(async () => current),
    subscribe: jest.fn(async (_options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => (current = makeSub())),
  };
  const Notification: { permission: string; requestPermission: jest.Mock<Promise<string>, []> } = {
    permission: over.permission ?? 'default',
    requestPermission: jest.fn(async (): Promise<string> => {
      Notification.permission = over.requested ?? 'granted';
      return Notification.permission;
    }),
  };
  const env: PushEnv = {
    navigator: {
      userAgent: over.userAgent ?? CHROME,
      maxTouchPoints: 0,
      standalone: over.standalone,
      serviceWorker: { ready: Promise.resolve({ pushManager }) },
    },
    Notification,
    hasPushManager: over.pushManager ?? true,
    matchMedia: () => ({ matches: false }),
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) },
  };
  return { env, pushManager, Notification, store };
}

const fakeApi = () =>
  ({
    pushPublicKey: jest.fn(async () => ({ publicKey: KEY as string | null })),
    subscribePush: jest.fn(async () => ({ id: 'sub-1' })),
    unsubscribePush: jest.fn(async () => undefined),
  }) as unknown as ApiClient & { pushPublicKey: jest.Mock; subscribePush: jest.Mock; unsubscribePush: jest.Mock };

describe('push', () => {
  it('no PushManager -> unsupported', async () => {
    const { env } = fakeEnv({ pushManager: false });
    expect(await createPush(env).state()).toBe('unsupported');
  });

  it('iOS Safari not standalone -> needs-install, and enable never calls requestPermission', async () => {
    const { env, Notification } = fakeEnv({ userAgent: IPHONE, pushManager: false });
    const p = createPush(env);
    expect(await p.state()).toBe('needs-install');
    expect(await p.enable(fakeApi())).toBe('needs-install');
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('iOS installed to the Home Screen is not asked to install', async () => {
    const { env } = fakeEnv({ userAgent: IPHONE, standalone: true });
    expect(await createPush(env).state()).toBe('off');
  });

  it('permission denied -> denied', async () => {
    const { env } = fakeEnv({ permission: 'denied' });
    expect(await createPush(env).state()).toBe('denied');
  });

  it('a null server key -> unsupported', async () => {
    const { env } = fakeEnv();
    const api = fakeApi();
    api.pushPublicKey.mockResolvedValue({ publicKey: null });
    expect(await createPush(env).enable(api)).toBe('unsupported');
  });

  it('enable subscribes with the server key and POSTs keys, then the state is on', async () => {
    const { env, pushManager, store } = fakeEnv();
    const api = fakeApi();
    const p = createPush(env);
    expect(await p.state()).toBe('off');
    expect(await p.enable(api)).toBe('on');
    const opts = pushManager.subscribe.mock.calls[0]![0];
    expect(opts.userVisibleOnly).toBe(true);
    expect(Array.from(opts.applicationServerKey)).toEqual([251, 255, 254, 1]);
    expect(api.subscribePush).toHaveBeenCalledWith({
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'P', auth: 'A' },
      userAgent: CHROME,
    });
    expect(store.get('klindom.pushSubscriptionId')).toBe('sub-1');
    expect(await p.state()).toBe('on');
  });

  it('enable reports denied when the user blocks the prompt', async () => {
    const { env } = fakeEnv({ requested: 'denied' });
    const api = fakeApi();
    expect(await createPush(env).enable(api)).toBe('denied');
    expect(api.subscribePush).not.toHaveBeenCalled();
  });

  it('granted without a subscription is off', async () => {
    const { env } = fakeEnv({ permission: 'granted', stored: 'sub-1' });
    expect(await createPush(env).state()).toBe('off');
  });

  it('disable unsubscribes and DELETEs the stored id', async () => {
    const { env, store } = fakeEnv();
    const api = fakeApi();
    const p = createPush(env);
    await p.enable(api);
    expect(await p.disable(api)).toBe('off');
    expect(api.unsubscribePush).toHaveBeenCalledWith('sub-1');
    expect(store.has('klindom.pushSubscriptionId')).toBe(false);
  });
});
