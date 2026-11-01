import { ApiError } from '@klindom/shared';
import i18n from '../src/i18n';
import { apiErrorText } from '../src/errors/apiErrorText';

const t = i18n.t.bind(i18n);

describe('apiErrorText', () => {
  it('never shows the server message', () => {
    const text = apiErrorText(t, new ApiError(500, 'weird', 'SELECT * FROM secrets'));
    expect(text).toBe('Something went wrong. Please try again.');
  });

  it('explains a network failure', () => {
    expect(apiErrorText(t, new ApiError(0, 'network', 'Failed to fetch'))).toBe('Couldn’t reach KlinDom. Check your connection and try again.');
  });

  it('maps known codes to calm copy', () => {
    const e = (code: string) => new ApiError(409, code, 'raw');
    expect(apiErrorText(t, e('room_has_tasks'))).toBe('Move or archive its tasks first');
    expect(apiErrorText(t, e('transfer_required'))).toBe('Hand the home over to someone before leaving');
    expect(apiErrorText(t, e('confirm_mismatch'))).toBe('That name doesn’t match. Check it and try again.');
    expect(apiErrorText(t, e('forbidden'))).toBe('Only the owner can do that.');
    expect(apiErrorText(t, e('invalid_input'))).toBe('Check what you entered and try again.');
  });

  it('treats not_found as an invalid invite only for invites', () => {
    const nf = new ApiError(404, 'not_found', 'Invite xyz not found');
    expect(apiErrorText(t, nf, { invite: true })).toBe('This invite is no longer valid');
    expect(apiErrorText(t, nf)).toBe('Couldn’t find that. It may have been removed.');
  });

  it('uses the caller fallback for unknown codes and non-API errors', () => {
    expect(apiErrorText(t, new Error('boom'), { fallback: 'errors.saveFailed' })).toBe('Couldn’t save that — try again');
    expect(apiErrorText(t, undefined)).toBe('Something went wrong. Please try again.');
  });
});
