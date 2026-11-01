import path from 'node:path';
import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

const mockConfig = { apiUrl: 'http://api.test', authMode: 'supabase' as const };
jest.mock('../src/config', () => ({ getConfig: () => mockConfig }));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: () => [true, null] }));
jest.mock('@expo-google-fonts/geist/400Regular', () => ({ Geist_400Regular: 1 }));
jest.mock('@expo-google-fonts/geist/500Medium', () => ({ Geist_500Medium: 2 }));
jest.mock('@expo-google-fonts/geist/600SemiBold', () => ({ Geist_600SemiBold: 3 }));

jest.mock('../src/auth/supabase', () => ({
  supabaseAuth: {
    getAccessToken: async () => 'tok',
    onChange: () => () => undefined,
    refresh: async () => null,
    signOut: () => mockSupabaseSignOut(),
  },
}));

const mockSupabaseSignOut = jest.fn(async () => {});
let mockClient: import('@tanstack/react-query').QueryClient;
jest.mock('../src/data/queryClient', () => {
  const actual = jest.requireActual('../src/data/queryClient');
  return { ...actual, createQueryClient: () => (mockClient = actual.createQueryClient()) };
});

import * as Clipboard from 'expo-clipboard';
import { currentHomeStore } from '../src/state/currentHome';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });


let role: 'owner' | 'member';
const INVITE = { id: 'i1', code: 'k7q2mx', url: 'https://klindom.app/join/k7q2mx', createdAt: '', createdBy: 'u1' };
let invitesList: unknown[];
let createInviteResponse: () => Promise<Response>;
let leaveResponse: () => Response;
let removeResponse: () => Response;
let deleteMeResponse: () => Response;
let deleteHomeResponse: () => Response;

const STATS = (n: number) => ({
  from: '2026-10-26',
  to: '2026-11-01',
  total: n * 7,
  perMember: [
    { userId: 'u1', name: 'Tilen', done: n * 5, onTime: n * 4 },
    { userId: 'u2', name: 'Ana', done: n * 2, onTime: n * 2 },
  ],
  perRoom: [],
  doneForOthers: [],
  perDay: [],
});

const defaultFetch = async (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  if (url.endsWith('/me/bootstrap')) {
    return json(200, { user: { id: 'u1', displayName: 'Tilen', email: null }, homes: [{ id: 'h1', name: 'Maple', role }] });
  }
  if (url.endsWith('/homes/h1') && method === 'GET') return json(200, { id: 'h1', name: 'Maple', timezone: 'Europe/Ljubljana', ownerId: 'u1', role });
  if (url.endsWith('/homes/h1') && method === 'DELETE') return deleteHomeResponse();
  if (url.endsWith('/homes/h1') && method === 'PATCH') return json(200, { id: 'h1', name: 'Oak', timezone: 'Europe/Ljubljana', ownerId: 'u1', role });
  if (url.endsWith('/homes/h1/members'))
    return json(200, [
      { userId: 'u1', displayName: 'Tilen', avatarUrl: null, role: 'owner', joinedAt: '' },
      { userId: 'u2', displayName: 'Ana', avatarUrl: null, role: 'member', joinedAt: '' },
    ]);
  if (/\/homes\/h1\/members\/u2$/.test(url) && method === 'DELETE') return removeResponse();
  if (url.endsWith('/homes/h1/transfer')) return json(200, { id: 'h1', name: 'Maple', timezone: 'Europe/Ljubljana', ownerId: 'u2', role });
  if (url.endsWith('/homes/h1/leave')) return leaveResponse();
  if (url.endsWith('/homes/h1/invites') && method === 'GET') return json(200, invitesList);
  if (url.endsWith('/homes/h1/invites') && method === 'POST') return createInviteResponse();
  if (/\/invites\/i1$/.test(url) && method === 'DELETE') return new Response(null, { status: 204 });
  if (url.endsWith('/homes/h1/members/me')) return json(200, { notificationsEnabled: true, defaultReminderTime: '08:00' });
  if (url.includes('/homes/h1/stats')) return json(200, STATS(new URL(url).searchParams.get('range') === 'month' ? 4 : 1));
  if (url.endsWith('/me') && method === 'PATCH') return json(200, { id: 'u1', displayName: 'Til', email: null });
  if (url.endsWith('/me') && method === 'DELETE') return deleteMeResponse();
  return json(404, { error: { code: 'not_found', message: 'nope' } });
};
const fetchMock = jest.fn(defaultFetch);
const calls = (re: RegExp, method?: string) =>
  fetchMock.mock.calls.filter(([u, i]) => re.test(u) && (!method || (i?.method ?? 'GET') === method));
