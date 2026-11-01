import path from 'node:path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

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

const historyFor = (month: string) => ({
  month,
  days: month === '2026-10' ? [{ date: '2026-10-05', done: 4, total: 4, closed: true }, { date: '2026-10-31', done: 0, total: 9, closed: false }] : [],
  today: { date: '2026-10-31', done: 3, total: 9 },
  awards: [
    { id: 'a1', kind: 'streak_7', userId: null, userName: null, earnedAt: '2026-10-20T08:00:00.000Z' },
    { id: 'a2', kind: 'first_task', userId: 'u2', userName: 'Ana', earnedAt: '2026-10-02T08:00:00.000Z' },
    { id: 'a3', kind: 'tasks_100', userId: 'u2', userName: 'Ana', earnedAt: '2026-10-14T23:30:00.000Z' },
  ],
});

const fetchMock = jest.fn(async (url: string) => {
  if (url.endsWith('/me/bootstrap')) {
    return json(200, { user: { id: 'u1', displayName: 'Tilen', email: null }, homes: [{ id: 'h1', name: 'Maple', role: 'owner' }] });
  }
  if (url.endsWith('/homes/h1')) return json(200, { id: 'h1', name: 'Maple', timezone: 'Europe/Ljubljana', ownerId: 'u1', role: 'owner' });
  if (url.endsWith('/homes/h1/stats') || url.includes('/homes/h1/stats?')) return json(200, { from: '', to: '', total: 0, perMember: [], perRoom: [] });
  const h = url.match(/\/homes\/h1\/history\?month=(\d{4}-\d{2})/);
  if (h) return json(200, historyFor(h[1]!));
  return json(404, { error: { code: 'not_found', message: 'nope' } });
});
const historyCalls = () => fetchMock.mock.calls.filter(([u]) => u.includes('/history?')).map(([u]) => u.match(/month=([\d-]+)/)![1]);

const APP = path.resolve(__dirname, '../app');
let app: ReturnType<typeof renderRouter>;

beforeEach(async () => {
  await AsyncStorage.clear();
  currentHomeStore.clear();
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-31T10:00:00Z'));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => jest.restoreAllMocks());

const renderAwards = async () => {
  app = renderRouter(APP, { initialUrl: '/profile/awards' });
  await app;
};

describe('awards and history screen', () => {
  it('is reachable from the profile Home group', async () => {
    app = renderRouter(APP, { initialUrl: '/profile' });
    await app;
    await fireEvent.press(await screen.findByRole('button', { name: 'Awards & history' }));
    await waitFor(() => expect(app.getPathname()).toBe('/profile/awards'));
  });

  it('renders one small ring per day, Monday-first, with the live ring for today', async () => {
    await renderAwards();
    await screen.findByText('October 2026');
    expect(await screen.findAllByLabelText(/^\d+ Oct, /)).toHaveLength(31);
    expect(screen.getAllByTestId('calendar-blank')).toHaveLength(3); // 1 Oct 2026 is a Thursday
    const weekdays = screen.getAllByTestId('calendar-weekday').map((n) => n.props.children);
    expect(weekdays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(screen.getByLabelText('5 Oct, 4 of 4 done')).toBeTruthy();
    // Today uses the live numbers (3 of 9), not the stored row (0 of 9).
    expect(screen.getByLabelText('31 Oct, 3 of 9 done')).toBeTruthy();
    expect(screen.getByLabelText('1 Oct, no tasks')).toBeTruthy();
  });

  it('prev/next month navigates and refetches', async () => {
    await renderAwards();
    await screen.findByText('October 2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await screen.findByText('September 2026');
    await waitFor(() => expect(historyCalls()).toContain('2026-09'));
    expect(await screen.findAllByLabelText(/^\d+ Sep/)).toHaveLength(30);
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await screen.findByText('October 2026');
  });

  it('disables next on the current month', async () => {
    await renderAwards();
    await screen.findByText('October 2026');
    const next = screen.getByRole('button', { name: 'Next month' });
    expect(next.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(next);
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(historyCalls()).not.toContain('2026-11');
  });

  it('lists earned awards with who and when, and unearned ones as Not yet', async () => {
    await renderAwards();
    await screen.findByText('7-day streak');
    expect(screen.getByText('20 Oct')).toBeTruthy();
    expect(screen.getByText('First task done')).toBeTruthy();
    expect(screen.getByText('Ana · 2 Oct')).toBeTruthy();
    // 23:30Z on the 14th is already the 15th in Ljubljana.
    expect(screen.getByText('Ana · 15 Oct')).toBeTruthy();
    // Three kinds are still unearned.
    expect(screen.getAllByText('Not yet')).toHaveLength(3);
    expect(screen.getByText('30-day streak')).toBeTruthy();
  });
});
