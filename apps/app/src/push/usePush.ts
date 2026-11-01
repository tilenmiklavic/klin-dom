import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../data/api';
import { push, type PushState } from './push';

/** The push state of this device, with actions that keep it current. `state` is null while it is being read. */
export function usePush() {
  const api = useApi();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    push
      .state()
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setState('unsupported'));
    return () => {
      cancelled = true;
    };
  }, []);

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
