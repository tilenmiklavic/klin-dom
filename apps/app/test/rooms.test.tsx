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
    signOut: async () => {},
  },
}));

let mockClient: import('@tanstack/react-query').QueryClient;
jest.mock('../src/data/queryClient', () => {
  const actual = jest.requireActual('../src/data/queryClient');
  return { ...actual, createQueryClient: () => (mockClient = actual.createQueryClient()) };
});

import { currentHomeStore } from '../src/state/currentHome';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const room = (id: string, name: string, sortOrder: number) => ({ id, name, icon: 'sponge', sortOrder });
const ref = (id: string, name: string) => ({ id, name, icon: 'sponge' });
const mkTask = (id: string, name: string, rooms: { id: string; name: string; icon: string }[], nextDueDate: string) => ({
  id,
  name,
  icon: 'sparkle',
  notes: null,
  rooms,
  intervalCount: 1,
  intervalUnit: 'week',
  dueTime: null,
  assigneeId: null,
  nextDueDate,
  lastCompletedAt: null,
  reminderOffsets: [],
  mutedByMe: false,
  overdue: nextDueDate < '2026-10-31',
});
const kitchen = ref('r1', 'Kitchen');
const TASKS = [
  mkTask('t1', 'Wash the dishes', [kitchen], '2026-10-26'),
  mkTask('t2', 'Wipe the hob', [kitchen], '2026-11-01'),
  mkTask('t3', 'Change the bed', [ref('r2', 'Bedroom')], '2026-11-01'),
  mkTask('t4', 'Scrub the bath', [ref('r3', 'Bathroom')], '2026-10-31'),
  mkTask('t5', 'Wipe the mirror', [ref('r3', 'Bathroom')], '2026-10-31'),
];
const emptyRings = { today: { done: 0, total: 0 }, week: { done: 0, total: 0 }, fresh: { notOverdue: 0, total: 0, pct: 100 } };

let rooms: ReturnType<typeof room>[];
let archiveResponse: () => Response;
let roomsStatus = 200;
let roomTasksStatus = 200;

