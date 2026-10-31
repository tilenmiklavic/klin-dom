export type AuthMode = 'supabase' | 'dev';

export interface AppConfig {
  apiUrl: string;
  authMode: AuthMode;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/** Read lazily so tests can swap it. Expo inlines `process.env.EXPO_PUBLIC_*` only for literal accesses. */
export function getConfig(): AppConfig {
  return {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080',
    authMode: process.env.EXPO_PUBLIC_AUTH_MODE === 'dev' ? 'dev' : 'supabase',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  };
}
