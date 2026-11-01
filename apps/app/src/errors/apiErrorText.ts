import type { TFunction } from 'i18next';
import { ApiError } from '@klindom/shared';

interface Options {
  /** i18n key used when the error is unknown (default `errors.generic`). */
  fallback?: string;
  /** The request was about an invite, so a missing resource means the invite is no longer valid. */
  invite?: boolean;
}

const KEYS: Record<string, string> = {
  network: 'errors.network',
  room_has_tasks: 'errors.roomHasTasks',
  transfer_required: 'errors.transferRequired',
  confirm_mismatch: 'errors.confirmMismatch',
  invalid_input: 'errors.invalidInput',
  invalid_assignee: 'errors.invalidInput',
  invalid_room: 'errors.invalidInput',
  forbidden: 'errors.forbidden',
  cannot_remove_self: 'errors.cannotRemoveSelf',
  not_latest: 'errors.notLatest',
};

/** Calm, translated copy for an API failure. The server's own message is never shown. */
export function apiErrorText(t: TFunction, error: unknown, options: Options = {}): string {
  if (error instanceof ApiError) {
    if (error.code === 'not_found' || error.code === 'invite_not_found') {
      return t(options.invite ? 'errors.inviteInvalid' : 'errors.notFound');
    }
    const key = KEYS[error.code];
    if (key) return t(key);
  }
  return t(options.fallback ?? 'errors.generic');
}
