import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useApi } from '../data/api';
import { push, type PushState } from './push';

/** Unsubscribing must never hold up signing out (e.g. a service worker that never becomes ready). */
const FORGET_DEVICE_TIMEOUT_MS = 3000;

/** The push state of this device, with actions that keep it current. `state` is null while it is being read. */
export function usePush() {
  const api = useApi();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    push
      .state(api)
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setState('unsupported'));
    return () => {
      cancelled = true;
    };
  }, [api]);

  const run = useCallback(
    async (action: 'enable' | 'disable'): Promise<PushState | null> => {
      setBusy(true);
      setFailed(false);
      try {
        const next = await push[action](api);
        setState(next);
        return next;
      } catch {
        setFailed(true);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api],
  );

  return {
    state,
    busy,
    failed,
    enable: useCallback(() => run('enable'), [run]),
    disable: useCallback(() => run('disable'), [run]),
  };
}

/**
 * Best effort: unsubscribes this device so the next person to use it doesn't get the last one's reminders.
 * Never throws and gives up after a few seconds.
 */
export function useForgetDevicePush() {
  const api = useApi();
  return useCallback(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => (timer = setTimeout(resolve, FORGET_DEVICE_TIMEOUT_MS)));
    await Promise.race([push.disable(api).then(() => undefined, () => undefined), timeout]);
    clearTimeout(timer);
  }, [api]);
}

/**
 * Sign-out as the user triggers it: forget this device's push subscription, then end the session.
 * It lives here, not in AuthProvider, because the API client is built on top of auth (data/api imports it).
 */
export function useSignOut() {
  const { signOut } = useAuth();
  const forgetDevicePush = useForgetDevicePush();
  return useCallback(async () => {
    await forgetDevicePush();
    await signOut();
  }, [forgetDevicePush, signOut]);
}
