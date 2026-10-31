import path from 'node:path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

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

import { currentHomeStore } from '../src/state/currentHome';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const ROOMS = [
  { id: 'r1', name: 'Kitchen', icon: 'home', sortOrder: 0 },
  { id: 'r2', name: 'Bedroom', icon: 'home', sortOrder: 1 },
];
const mkTask = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  icon: 'sparkle',
  notes: null,
  rooms: [{ id: 'r1', name: 'Kitchen', icon: 'home' }],
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
const late = mkTask('t1', 'Wash the dishes', { nextDueDate: '2026-10-26', overdue: true });
const todayTask = mkTask('t2', 'Wipe the hob');
const weekTask = mkTask('t3', 'Change the bed', { nextDueDate: '2026-11-01', rooms: [{ id: 'r2', name: 'Bedroom', icon: 'home' }], intervalCount: 2 });
const laterTask = mkTask('t4', 'Descale the kettle', {
  nextDueDate: '2026-11-09',
  intervalUnit: 'month',
  rooms: [
    { id: 'r1', name: 'Kitchen', icon: 'home' },
    { id: 'r2', name: 'Bedroom', icon: 'home' },
  ],
});
const emptyRings = { today: { done: 0, total: 0 }, week: { done: 0, total: 0 }, fresh: { notOverdue: 0, total: 0, pct: 100 } };

let tasks: unknown[];
let detail: Record<string, unknown>;
const history = [
  { id: 'c1', taskId: 't1', kind: 'done', userId: 'u2', userName: 'Ana', completedAt: '2026-10-30T10:00:00Z', dueDate: '2026-10-26', onTime: false },
  { id: 'c2', taskId: 't1', kind: 'skip', userId: 'u1', userName: 'Tilen', completedAt: '2026-10-20T10:00:00Z', dueDate: '2026-10-19', onTime: true },
  { id: 'c3', taskId: 't1', kind: 'done', userId: 'u2', userName: 'Ana', completedAt: '2026-10-12T10:00:00Z', dueDate: '2026-10-12', onTime: true },
];

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
  if (url.endsWith('/homes/h1/rooms')) return json(200, ROOMS);
  if (url.includes('/homes/h1/dashboard')) return json(200, { rings: emptyRings, dueToday: [], doneToday: [] });
  if (url.includes('/homes/h1/tasks') && method === 'GET') return json(200, tasks);
  if (url.endsWith('/homes/h1/tasks') && method === 'POST') return json(201, { ...todayTask, id: 'new' });
  if (url.endsWith('/tasks/t1/history')) return json(200, history);
  if (url.includes('/tasks/t1/history')) return json(200, history);
  if (url.endsWith('/tasks/t1/mute') && method === 'PUT') detail = { ...detail, mutedByMe: JSON.parse(init!.body as string).muted };
    return json(200, detail);
  if (url.endsWith('/tasks/t1') && method === 'GET') return json(200, detail);
  if (url.endsWith('/tasks/t1') && method === 'PATCH') return json(200, detail);
  if (url.endsWith('/tasks/t1') && method === 'DELETE') return new Response(null, { status: 204 });
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
const press = async (name: string, role: 'button' | 'checkbox' | 'radio' | 'tab' = 'button') =>
  fireEvent.press(await screen.findByRole(role, { name }));

