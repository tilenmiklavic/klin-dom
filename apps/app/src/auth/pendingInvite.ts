import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'klindom.pendingInvite';

/** An invite code from `/join/[code]` that must survive sign-in. */
export const pendingInvite = {
  get: () => AsyncStorage.getItem(KEY),
  set: (code: string) => AsyncStorage.setItem(KEY, code),
  clear: () => AsyncStorage.removeItem(KEY),
};
