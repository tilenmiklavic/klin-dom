import path from 'node:path';
import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

const mockConfig = { apiUrl: 'http://api.test', authMode: 'supabase' as const };
jest.mock('../src/config', () => ({ getConfig: () => mockConfig }));

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: () => [true, null] }));
jest.mock('@expo-google-fonts/geist/400Regular', () => ({ Geist_400Regular: 1 }));
jest.mock('@expo-google-fonts/geist/500Medium', () => ({ Geist_500Medium: 2 }));
jest.mock('@expo-google-fonts/geist/600SemiBold', () => ({ Geist_600SemiBold: 3 }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

jest.mock('../src/auth/supabase', () => ({
  supabaseAuth: {
    getAccessToken: async () => 'tok',
    onChange: () => () => undefined,
    refresh: async () => null,
    signOut: async () => {},
  },
}));

import * as Clipboard from 'expo-clipboard';
import { currentHomeStore } from '../src/state/currentHome';

const user = { id: 'u1', displayName: 'Tilen Miklavic', email: null };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const task = (key: string, name: string, intervalCount: number, intervalUnit: string) => ({
  key,
  name,
  icon: 'sparkle',
  intervalCount,
  intervalUnit,
});
const catalog = {
  rooms: [
    { key: 'kitchen', name: 'Kitchen', icon: 'dishes', tasks: [task('dishes', 'Wash the dishes', 1, 'day'), task('hob', 'Clean the hob', 1, 'week')] },
    { key: 'bedroom', name: 'Bedroom', icon: 'home', tasks: [task('bedding', 'Change the bedding', 2, 'week')] },
    { key: 'bathroom', name: 'Bathroom', icon: 'spray', tasks: [task('sink', 'Scrub the sink', 1, 'week')] },
  ],
  sharedTasks: [
    { ...task('vacuum', 'Vacuum the floors', 1, 'week'), roomKeys: ['kitchen', 'bedroom'] },
    { ...task('mirror', 'Wipe the mirror', 1, 'week'), roomKeys: ['bathroom'] },
  ],
};

let homes: { id: string; name: string; role: string }[] = [];
const created = { id: 'h-new', name: 'x', timezone: 'Europe/Ljubljana', ownerId: 'u1', role: 'owner' };
const defaultFetch = async (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  if (url.endsWith('/me/bootstrap')) return json(200, { user, homes });
  if (url.endsWith('/suggestions')) return json(200, catalog);
  if (url.endsWith('/homes') && method === 'POST') {
    homes = [{ id: created.id, name: JSON.parse(init!.body as string).name, role: 'owner' }];
    return json(201, created);
  }
  if (url.endsWith('/homes/h-new/invites') && method === 'POST') {
    return json(201, { id: 'i1', code: 'k7q2mx', url: 'https://klindom.app/join/k7q2mx', createdAt: '', createdBy: 'u1' });
  }
  if (url.endsWith('/invites/k7q2mx/accept')) {
    homes = [{ id: 'h-joined', name: 'Maple House', role: 'member' }];
    return json(200, { id: 'h-joined', name: 'Maple House', timezone: 'UTC', ownerId: 'u2', role: 'member' });
  }
  if (url.endsWith('/invites/k7q2mx')) return json(200, { homeName: 'Maple House', inviterName: 'Ana' });
  if (url.includes('/invites/')) return json(404, { error: { code: 'invite_not_found', message: 'This invite is no longer valid' } });
  return json(404, { error: { code: 'not_found', message: 'nope' } });
};
const fetchMock = jest.fn(defaultFetch);
const calls = (suffix: string, method = 'POST') =>
  fetchMock.mock.calls.filter(([u, i]) => u.endsWith(suffix) && (i?.method ?? 'GET') === method);

const APP = path.resolve(__dirname, '../app');
let app: ReturnType<typeof renderRouter>;
const renderApp = async (initialUrl = '/') => {
  app = renderRouter(APP, { initialUrl });
  await app;
};
const expectPath = (p: string) => waitFor(() => expect(app.getPathname()).toBe(p));
const press = async (name: string) => fireEvent.press(await screen.findByRole('button', { name }));
const toggle = async (name: string) => fireEvent.press(await screen.findByRole('checkbox', { name }));

beforeEach(async () => {
  await AsyncStorage.clear();
  currentHomeStore.clear();
  homes = [];
  jest.clearAllMocks();
  fetchMock.mockImplementation(defaultFetch);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('create a home', () => {
  async function toReview() {
    await renderApp();
    await press('Create a home');
    await expectPath('/create');
    expect((await screen.findByLabelText('Home name')).props.value).toBe('Tilen’s home');
    await press('Start with suggestions');
    await expectPath('/rooms');
    await toggle('Kitchen');
    await toggle('Bedroom');
    await press('More Bedroom');
    await press('Review tasks');
    await expectPath('/review');
  }

  it('submits the chosen rooms and every pre-ticked task except the unticked one', async () => {
    await toReview();
    expect(screen.getByRole('checkbox', { name: 'Wash the dishes' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getAllByText('Weekly').length).toBeGreaterThan(0);
    expect(screen.getByText('Every 2 weeks')).toBeTruthy();
    // Shared tasks appear only when one of their rooms is chosen.
    expect(screen.getByRole('checkbox', { name: 'Vacuum the floors' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Wipe the mirror' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Scrub the sink' })).toBeNull();

    await toggle('Clean the hob');
    await press('Create home');
    await waitFor(() => expect(calls('/homes')).toHaveLength(1));
    expect(JSON.parse(calls('/homes')[0]![1]!.body as string)).toEqual({
      name: 'Tilen’s home',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      suggestions: {
        rooms: [
          { key: 'kitchen', count: 1 },
          { key: 'bedroom', count: 2 },
        ],
        taskKeys: ['kitchen.dishes', 'bedroom.bedding', 'shared.vacuum'],
      },
    });
    await expectPath('/invite');
    expect(await AsyncStorage.getItem('klindom.currentHome')).toBe('h-new');
  });

  it('starts from scratch without suggestions', async () => {
    await renderApp();
    await press('Create a home');
    await fireEvent.changeText(await screen.findByLabelText('Home name'), 'Flat 4');
    await press('Start from scratch');
    await waitFor(() => expect(calls('/homes')).toHaveLength(1));
    const body = JSON.parse(calls('/homes')[0]![1]!.body as string);
    expect(body).toEqual({ name: 'Flat 4', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    expect('suggestions' in body).toBe(false);
    await expectPath('/invite');
  });

  it('needs at least one room before reviewing', async () => {
    await renderApp();
    await press('Create a home');
    await press('Start with suggestions');
    await press('Review tasks');
    expect(app.getPathname()).toBe('/rooms');
  });
});

describe('invite step', () => {
  async function toInvite() {
    await renderApp();
    await press('Create a home');
    await press('Start from scratch');
    await expectPath('/invite');
    await screen.findByText('k7q2mx');
  }

  it('shares the invite link, then continues to the tabs', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await toInvite();
    await press('Share invite');
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0]![0]).toMatchObject({ url: 'https://klindom.app/join/k7q2mx' });
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    await press('Continue');
    await expectPath('/');
  });

  it('copies the link and says so when sharing is not available', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('unsupported'));
    await toInvite();
    await press('Share invite');
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://klindom.app/join/k7q2mx'));
    expect(await screen.findByText('Invite link copied')).toBeTruthy();
  });
});

describe('join a home', () => {
  it('previews the invite from a code in any case, then joins', async () => {
    await renderApp();
    await press('Join a home');
    await expectPath('/join');
    await fireEvent.changeText(await screen.findByLabelText('Invite code'), 'K7Q-2mx');
    await press('Find invite');
    expect(await screen.findByText('Join Maple House?')).toBeTruthy();
    expect(screen.getByText('Ana invited you.')).toBeTruthy();
    expect(calls('/invites/k7q2mx', 'GET')).toHaveLength(1);
    expect(calls('/invites/k7q2mx/accept')).toHaveLength(0);
    await press('Join home');
    await waitFor(() => expect(calls('/invites/k7q2mx/accept')).toHaveLength(1));
    await expectPath('/');
    expect(await AsyncStorage.getItem('klindom.currentHome')).toBe('h-joined');
  });

  it('shows the API message for an invalid code', async () => {
    await renderApp('/join/zzzzzz');
    expect(await screen.findByText('This invite is no longer valid')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Join home' })).toBeNull();
  });

  it('clears the pending invite after joining', async () => {
    await AsyncStorage.setItem('klindom.pendingInvite', 'k7q2mx');
    await renderApp('/join/k7q2mx');
    await press('Join home');
    await expectPath('/');
    expect(await AsyncStorage.getItem('klindom.pendingInvite')).toBeNull();
  });

  it('clears the pending invite when the user says not now', async () => {
    await AsyncStorage.setItem('klindom.pendingInvite', 'k7q2mx');
    await renderApp('/join/k7q2mx');
    await press('Not now');
    await expectPath('/start');
    expect(await AsyncStorage.getItem('klindom.pendingInvite')).toBeNull();
  });
});