beforeEach(async () => {
  await AsyncStorage.clear();
  currentHomeStore.clear();
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-31T10:00:00Z'));
  tasks = [laterTask, weekTask, todayTask, late];
  detail = { ...late, rooms: [...late.rooms, { id: 'r2', name: 'Bedroom', icon: 'home' }], assigneeId: 'u2', reminderOffsets: [0, 840] };
  fetchMock.mockImplementation(defaultFetch);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => jest.restoreAllMocks());

describe('tasks list', () => {
  it('groups by due date with interval and room captions', async () => {
    await renderAt('/tasks');
    await screen.findByText('Wash the dishes');
    const headers = screen.getAllByRole('header').map((h) => h.props.children);
    expect(headers).toEqual(expect.arrayContaining(['Overdue', 'Today', 'This week', 'Later']));
    const order = screen.getAllByText(/Wash the dishes|Wipe the hob|Change the bed|Descale the kettle/).map((n) => n.props.children);
    expect(order).toEqual(['Wash the dishes', 'Wipe the hob', 'Change the bed', 'Descale the kettle']);
    expect(screen.getAllByText('Weekly · Kitchen')).toHaveLength(2);
    expect(screen.getByText('Every 2 weeks · Bedroom')).toBeTruthy();
    expect(screen.getByText('Monthly · Kitchen, Bedroom')).toBeTruthy();
  });

  it('shows rooms as sections under By room, multi-room tasks under each', async () => {
    await renderAt('/tasks');
    await screen.findByText('Wash the dishes');
    await press('By room', 'tab');
    expect(await screen.findAllByText('Monthly')).toHaveLength(2);
    expect(screen.queryByText('Weekly · Kitchen')).toBeNull();
    expect(screen.getAllByText('Descale the kettle')).toHaveLength(2);
    expect(screen.getAllByRole('header').map((h) => h.props.children)).toEqual(expect.arrayContaining(['Kitchen', 'Bedroom']));
    expect(calls(/tasks\?scope=all/).length).toBeGreaterThan(0);
  });

  it('asks for the mine scope', async () => {
    await renderAt('/tasks');
    await screen.findByText('Wash the dishes');
    await press('Mine', 'tab');
    await waitFor(() => expect(calls(/tasks\?scope=mine/).length).toBeGreaterThan(0));
  });

  it('ticks with the task due date', async () => {
    fetchMock.mockImplementation(async (url, init) =>
      /tasks\/t1\/complete$/.test(url)
        ? json(200, { task: late, rings: emptyRings, completion: { ...history[0], id: 'c9' } })
        : defaultFetch(url, init),
    );
    await renderAt('/tasks');
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Mark Wash the dishes done' }));
    await waitFor(() => expect(calls(/\/tasks\/t1\/complete$/, 'POST')).toHaveLength(1));
    expect(body(calls(/complete$/)[0]!)).toEqual({ dueDate: '2026-10-26' });
  });

  it('opens the editor from the add orb and a task from its row', async () => {
    await renderAt('/tasks');
    await press('Add a task');
    await waitFor(() => expect(app.getPathname()).toBe('/task-editor'));
    expect(await screen.findByText('New Task')).toBeTruthy();
  });

  it('opens a task', async () => {
    await renderAt('/tasks');
    await press('Wipe the hob');
    await waitFor(() => expect(app.getPathname()).toBe('/tasks/t2'));
  });

  it('shows an empty state', async () => {
    tasks = [];
    await renderAt('/tasks');
    expect(await screen.findByText('No tasks yet')).toBeTruthy();
  });
});

const fillName = async (text: string) => fireEvent.changeText(await screen.findByLabelText('Task name'), text);

describe('task editor', () => {
  it('blocks save without rooms and says why', async () => {
    await renderAt('/task-editor');
    await fillName('Mop');
    await press('Save task');
    expect(await screen.findByText('Pick at least one room')).toBeTruthy();
    expect(calls(/\/homes\/h1\/tasks$/, 'POST')).toHaveLength(0);
  });

  it('blocks save without a name', async () => {
    await renderAt('/task-editor');
    await press('Kitchen', 'checkbox');
    await press('Save task');
    expect(await screen.findByText('Give the task a name')).toBeTruthy();
    expect(calls(/\/homes\/h1\/tasks$/, 'POST')).toHaveLength(0);
  });

  it('creates a task with reminders as offsets', async () => {
    await renderAt('/task-editor');
    await fillName('Mop the floor');
    await press('Kitchen', 'checkbox');
    await press('Increase interval');
    await press('Week', 'radio');
    await press('At due time', 'checkbox');
    await press('The evening before', 'checkbox');
    await press('Save task');
    await waitFor(() => expect(calls(/\/homes\/h1\/tasks$/, 'POST')).toHaveLength(1));
    expect(body(calls(/\/homes\/h1\/tasks$/, 'POST')[0]!)).toEqual({
      name: 'Mop the floor',
      icon: 'sparkle',
      roomIds: ['r1'],
      intervalCount: 2,
      intervalUnit: 'week',
      reminderOffsets: [0, 840],
      assigneeId: null,
    });
  });

  it('edit mode sends only the changed fields', async () => {
    await renderAt('/task-editor?id=t1');
    const name = await screen.findByLabelText('Task name');
    await waitFor(() => expect(name.props.value).toBe('Wash the dishes'));
    await fireEvent.changeText(name, 'Wash up');
    await press('Save task');
    await waitFor(() => expect(calls(/\/tasks\/t1$/, 'PATCH')).toHaveLength(1));
    expect(body(calls(/\/tasks\/t1$/, 'PATCH')[0]!)).toEqual({ name: 'Wash up' });
  });

  it('archives after confirming', async () => {
    await renderAt('/task-editor?id=t1');
    await screen.findByDisplayValue('Wash the dishes');
    await press('More');
    await press('Archive task');
    expect(await screen.findByText('Archive this task?')).toBeTruthy();
    expect(calls(/\/tasks\/t1$/, 'DELETE')).toHaveLength(0);
    await press('Archive task');
    await waitFor(() => expect(calls(/\/tasks\/t1$/, 'DELETE')).toHaveLength(1));
  });
});

describe('task detail', () => {
  it('shows the facts and history with late and skipped entries', async () => {
    await renderAt('/tasks/t1');
    expect(await screen.findByText('Ana · 30 Oct · late')).toBeTruthy();
    expect(screen.getByText('Tilen · 20 Oct · skipped')).toBeTruthy();
    expect(screen.getByText('Ana · 12 Oct · on time')).toBeTruthy();
    expect(screen.getByText('Due 5 days ago')).toBeTruthy();
    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText('Kitchen, Bedroom')).toBeTruthy();
    expect(screen.getByText('At due time, The evening before')).toBeTruthy();
    expect(within(screen.getByTestId('screen-content')).getByText('Ana')).toBeTruthy();
  });

  it('mutes reminders for me', async () => {
    await renderAt('/tasks/t1');
    const toggle = await screen.findByRole('switch', { name: 'Remind me' });
    expect(toggle.props.value).toBe(true);
    await fireEvent(toggle, 'valueChange', false);
    await waitFor(() => expect(calls(/\/tasks\/t1\/mute$/, 'PUT')).toHaveLength(1));
    expect(body(calls(/mute$/)[0]!)).toEqual({ muted: true });
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Remind me' }).props.value).toBe(false));
  });

  it('opens the editor', async () => {
    await renderAt('/tasks/t1');
    await screen.findByText('Ana · 30 Oct · late');
    await press('Edit task');
    await waitFor(() => expect(app.getPathname()).toBe('/task-editor'));
  });
});
