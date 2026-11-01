import path from 'node:path';
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

// The screens talk to this module; the tests drive each PushState through it.
const mockPush = { state: jest.fn(), enable: jest.fn(), disable: jest.fn() };
jest.mock('../src/push/push', () => ({ push: mockPush }));

import { currentHomeStore } from '../src/state/currentHome';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let homes: { id: string; name: string; role: string }[];
let settings: { notificationsEnabled: boolean; defaultReminderTime: string };
const defaultFetch = async (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  if (url.endsWith('/me/bootstrap')) return json(200, { user: { id: 'u1', displayName: 'Tilen', email: null }, homes });
  if (url.endsWith('/homes/h1/members/me') && method === 'GET') return json(200, settings);
  if (url.endsWith('/homes/h1/members/me') && method === 'PATCH') {
    settings = { ...settings, ...JSON.parse(init!.body as string) };
    return json(200, settings);
  }
  if (url.endsWith('/suggestions')) return json(200, { rooms: [], sharedTasks: [] });
  if (url.endsWith('/homes') && method === 'POST') {
    homes = [{ id: 'h-new', name: 'x', role: 'owner' }];
    return json(201, { id: 'h-new', name: 'x', timezone: 'Europe/Ljubljana', ownerId: 'u1', role: 'owner' });
  }
  if (url.endsWith('/homes/h-new/invites') && method === 'POST') {
    return json(201, { id: 'i1', code: 'k7q2mx', url: 'https://klindom.app/join/k7q2mx', createdAt: '', createdBy: 'u1' });
  }
  return json(404, { error: { code: 'not_found', message: 'nope' } });
};
const fetchMock = jest.fn(defaultFetch);
const patches = () => fetchMock.mock.calls.filter(([u, i]) => u.endsWith('/members/me') && i?.method === 'PATCH');

const APP = path.resolve(__dirname, '../app');
let app: ReturnType<typeof renderRouter>;
const renderAt = async (initialUrl: string) => {
  app = renderRouter(APP, { initialUrl });
  await app;
};
const expectPath = (p: string) => waitFor(() => expect(app.getPathname()).toBe(p));
const press = async (name: string) => fireEvent.press(await screen.findByRole('button', { name }));

beforeEach(async () => {
  await AsyncStorage.clear();
  currentHomeStore.clear();
  jest.clearAllMocks();
  homes = [{ id: 'h1', name: 'Maple', role: 'owner' }];
  settings = { notificationsEnabled: true, defaultReminderTime: '08:00' };
  mockPush.state.mockResolvedValue('off');
  mockPush.enable.mockResolvedValue('on');
  mockPush.disable.mockResolvedValue('off');
  fetchMock.mockImplementation(defaultFetch);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('notifications screen', () => {
  it('shows On/Off from the member settings on the profile row and opens the screen', async () => {
    await renderAt('/profile');
    await screen.findByText('On');
    await press('Notifications');
    await expectPath('/profile/notifications');
  });

  it('toggle notifications off calls PATCH { notificationsEnabled: false }', async () => {
    await renderAt('/profile/notifications');
    const sw = await screen.findByRole('switch', { name: 'Reminders' });
    await waitFor(() => expect(sw.props.value ?? sw.props.accessibilityState?.checked).toBeTruthy());
    await fireEvent(sw, 'valueChange', false);
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(JSON.parse(patches()[0]![1]!.body as string)).toEqual({ notificationsEnabled: false });
  });

  it("morning time saves '07:30' and rejects '7:3' with a field error", async () => {
    await renderAt('/profile/notifications');
    const field = await screen.findByLabelText('Morning reminder time');
    await waitFor(() => expect(field.props.value).toBe('08:00'));
    await fireEvent.changeText(field, '7:3');
    await press('Save time');
    await screen.findByText('Enter a time like 07:30.');
    expect(patches()).toHaveLength(0);
    await fireEvent.changeText(screen.getByLabelText('Morning reminder time'), '07:30');
    await press('Save time');
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(JSON.parse(patches()[0]![1]!.body as string)).toEqual({ defaultReminderTime: '07:30' });
  });

  it('off shows Turn on for this device and enables it', async () => {
    await renderAt('/profile/notifications');
    await press('Turn on for this device');
    await waitFor(() => expect(mockPush.enable).toHaveBeenCalledTimes(1));
    await screen.findByText('On for this device');
    await press('Turn off');
    await waitFor(() => expect(mockPush.disable).toHaveBeenCalledTimes(1));
  });

  it('needs-install shows the Add to Home Screen steps', async () => {
    mockPush.state.mockResolvedValue('needs-install');
    await renderAt('/profile/notifications');
    await screen.findByText('Tap Share, then Add to Home Screen, then open KlinDom from your Home Screen.');
    expect(screen.queryByRole('button', { name: 'Turn on for this device' })).toBeNull();
    expect(screen.queryByText('This device')).toBeNull();
  });

  it('denied shows the blocked hint and no enable button', async () => {
    mockPush.state.mockResolvedValue('denied');
    await renderAt('/profile/notifications');
    await screen.findByText('Notifications are blocked for KlinDom. Allow them in your browser or device settings, then come back.');
    expect(screen.queryByRole('button', { name: 'Turn on for this device' })).toBeNull();
    expect(screen.queryByText('This device')).toBeNull();
  });

  it('unsupported says so, without an empty device card', async () => {
    mockPush.state.mockResolvedValue('unsupported');
    await renderAt('/profile/notifications');
    await screen.findByText('This browser can’t show notifications.');
    expect(screen.queryByText('This device')).toBeNull();
  });

  it('off and on show the device card', async () => {
    await renderAt('/profile/notifications');
    await screen.findByText('This device');
  });
});

describe('onboarding reminders', () => {
  async function toReminders() {
    homes = [];
    await renderAt('/');
    await press('Create a home');
    await press('Start from scratch');
    await expectPath('/invite');
    await screen.findByText('k7q2mx');
    await press('Continue');
    await expectPath('/reminders');
  }

  it('invite -> reminders -> "Not now" lands on tabs without enabling', async () => {
    await toReminders();
    await screen.findByText('Stay on top of chores');
    await press('Not now');
    await expectPath('/');
    expect(mockPush.enable).not.toHaveBeenCalled();
  });

  it('"Turn on reminders" calls enable and lands on tabs', async () => {
    await toReminders();
    await press('Turn on reminders');
    await waitFor(() => expect(mockPush.enable).toHaveBeenCalledTimes(1));
    await expectPath('/');
  });

  it('needs-install shows the explainer and a Continue chip instead', async () => {
    mockPush.state.mockResolvedValue('needs-install');
    await toReminders();
    await screen.findByText('Tap Share, then Add to Home Screen, then open KlinDom from your Home Screen.');
    expect(screen.queryByRole('button', { name: 'Turn on reminders' })).toBeNull();
    await press('Continue');
    await expectPath('/');
  });

  it.each([
    ['denied', 'Notifications are blocked for KlinDom. Allow them in your browser or device settings, then come back.'],
    ['unsupported', 'This browser can’t show notifications.'],
  ])('%s shows the calm line and a Continue chip instead', async (state, line) => {
    mockPush.state.mockResolvedValue(state);
    await toReminders();
    await screen.findByText(line);
    expect(screen.queryByRole('button', { name: 'Turn on reminders' })).toBeNull();
    await press('Continue');
    await expectPath('/');
    expect(mockPush.enable).not.toHaveBeenCalled();
  });
});