const body = (c: ReturnType<typeof calls>[number]) => JSON.parse(c[1]!.body as string);

const APP = path.resolve(__dirname, '../app');
let app: ReturnType<typeof renderRouter>;
const renderAt = async (initialUrl: string) => {
  app = renderRouter(APP, { initialUrl });
  await app;
};
const press = async (name: string) => fireEvent.press(await screen.findByRole('button', { name }));
const inSheet = async (name: string) => fireEvent.press(within(await screen.findByTestId('sheet-panel')).getByRole('button', { name }));

beforeEach(async () => {
  await AsyncStorage.clear();
  currentHomeStore.clear();
  jest.clearAllMocks();
  role = 'owner';
  invitesList = [INVITE];
  createInviteResponse = async () => json(201, { ...INVITE, id: 'i2', code: 'n3w1nv', url: 'https://klindom.app/join/n3w1nv' });
  leaveResponse = () => json(200, { homeDeleted: false });
  removeResponse = () => new Response(null, { status: 204 });
  deleteMeResponse = () => new Response(null, { status: 204 });
  deleteHomeResponse = () => new Response(null, { status: 204 });
  fetchMock.mockImplementation(defaultFetch);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('profile', () => {
  it('shows the home and role, the week stats, and switches to month', async () => {
    await renderAt('/profile');
    await screen.findByText('Maple · owner');
    await screen.findByText('5 done');
    expect(screen.getByText('2 done')).toBeTruthy();
    expect(calls(/\/stats\?.*range=week/)).toHaveLength(1);
    await fireEvent.press(screen.getByRole('tab', { name: 'Month' }));
    await screen.findByText('20 done');
    expect(screen.getByText('8 done')).toBeTruthy();
    expect(calls(/\/stats\?.*range=month/)).toHaveLength(1);
  });

  it('shows whether Notifications are on and navigates to members', async () => {
    await renderAt('/profile');
    await screen.findByText('On');
    await press('Members');
    await waitFor(() => expect(app.getPathname()).toBe('/profile/members'));
  });
});

describe('invite someone', () => {
  const sheet = async () => within(await screen.findByTestId('sheet-panel'));

  it('reuses an active invite and shares it synchronously on the second tap', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await renderAt('/profile');
    await press('Invite someone');
    const panel = await sheet();
    await panel.findByText('k7q2mx');
    expect(panel.getByText('https://klindom.app/join/k7q2mx')).toBeTruthy();
    expect(calls(/\/homes\/h1\/invites$/, 'POST')).toHaveLength(0);
    // The share must start inside the press itself, before anything is awaited.
    fireEvent.press(panel.getByRole('button', { name: 'Share invite' }));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0]![0]).toMatchObject({ url: 'https://klindom.app/join/k7q2mx' });
  });

  it('creates one invite when there is no active one, even when tapped twice while it is pending', async () => {
    invitesList = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    createInviteResponse = async () => {
      await gate;
      return json(201, { ...INVITE, id: 'i2', code: 'n3w1nv', url: 'https://klindom.app/join/n3w1nv' });
    };
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await renderAt('/profile');
    await screen.findByText('On');
    const row = await screen.findByRole('button', { name: 'Invite someone' });
    await fireEvent.press(row);
    await fireEvent.press(row);
    await waitFor(() => expect(calls(/\/homes\/h1\/invites$/, 'POST')).toHaveLength(1));
    await act(async () => release());
    const panel = await sheet();
    await panel.findByText('n3w1nv');
    expect(calls(/\/homes\/h1\/invites$/, 'POST')).toHaveLength(1);
    fireEvent.press(panel.getByRole('button', { name: 'Share invite' }));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0]![0]).toMatchObject({ url: 'https://klindom.app/join/n3w1nv' });
  });

  it('copies the link as a fallback and says so inside the sheet', async () => {
    await renderAt('/profile');
    await press('Invite someone');
    const panel = await sheet();
    await fireEvent.press(await panel.findByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://klindom.app/join/k7q2mx'));
    expect((await sheet()).getByText('Invite link copied')).toBeTruthy();
  });

  it('closes the sheet and says so when the invite cannot be created', async () => {
    invitesList = [];
    createInviteResponse = async () => json(403, { error: { code: 'forbidden', message: 'x' } });
    await renderAt('/profile');
    await press('Invite someone');
    await screen.findByText('Couldn’t create an invite — try again');
    expect(screen.queryByTestId('sheet-panel')).toBeNull();
  });
});

