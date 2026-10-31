import path from 'node:path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

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
    signOut: async () => {},
  },
}));

// The celebration animates with timers; expose only what it receives.
jest.mock('@klindom/ui', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    ...jest.requireActual('@klindom/ui'),
    Celebration: ({ visible }: { visible: boolean }) => (visible ? React.createElement(Text, null, 'celebration-visible') : null),
  };
});

import { currentHomeStore } from '../src/state/currentHome';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const room = (id: string, name: string) => ({ id, name, icon: 'home' });
const mkTask = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  icon: 'sparkle',
  notes: null,
  rooms: [room('r1', 'Kitchen')],
  intervalCount: 1,
  intervalUnit: 'week',
  dueTime: null,
  assigneeId: null,
  nextDueDate: '2026-10-31',
  lastCompletedAt: null,
  reminderOffsets: [],
  mutedByMe: false,
  overdue: false,
  ...over,
});
const dishes = mkTask('t1', 'Wash the dishes');
const vacuum = mkTask('t2', 'Vacuum the floors', {
  rooms: [room('r2', 'Living room'), room('r3', 'Bedroom')],
  nextDueDate: '2026-10-28',
  overdue: true,
  assigneeId: 'u2',
});
const hob = mkTask('t3', 'Clean the hob', { rooms: [room('r4', 'Bathroom')] });
const doneRow = {
  id: 'c0',
  taskId: 't9',
  kind: 'done',
  userId: 'u2',
  userName: 'Ana',
  completedAt: '2026-10-31T08:40:00.000Z', // 09:40 in Europe/Ljubljana
  dueDate: '2026-10-31',
  onTime: true,
  taskName: 'Water the plants',
  taskIcon: 'sparkle',
  roomNames: ['Living room'],
};
const rings = (over: Record<string, unknown> = {}) => ({
  today: { done: 4, total: 9 },
  week: { done: 18, total: 31 },
  fresh: { notOverdue: 24, total: 28, pct: 86 },
  ...over,
});

type Dash = { rings: ReturnType<typeof rings>; dueToday: unknown[]; doneToday: unknown[] };
let dash: Dash;
let completeGate: Promise<void> | null;
let completeFails: boolean;
let dashStatus: number;
const baseDash = (): Dash => ({ rings: rings(), dueToday: [dishes, vacuum, hob], doneToday: [doneRow] });

const defaultFetch = async (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  if (url.endsWith('/me/bootstrap')) {
    return json(200, { user: { id: 'u1', displayName: 'Tilen', email: null }, homes: [{ id: 'h1', name: 'Maple', role: 'owner' }] });
  }
  if (url.endsWith('/homes/h1')) return json(200, { id: 'h1', name: 'Maple', timezone: 'Europe/Ljubljana', ownerId: 'u1', role: 'owner' });
  if (url.endsWith('/homes/h1/members')) {
    return json(200, [
      { userId: 'u1', displayName: 'Tilen', avatarUrl: null, role: 'owner', joinedAt: '' },
      { userId: 'u2', displayName: 'Ana', avatarUrl: null, role: 'member', joinedAt: '' },
    ]);
  }
  if (url.includes('/homes/h1/dashboard')) {
    if (dashStatus !== 200) return json(dashStatus, { error: { code: 'nope', message: 'nope' } });
    return json(200, dash);
  }
  const complete = url.match(/\/tasks\/(\w+)\/complete$/);
  if (complete && method === 'POST') {
    if (completeGate) await completeGate;
    if (completeFails) return json(404, { error: { code: 'task_not_found', message: 'gone' } });
    const id = complete[1]!;
    const t = (dash.dueToday as { id: string }[]).find((x) => x.id === id)!;
    dash = {
      rings: rings({ today: { done: dash.rings.today.done + 1, total: dash.rings.today.total }, week: { done: dash.rings.week.done + 1, total: 31 } }),
      dueToday: dash.dueToday.filter((x) => (x as { id: string }).id !== id),
      doneToday: [...dash.doneToday, { ...doneRow, id: 'c1', taskId: id, userId: 'u1', userName: 'Tilen', taskName: (t as unknown as { name: string }).name }],
    };
    return json(200, { task: t, rings: dash.rings, completion: { ...doneRow, id: 'c1', taskId: id } });
  }
  if (url.endsWith('/completions/c1') && method === 'DELETE') {
    dash = baseDash();
    return json(200, { task: dishes, rings: dash.rings });
  }
  if (url.endsWith('/tasks/t1/skip') && method === 'POST') {
    dash = { ...dash, dueToday: dash.dueToday.filter((x) => (x as { id: string }).id !== 't1') };
    return json(200, { task: dishes, rings: dash.rings, completion: { ...doneRow, id: 'c2', kind: 'skip' } });
  }
  return json(404, { error: { code: 'not_found', message: 'nope' } });
};
const fetchMock = jest.fn(defaultFetch);
const calls = (re: RegExp, method?: string) =>
  fetchMock.mock.calls.filter(([u, i]) => re.test(u) && (!method || (i?.method ?? 'GET') === method));

const APP = path.resolve(__dirname, '../app');
let app: ReturnType<typeof renderRouter>;
const renderApp = async () => {
  app = renderRouter(APP, { initialUrl: '/' });
  await app;
};
const press = async (name: string) => fireEvent.press(await screen.findByRole('button', { name }));

