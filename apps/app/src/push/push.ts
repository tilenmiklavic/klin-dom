import type { ApiClient } from '@klindom/shared';

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

/** The browser surface push needs, injectable so tests can fake it. Every member may be absent. */
export interface PushEnv {
  navigator?: {
    userAgent?: string;
    maxTouchPoints?: number;
    standalone?: boolean;
    serviceWorker?: { ready: Promise<PushRegistration> };
  };
  /** The global `Notification`, if the browser has one. */
  Notification?: {
    permission: string;
    requestPermission(): Promise<string>;
  };
  /** True when the browser exposes `PushManager`. */
  hasPushManager?: boolean;
  matchMedia?: (query: string) => { matches: boolean };
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
}

export interface PushSubscriptionLike {
  toJSON(): { endpoint?: string; keys?: Record<string, string> };
  unsubscribe(): Promise<boolean>;
}

export interface PushRegistration {
  pushManager: {
    getSubscription(): Promise<PushSubscriptionLike | null>;
    subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }): Promise<PushSubscriptionLike>;
  };
}

export interface Push {
  state(): Promise<PushState>;
  /** Asks for permission, subscribes, registers the subscription with the API and remembers its id. */
  enable(api: ApiClient): Promise<PushState>;
  /** Unsubscribes this device and removes the subscription from the API. */
  disable(api: ApiClient): Promise<PushState>;
}

/** Native builds have no web push. */
export function createPush(_env: PushEnv): Push {
  const unsupported = async (): Promise<PushState> => 'unsupported';
  return { state: unsupported, enable: unsupported, disable: unsupported };
}

export const push: Push = createPush({});
