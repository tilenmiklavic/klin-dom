import { useCallback, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBootstrap } from '../data/useBootstrap';

const KEY = 'klindom.currentHome';

let stored: string | null = null;
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  AsyncStorage.getItem(KEY).then(
    (value) => {
      if (value && stored === null) {
        stored = value;
        emit();
      }
    },
    () => undefined,
  );
}

/** The chosen home id, shared by every screen and persisted like the session token. */
export const currentHomeStore = {
  set(id: string) {
    hydrated = true;
    stored = id;
    emit();
    void AsyncStorage.setItem(KEY, id);
  },
  clear() {
    hydrated = true;
    stored = null;
    emit();
    void AsyncStorage.removeItem(KEY);
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCurrentHome(): { homeId: string | null; setHomeId(id: string): void } {
  hydrate();
  const id = useSyncExternalStore(subscribe, () => stored, () => null);
  const homes = useBootstrap().data?.homes;
  // A stored id the user no longer belongs to falls back to their first home.
  const valid = id && (!homes || homes.length === 0 || homes.some((h) => h.id === id));
  const setHomeId = useCallback((next: string) => currentHomeStore.set(next), []);
  return { homeId: valid ? id : (homes?.[0]?.id ?? null), setHomeId };
}