describe('members', () => {
  it('lets the owner hand the home over after confirming', async () => {
    await renderAt('/profile/members');
    const row = await screen.findByTestId('member-row-u2');
    expect(within(await screen.findByTestId('member-row-u1')).queryByRole('button', { name: 'Remove' })).toBeNull();
    await fireEvent.press(within(row).getByRole('button', { name: 'Make owner' }));
    expect(calls(/\/transfer$/, 'POST')).toHaveLength(0);
    await inSheet('Make owner');
    await waitFor(() => expect(calls(/\/homes\/h1\/transfer$/, 'POST')).toHaveLength(1));
    expect(body(calls(/\/transfer$/, 'POST')[0]!)).toEqual({ userId: 'u2' });
    await screen.findByText('Ana is now the owner');
  });

  it('lets the owner remove a member after confirming', async () => {
    await renderAt('/profile/members');
    await fireEvent.press(within(await screen.findByTestId('member-row-u2')).getByRole('button', { name: 'Remove' }));
    expect(calls(/\/members\/u2$/, 'DELETE')).toHaveLength(0);
    await inSheet('Remove');
    await waitFor(() => expect(calls(/\/members\/u2$/, 'DELETE')).toHaveLength(1));
    await screen.findByText('Ana removed');
  });

  it('hides owner actions from members', async () => {
    role = 'member';
    await renderAt('/profile/members');
    await screen.findByTestId('member-row-u2');
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make owner' })).toBeNull();
  });

  it('maps a refused member change to calm copy, not the server message', async () => {
    removeResponse = () => json(409, { error: { code: 'transfer_required', message: 'owner_id fk violation' } });
    await renderAt('/profile/members');
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove' }));
    await inSheet('Remove');
    await screen.findByText('Hand the home over to someone before leaving');
    expect(screen.queryByText(/fk violation/)).toBeNull();
  });

  it('shows active invites and revokes one', async () => {
    await renderAt('/profile/members');
    await screen.findByText('k7q2mx');
    await press('Revoke');
    await waitFor(() => expect(calls(/\/invites\/i1$/, 'DELETE')).toHaveLength(1));
  });
});

