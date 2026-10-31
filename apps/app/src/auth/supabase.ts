import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../config';
import type { AuthAdapter } from './types';

let client: SupabaseClient | undefined;

/** Created on first use so dev mode never needs Supabase credentials. */
function supabase(): SupabaseClient {
  if (!client) {
    const { supabaseUrl, supabaseAnonKey } = getConfig();
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }
  return client;
}

export const supabaseAuth: AuthAdapter = {
  async getAccessToken() {
    const { data } = await supabase().auth.getSession();
    return data.session?.access_token ?? null;
  },

  onChange(cb) {
    const { data } = supabase().auth.onAuthStateChange((_event, session) => cb(session?.access_token ?? null));
    return () => data.subscription.unsubscribe();
  },

  async refresh() {
    const { data, error } = await supabase().auth.refreshSession();
    return error ? null : (data.session?.access_token ?? null);
  },

  async signInWithGoogle() {
    const { error } = await supabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: Platform.OS === 'web' ? window.location.origin : undefined },
    });
    if (error) throw error;
  },

  async sendEmailCode(email) {
    const { error } = await supabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
  },

  async verifyEmailCode(email, code) {
    const { error } = await supabase().auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw error;
  },

  async signOut() {
    const { error } = await supabase().auth.signOut();
    if (error) throw error;
  },
};
