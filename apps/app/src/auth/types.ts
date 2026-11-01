/** What the auth provider needs from a Supabase-style identity backend. Implemented in `supabase.ts`. */
export interface AuthAdapter {
  /** Current access token, or null when signed out. */
  getAccessToken(): Promise<string | null>;
  /** Fires with the new access token (or null) whenever the session changes. Returns an unsubscribe. */
  onChange(cb: (token: string | null) => void): () => void;
  /** Refreshes the session; resolves with the new access token, or null when the session is gone. */
  refresh(): Promise<string | null>;
  signInWithGoogle(): Promise<void>;
  /** Emails a one-time code (6–10 digits, per the Supabase project setting) (creates the user when new). No magic link. */
  sendEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
}