const defaultFetch = async (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  if (url.endsWith('/me/bootstrap')) {
    return json(200, { user: { id: 'u1', displayName: 'Tilen', email: null }, homes: [{ id: 'h1', name: 'Maple', role: 'owner' }] });
  }
  if (url.endsWith('/homes/h1')) return json(200, { id: 'h1', name: 'Maple', timezone: 'Europe/Ljubljana', ownerId: 'u1', role: 'owner' });
  if (url.endsWith('/homes/h1/members')) return json(200, [{ userId: 'u1', displayName: 'Tilen', avatarUrl: null, role: 'owner', joinedAt: '' }]);
  if (url.endsWith('/homes/h1/rooms') && method === 'GET') {
    return roomsStatus === 200 ? json(200, rooms) : json(roomsStatus, { error: { code: 'forbidden', message: 'x' } });
  }
  if (url.endsWith('/homes/h1/rooms') && method === 'POST') return json(201, room('r9', JSON.parse(init!.body as string).name, 9));
  if (url.endsWith('/homes/h1/rooms/order') && method === 'POST') return json(200, rooms);
  if (/\/rooms\/r1$/.test(url) && method === 'PATCH') return json(200, rooms[0]);
  if (/\/rooms\/r1$/.test(url) && method === 'DELETE') return archiveResponse();
  if (url.includes('/homes/h1/dashboard')) return json(200, { rings: emptyRings, dueToday: [], doneToday: [] });
  if (url.includes('/homes/h1/tasks') && method === 'GET') {
    if (roomTasksStatus !== 200) return json(roomTasksStatus, { error: { code: 'forbidden', message: 'x' } });
    const roomId = new URL(url).searchParams.get('roomId');
    return json(200, roomId ? TASKS.filter((t) => t.rooms.some((r) => r.id === roomId)) : TASKS);
  }
  if (/\/tasks\/t\d\/complete$/.test(url) && method === 'POST') {
    return json(200, {
      completion: { id: 'c1', taskId: 't1', kind: 'done', userId: 'u1', userName: 'Tilen', completedAt: '2026-10-31T10:00:00Z', dueDate: '2026-10-26', onTime: false },
      task: TASKS[0],
      rings: emptyRings,
    });
  }
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

beforeEach(async () => {
  await AsyncStorage.clear();
  currentHomeStore.clear();
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-31T10:00:00Z'));
  rooms = [room('r1', 'Kitchen', 0), room('r2', 'Bedroom', 1), room('r3', 'Bathroom', 2), room('r4', 'Hall', 3)];
  archiveResponse = () => new Response(null, { status: 204 });
  roomsStatus = 200;
  roomTasksStatus = 200;
  fetchMock.mockImplementation(defaultFetch);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => jest.restoreAllMocks());

describe('rooms grid', () => {
  it('shows the room count, fresh count and each room status', async () => {
    await renderAt('/rooms');
    await screen.findByText('4 rooms · 3 fresh');
    expect(screen.getByText('1 overdue')).toBeTruthy();
    expect(screen.getByText('Next: Sun')).toBeTruthy();
    expect(screen.getByText('2 due today')).toBeTruthy();
    expect(screen.getByText('All fresh')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a room' })).toBeTruthy();
  });

  it('opens a room from the grid', async () => {
    await renderAt('/rooms');
    await press('Kitchen');
    expect(await screen.findByRole('progressbar', { name: 'Kitchen freshness' })).toBeTruthy();
    await waitFor(() => expect(app.getPathname()).toBe('/rooms/r1'));
  });

  it('adds a room through the editor', async () => {
    await renderAt('/rooms');
    await press('Add a room');
    await fireEvent.changeText(await screen.findByLabelText('Room name'), 'Pantry');
    await press('Save room');
    await waitFor(() => expect(calls(/\/homes\/h1\/rooms$/, 'POST')).toHaveLength(1));
    expect(body(calls(/\/homes\/h1\/rooms$/, 'POST')[0]!)).toEqual({ name: 'Pantry', icon: 'sparkle' });
    await screen.findByText('Room added');
  });

  it('reorders rooms with up and down buttons and submits the new order', async () => {
    await renderAt('/rooms');
    await screen.findByText('4 rooms · 3 fresh');
    await fireEvent(screen.getByRole('button', { name: 'Kitchen' }), 'longPress');
    await press('Move Kitchen down');
    await press('Move Hall up');
    await press('Save order');
    await waitFor(() => expect(calls(/\/rooms\/order$/, 'POST')).toHaveLength(1));
    expect(body(calls(/\/rooms\/order$/, 'POST')[0]!)).toEqual({ roomIds: ['r2', 'r1', 'r4', 'r3'] });
  });
});

describe('rooms grid reorder sync', () => {
  it('reconciles the order with rooms that were archived or added meanwhile', async () => {
    await renderAt('/rooms');
    await screen.findByText('4 rooms · 3 fresh');
    await fireEvent(screen.getByRole('button', { name: 'Kitchen' }), 'longPress');
    await press('Move Kitchen down'); // Bedroom, Kitchen, Bathroom, Hall
    // Someone archives Bathroom and adds Pantry while this screen is in reorder mode.
    rooms = [room('r1', 'Kitchen', 0), room('r2', 'Bedroom', 1), room('r4', 'Hall', 3), room('r9', 'Pantry', 4)];
    await act(() => mockClient.invalidateQueries({ queryKey: ['rooms', 'h1'] }));
    await screen.findByRole('button', { name: 'Move Pantry up' });
    expect(screen.queryByRole('button', { name: 'Move Bathroom up' })).toBeNull();
    await press('Save order');
    await waitFor(() => expect(calls(/\/rooms\/order$/, 'POST')).toHaveLength(1));
    expect(body(calls(/\/rooms\/order$/, 'POST')[0]!)).toEqual({ roomIds: ['r2', 'r1', 'r4', 'r9'] });
  });
});

describe('room detail', () => {
  it('shows freshness 0.5 and only the room tasks, and ticks with the due date', async () => {
    await renderAt('/rooms/r1');
    const ring = await screen.findByRole('progressbar', { name: 'Kitchen freshness' });
    expect(ring.props.accessibilityValue).toEqual({ now: 0.5, max: 1 });
    expect(await screen.findByText('Wash the dishes')).toBeTruthy();
    expect(screen.getByText('Wipe the hob')).toBeTruthy();
    expect(screen.queryByText('Change the bed')).toBeNull();
    expect(calls(/\/homes\/h1\/tasks\?.*roomId=r1/, 'GET').length).toBeGreaterThan(0);
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Mark Wash the dishes done' }));
    await waitFor(() => expect(calls(/\/tasks\/t1\/complete$/, 'POST')).toHaveLength(1));
    expect(body(calls(/\/tasks\/t1\/complete$/, 'POST')[0]!)).toEqual({ dueDate: '2026-10-26' });
  });

  it('shows a retryable error when the rooms fail to load, not a dead end or "not found"', async () => {
    roomsStatus = 403;
    await renderAt('/rooms/r1');
    expect(await screen.findByText('Couldn’t load rooms')).toBeTruthy();
    expect(screen.queryByText('Couldn’t find this room')).toBeNull();
    roomsStatus = 200;
    await press('Try again');
    expect(await screen.findByText('Wash the dishes')).toBeTruthy();
  });

  it('says a room is not found only once the rooms have loaded without it', async () => {
    await renderAt('/rooms/nope');
    expect(await screen.findByText('Couldn’t find this room')).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('shows a retryable error when the room tasks fail to load', async () => {
    roomTasksStatus = 403;
    await renderAt('/rooms/r1');
    expect(await screen.findByText('Couldn’t load tasks')).toBeTruthy();
    roomTasksStatus = 200;
    await press('Try again');
    expect(await screen.findByText('Wash the dishes')).toBeTruthy();
  });

  it('archive that hits room_has_tasks shows the API message as a toast', async () => {
    archiveResponse = () => json(409, { error: { code: 'room_has_tasks', message: 'Move or archive its tasks first' } });
    await renderAt('/rooms/r1');
    await press('Edit room');
    await press('Archive room');
    await fireEvent.press(within(await screen.findByTestId('sheet-panel')).getByRole('button', { name: 'Archive room' }));
    await screen.findByText('Move or archive its tasks first');
    expect(calls(/\/rooms\/r1$/, 'DELETE')).toHaveLength(1);
    expect(app.getPathname()).toBe('/room-editor'); // a refused archive keeps you in the editor
  });

  it('saves a renamed room', async () => {
    await renderAt('/rooms/r1');
    await press('Edit room');
    await fireEvent.changeText(await screen.findByLabelText('Room name'), 'Galley');
    await press('Save room');
    await waitFor(() => expect(calls(/\/rooms\/r1$/, 'PATCH')).toHaveLength(1));
    expect(body(calls(/\/rooms\/r1$/, 'PATCH')[0]!)).toEqual({ name: 'Galley' });
    await screen.findByText('Room saved');
  });
});
