import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiClient } from '@klindom/shared';
import { getConfig } from '../config';

const TOKEN_KEY = 'klindom.devToken';

export const devTokenStore = {
  get: () => AsyncStorage.getItem(TOKEN_KEY),
  set: (token: string) => AsyncStorage.setItem(TOKEN_KEY, token),
  clear: () => AsyncStorage.removeItem(TOKEN_KEY),
};

export function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'dev'
  );
}

/** Mints and stores a dev token via `POST /dev/token` (API must run with AUTH_MODE=dev). */
export async function signInDev(name: string): Promise<string> {
  const api = createApiClient({ baseUrl: getConfig().apiUrl, getToken: async () => null });
  const { token } = await api.devToken({ sub: `dev:${slug(name)}`, name: name.trim() || undefined });
  await devTokenStore.set(token);
  return token;
}