beforeEach(async () => {
  await AsyncStorage.clear();
  currentHomeStore.clear();
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-31T10:00:00Z'));
  dash = baseDash();
  completeGate = null;
  completeFails = false;
  dashStatus = 200;
  fetchMock.mockImplementation(defaultFetch);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => jest.restoreAllMocks());

describe('home dashboard', () => {
  it('shows the three ring legends and due rows in API order, then done rows', async () => {
    await renderApp();
    expect(await screen.findByText('/9')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('/31')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText('86%')).toBeTruthy();
    expect(screen.getByText('Nice, keep going')).toBeTruthy();

    const names = screen.getAllByText(/Wash the dishes|Vacuum the floors|Clean the hob|Water the plants/).map((n) => n.props.children);
    expect(names).toEqual(['Wash the dishes', 'Vacuum the floors', 'Clean the hob', 'Water the plants']);
    expect(screen.getByText('Kitchen')).toBeTruthy();
    expect(screen.getByText('Due 3 days ago')).toBeTruthy();
    expect(screen.getByText('Done by Ana · 9:40')).toBeTruthy();
    expect(screen.getByText('Saturday, 31 October')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Mark Water the plants not done' })).toBeTruthy();
  });

  it('ticks once with the task due date even when pressed twice quickly', async () => {
    let release!: () => void;
    completeGate = new Promise<void>((r) => (release = r));
    await renderApp();
    const tick = await screen.findByRole('checkbox', { name: 'Mark Wash the dishes done' });
    await fireEvent.press(tick);
    await fireEvent.press(tick);
    await waitFor(() => expect(calls(/\/tasks\/t1\/complete$/, 'POST')).toHaveLength(1));
    // Optimistic: the row is already done while the request is pending.
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Mark Wash the dishes not done' })).toBeTruthy());
    await act(async () => release());
    await screen.findByText('Undo');
    expect(calls(/\/tasks\/t1\/complete$/, 'POST')).toHaveLength(1);
    expect(JSON.parse(calls(/complete$/)[0]![1]!.body as string)).toEqual({ dueDate: '2026-10-31' });
  });

  it('offers undo after a tick and undoes by completion id', async () => {
    await renderApp();
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Mark Wash the dishes done' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(calls(/\/completions\/c1$/, 'DELETE')).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Mark Wash the dishes done' })).toBeTruthy());
  });

  it('rolls a failed tick back and says so', async () => {
    completeFails = true;
    await renderApp();
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Mark Wash the dishes done' }));
    expect(await screen.findByText('Couldn’t save that — try again')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Mark Wash the dishes done' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Mark Wash the dishes not done' })).toBeNull();
    expect(screen.getByText('/9')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('shows a load error with a retry that refetches', async () => {
    dashStatus = 404;
    await renderApp();
    expect(await screen.findByText('Couldn’t load your home')).toBeTruthy();
    dashStatus = 200;
    await press('Try again');
    expect(await screen.findByText('Wash the dishes')).toBeTruthy();
    expect(screen.queryByText('Couldn’t load your home')).toBeNull();
  });

  it('celebrates when a tick closes the today ring', async () => {
    dash = { rings: rings({ today: { done: 8, total: 9 } }), dueToday: [dishes], doneToday: [doneRow] };
    await renderApp();
    await screen.findByText('/9');
    expect(screen.queryByText('celebration-visible')).toBeNull();
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Mark Wash the dishes done' }));
    expect(await screen.findByText('celebration-visible')).toBeTruthy();
    expect(screen.getByText('All done for today')).toBeTruthy();
  });

  it('refetches with scope=mine when switching to Mine', async () => {
    await renderApp();
    await screen.findByText('Wash the dishes');
    expect(calls(/dashboard\?scope=all/)).toHaveLength(1);
    await fireEvent.press(screen.getByRole('tab', { name: 'Mine' }));
    await waitFor(() => expect(calls(/dashboard\?scope=mine/).length).toBeGreaterThan(0));
  });

  it('skips a task from the long-press sheet', async () => {
    await renderApp();
    const row = await screen.findByRole('button', { name: 'Wash the dishes' });
    await fireEvent(row, 'longPress');
    await fireEvent.press(await screen.findByRole('button', { name: 'Skip this time' }));
    await waitFor(() => expect(calls(/\/tasks\/t1\/skip$/, 'POST')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Mark Wash the dishes done' })).toBeNull());
  });

  it('opens a task from its row', async () => {
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Wash the dishes' }));
    await waitFor(() => expect(app.getPathname()).toBe('/tasks/t1'));
  });

  it('shows an empty state when nothing is due', async () => {
    dash = { rings: rings({ today: { done: 0, total: 0 } }), dueToday: [], doneToday: [] };
    await renderApp();
    expect(await screen.findByText('Nothing due today')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a task' })).toBeTruthy();
    expect(screen.getByText('Fresh start today!')).toBeTruthy();
  });

  it('has the four tabs and navigates with See all', async () => {
    await renderApp();
    await screen.findByText('Wash the dishes');
    for (const label of ['Home', 'Rooms', 'Tasks', 'Profile']) expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'See all' }));
    await waitFor(() => expect(app.getPathname()).toBe('/tasks'));
  });
});