describe('home settings', () => {
  it('shows the transfer message when leaving as the owner is refused', async () => {
    leaveResponse = () => json(409, { error: { code: 'transfer_required', message: 'transfer first' } });
    await renderAt('/profile/home');
    await press('Leave home');
    await inSheet('Leave home');
    await screen.findByText('Hand the home over to someone before leaving');
    expect(calls(/\/homes\/h1\/leave$/, 'POST')).toHaveLength(1);
  });

  it('forgets the home and re-reads the user\'s homes after leaving', async () => {
    currentHomeStore.set('h1');
    await renderAt('/profile/home');
    await screen.findByRole('button', { name: 'Leave home' });
    const before = calls(/\/me\/bootstrap$/).length;
    await press('Leave home');
    await inSheet('Leave home');
    await waitFor(() => expect(calls(/\/homes\/h1\/leave$/, 'POST')).toHaveLength(1));
    await waitFor(() => expect(calls(/\/me\/bootstrap$/).length).toBeGreaterThan(before));
    await screen.findByText('You left Maple');
    await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalledWith('klindom.currentHome'));
  });

  it('keeps Delete home disabled until the name matches, then sends confirmName', async () => {
    await renderAt('/profile/home');
    await press('Delete home');
    const panel = await screen.findByTestId('sheet-panel');
    const confirm = () => within(panel).getByRole('button', { name: 'Delete home' });
    expect(confirm().props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(confirm());
    expect(calls(/\/homes\/h1$/, 'DELETE')).toHaveLength(0);
    await fireEvent.changeText(within(panel).getByLabelText('Home name'), 'Maple');
    expect(confirm().props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(confirm());
    await waitFor(() => expect(calls(/\/homes\/h1$/, 'DELETE')).toHaveLength(1));
    expect(body(calls(/\/homes\/h1$/, 'DELETE')[0]!)).toEqual({ confirmName: 'Maple' });
  });

  it('does not show the raw server text when deleting the home is refused', async () => {
    deleteHomeResponse = () => json(400, { error: { code: 'confirm_mismatch', message: 'confirmName != homes.name (sql)' } });
    await renderAt('/profile/home');
    await press('Delete home');
    const panel = await screen.findByTestId('sheet-panel');
    await fireEvent.changeText(within(panel).getByLabelText('Home name'), 'Maple');
    await fireEvent.press(within(panel).getByRole('button', { name: 'Delete home' }));
    await screen.findByText('That name doesn’t match. Check it and try again.');
    expect(screen.queryByText(/sql/)).toBeNull();
  });

  it('hides rename and delete from members', async () => {
    role = 'member';
    await renderAt('/profile/home');
    await screen.findByRole('button', { name: 'Leave home' });
    expect(screen.queryByRole('button', { name: 'Delete home' })).toBeNull();
    expect(screen.queryByLabelText('Home name')).toBeNull();
  });
});

describe('account', () => {
  it('saves the display name', async () => {
    await renderAt('/profile/account');
    await fireEvent.changeText(await screen.findByLabelText('Your name'), 'Til');
    await press('Save name');
    await waitFor(() => expect(calls(/\/me$/, 'PATCH')).toHaveLength(1));
    expect(body(calls(/\/me$/, 'PATCH')[0]!)).toEqual({ displayName: 'Til' });
  });

  it('signs out', async () => {
    await renderAt('/profile/account');
    await press('Sign out');
    await waitFor(() => expect(mockSupabaseSignOut).toHaveBeenCalled());
  });

  it('shows the transfer message when deleting the account is refused', async () => {
    deleteMeResponse = () => json(409, { error: { code: 'transfer_required', message: 'transfer first' } });
    await renderAt('/profile/account');
    await press('Delete account');
    await inSheet('Delete account');
    await screen.findByText('Hand the home over to someone before leaving');
    expect(mockSupabaseSignOut).not.toHaveBeenCalled();
  });

  it('keeps the sheet open and sends one request while deleting, and pauses every other request', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    deleteMeResponse = (() => gate.then(() => new Response(null, { status: 204 }))) as unknown as () => Response;
    await renderAt('/profile/account');
    await press('Delete account');
    const confirm = () => within(screen.getByTestId('sheet-panel')).getByRole('button', { name: 'Delete account' });
    await screen.findByTestId('sheet-panel');
    const spy = jest.spyOn(mockClient, 'cancelQueries');
    await fireEvent.press(confirm());
    await fireEvent.press(confirm());
    await waitFor(() => expect(calls(/\/me$/, 'DELETE')).toHaveLength(1));
    expect(spy).toHaveBeenCalled();
    // Still open, so the button cannot be pressed twice, and a poll or refocus fires nothing.
    expect(screen.getByTestId('sheet-panel')).toBeTruthy();
    const before = fetchMock.mock.calls.length;
    await act(async () => {
      await mockClient.invalidateQueries();
    });
    expect(fetchMock.mock.calls.length).toBe(before);
    await act(async () => release());
    await waitFor(() => expect(mockSupabaseSignOut).toHaveBeenCalled());
    await waitFor(() => expect(onlineManager.isOnline()).toBe(true));
  });

  it('cancels queries before the delete request goes out, and resumes them when it fails', async () => {
    deleteMeResponse = () => json(500, { error: { code: 'boom', message: 'x' } });
    await renderAt('/profile/account');
    await press('Delete account');
    await screen.findByTestId('sheet-panel');
    const order: string[] = [];
    jest.spyOn(mockClient, 'cancelQueries').mockImplementation(async () => {
      order.push('cancel');
    });
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/me') && init?.method === 'DELETE') order.push('delete');
      return defaultFetch(url, init);
    });
    await inSheet('Delete account');
    await screen.findByText('Couldn’t save that — try again');
    expect(order).toEqual(['cancel', 'delete']);
    expect(screen.queryByTestId('sheet-panel')).toBeNull();
    expect(onlineManager.isOnline()).toBe(true);
    expect(mockSupabaseSignOut).not.toHaveBeenCalled();
  });

  it('signs out after the account is deleted', async () => {
    await renderAt('/profile/account');
    await press('Delete account');
    await inSheet('Delete account');
    await waitFor(() => expect(calls(/\/me$/, 'DELETE')).toHaveLength(1));
    await waitFor(() => expect(mockSupabaseSignOut).toHaveBeenCalled());
  });
});
