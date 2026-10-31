import path from 'node:path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

const mockConfig = { apiUrl: 'http://api.test', authMode: 'supabase' as const };
jest.mock('../src/config', () => ({ getConfig: () => mockConfig }));

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

import { currentHomeStore } from '../src/state/currentHome';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });


let role: 'owner' | 'member';
let leaveResponse: () => Response;
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
  if (/\/homes\/h1\/members\/u2$/.test(url) && method === 'DELETE') return new Response(null, { status: 204 });
  if (url.endsWith('/homes/h1/transfer')) return json(200, { id: 'h1', name: 'Maple', timezone: 'Europe/Ljubljana', ownerId: 'u2', role });
  if (url.endsWith('/homes/h1/leave')) return leaveResponse();
  if (url.endsWith('/homes/h1/invites') && method === 'GET')
    return json(200, [{ id: 'i1', code: 'k7q2mx', url: 'https://klindom.app/join/k7q2mx', createdAt: '', createdBy: 'u1' }]);
  if (/\/invites\/i1$/.test(url) && method === 'DELETE') return new Response(null, { status: 204 });
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
  leaveResponse = () => json(200, { homeDeleted: false });
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

  it('lists Notifications as coming soon and navigates to members', async () => {
    await renderAt('/profile');
    await screen.findByText('Coming soon');
    await press('Members');
    await waitFor(() => expect(app.getPathname()).toBe('/profile/members'));
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

  it('signs out after the account is deleted', async () => {
    await renderAt('/profile/account');
    await press('Delete account');
    await inSheet('Delete account');
    await waitFor(() => expect(calls(/\/me$/, 'DELETE')).toHaveLength(1));
    await waitFor(() => expect(mockSupabaseSignOut).toHaveBeenCalled());
  });
});
