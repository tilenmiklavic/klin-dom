import path from 'node:path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

const mockConfig = { apiUrl: 'http://api.test', authMode: 'supabase' as 'supabase' | 'dev' };
jest.mock('../src/config', () => ({ getConfig: () => mockConfig }));

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: () => [true, null] }));
jest.mock('@expo-google-fonts/geist/400Regular', () => ({ Geist_400Regular: 1 }));
jest.mock('@expo-google-fonts/geist/500Medium', () => ({ Geist_500Medium: 2 }));
jest.mock('@expo-google-fonts/geist/600SemiBold', () => ({ Geist_600SemiBold: 3 }));

// The Supabase adapter is the only thing mocked: everything above it (provider, gate, API client) is real.
type Listener = (token: string | null) => void;
const mockAuth: {
  token: string | null;
  listeners: Set<Listener>;
  setToken(token: string | null): void;
  [key: string]: any;
} = {
  token: null,
  listeners: new Set<Listener>(),
  setToken(token: string | null) {
    mockAuth.token = token;
    mockAuth.listeners.forEach((l) => l(token));
  },
  getAccessToken: jest.fn(async () => mockAuth.token),
  onChange: jest.fn((cb: Listener) => {
    mockAuth.listeners.add(cb);
    return () => mockAuth.listeners.delete(cb);
  }),
  refresh: jest.fn(async (): Promise<string | null> => null),
  signInWithGoogle: jest.fn(async () => {}),
  sendEmailCode: jest.fn(async (_email: string) => {}),
  verifyEmailCode: jest.fn(async (_email: string, _code: string) => {
    mockAuth.setToken('supabase-token');
  }),
  signOut: jest.fn(async () => {
    mockAuth.setToken(null);
  }),
};
jest.mock('../src/auth/supabase', () => ({ supabaseAuth: mockAuth }));

const user = { id: 'u1', displayName: 'Tilen', email: null };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let bootstrapResponses: Response[] = [];
const defaultFetch = async (url: string, _init?: RequestInit) => {
  if (url.endsWith('/me/bootstrap')) return bootstrapResponses.shift() ?? json(200, { user, homes: [] });
  if (url.endsWith('/dev/token')) return json(200, { token: 'dev-token' });
  return json(404, { error: { code: 'not_found', message: 'nope' } });
};
const fetchMock = jest.fn(defaultFetch);

const APP = path.resolve(__dirname, '../app');
// RNTL 14 renders asynchronously: the router helpers (getPathname...) live on the returned promise itself.
let app: ReturnType<typeof renderRouter>;
const renderApp = async (initialUrl = '/') => {
  app = renderRouter(APP, { initialUrl });
  await app;
};
const expectPath = (path: string) => waitFor(() => expect(app.getPathname()).toBe(path));
const homes = [{ id: 'h1', name: 'Home', role: 'owner' }];

beforeEach(async () => {
  await AsyncStorage.clear();
  mockConfig.authMode = 'supabase';
  mockAuth.token = null;
  mockAuth.listeners.clear();
  bootstrapResponses = [];
  jest.clearAllMocks();
  fetchMock.mockImplementation(defaultFetch);
  mockAuth.refresh.mockImplementation(async () => null);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('signed out', () => {
  it('shows Welcome with Google and email buttons, and no dev button in Supabase mode', async () => {
    await renderApp();
    expect(await screen.findByText('Let’s make home shine.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with email' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dev sign-in' })).toBeNull();
    expect(app.getPathname()).toBe('/welcome');
  });

  it('starts Google sign-in', async () => {
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(mockAuth.signInWithGoogle).toHaveBeenCalledTimes(1));
  });

  it('shows the Dev sign-in button in dev mode and signs in through the API', async () => {
    mockConfig.authMode = 'dev';
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Dev sign-in' }));
    await expectPath('/start');
    const call = fetchMock.mock.calls.find(([u]) => u.endsWith('/dev/token'))!;
    expect(JSON.parse(call[1]!.body as string)).toMatchObject({ sub: 'dev:dev' });
    expect(await AsyncStorage.getItem('klindom.devToken')).toBe('dev-token');
  });
});

describe('email code sign-in', () => {
  async function signInWithCode() {
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue with email' }));
    await fireEvent.changeText(await screen.findByLabelText('Email'), 'tilen@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(mockAuth.sendEmailCode).toHaveBeenCalledWith('tilen@example.com'));
    await fireEvent.changeText(await screen.findByLabelText('6-digit code'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(mockAuth.verifyEmailCode).toHaveBeenCalledWith('tilen@example.com', '123456'));
  }

  it('routes to onboarding when the user has no homes', async () => {
    await renderApp();
    await signInWithCode();
    await expectPath('/start');
  });

  it('routes to the tabs when the user has a home', async () => {
    bootstrapResponses = [json(200, { user, homes })];
    await renderApp();
    await signInWithCode();
    await expectPath('/');
    expect(screen.queryByText('Let’s make home shine.')).toBeNull();
  });

  it('can request a new code', async () => {
    await renderApp('/code?email=tilen%40example.com');
    await fireEvent.press(await screen.findByRole('button', { name: 'Send a new code' }));
    await waitFor(() => expect(mockAuth.sendEmailCode).toHaveBeenCalledWith('tilen@example.com'));
  });

  it('only enables Verify for a full 6-digit code', async () => {
    await renderApp('/code?email=tilen%40example.com');
    await fireEvent.changeText(await screen.findByLabelText('6-digit code'), '123');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));
    expect(mockAuth.verifyEmailCode).not.toHaveBeenCalled();
  });
});

describe('expired session (Review Focus 4)', () => {
  it('on a 401 refreshes exactly once and lands on Welcome when refresh fails', async () => {
    mockAuth.token = 'stale';
    bootstrapResponses = [json(401, { error: { code: 'unauthorized', message: 'Expired' } })];
    mockAuth.refresh.mockImplementation(async () => {
      mockAuth.setToken(null);
      return null;
    });
    await renderApp();
    expect(await screen.findByText('Let’s make home shine.')).toBeTruthy();
    expect(mockAuth.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.filter(([u]) => u.endsWith('/me/bootstrap'))).toHaveLength(1);
    expect(app.getPathname()).toBe('/welcome');
  });

  it('retries the request once with the new token when refresh succeeds', async () => {
    mockAuth.token = 'stale';
    bootstrapResponses = [json(401, { error: { code: 'unauthorized', message: 'Expired' } }), json(200, { user, homes })];
    mockAuth.refresh.mockImplementation(async () => {
      mockAuth.token = 'fresh';
      return 'fresh';
    });
    await renderApp();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u.endsWith('/me/bootstrap'))).toHaveLength(2));
    await expectPath('/');
    expect(mockAuth.refresh).toHaveBeenCalledTimes(1);
    const auths = fetchMock.mock.calls
      .filter(([u]) => u.endsWith('/me/bootstrap'))
      .map(([, init]) => (init!.headers as Record<string, string>)['Authorization']);
    expect(auths).toEqual(['Bearer stale', 'Bearer fresh']);
  });
});

describe('auth gate transitions', () => {
  it('never renders tab content after sign-out, and lands on Welcome', async () => {
    mockAuth.token = 'tok';
    bootstrapResponses = [json(200, { user, homes })];
    await renderApp();
    expect(await screen.findByText('Today')).toBeTruthy();
    await act(async () => {
      mockAuth.setToken(null);
    });
    // Synchronously after the status flip: the protected screen is hidden, not merely covered.
    expect(screen.queryByText('Today')).toBeNull();
    expect(await screen.findByText('Let’s make home shine.')).toBeTruthy();
    expect(app.getPathname()).toBe('/welcome');
  });

  it('shows an error state when bootstrap fails, retries, then routes to the tabs', async () => {
    mockAuth.token = 'tok';
    bootstrapResponses = [];
    const { ApiError } = jest.requireActual('@klindom/shared');
    let fail = true;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/me/bootstrap')) {
        if (fail) throw new ApiError(0, 'network', 'down');
        return json(200, { user, homes });
      }
      return json(404, {});
    });
    await renderApp();
    expect(await screen.findByText('Couldn’t reach KlinDom', undefined, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByText('Today')).toBeNull();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Today')).toBeTruthy();
    expect(screen.queryByText('Couldn’t reach KlinDom')).toBeNull();
    expect(app.getPathname()).toBe('/');
  });

  it('can sign out from the error state', async () => {
    mockAuth.token = 'tok';
    fetchMock.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }, { timeout: 5000 }));
    expect(await screen.findByText('Let’s make home shine.')).toBeTruthy();
  });
});

describe('pending invite', () => {
  it('survives sign-in and routes to the join screen', async () => {
    await renderApp('/join/ABC123');
    expect(await screen.findByText('Let’s make home shine.')).toBeTruthy();
    expect(await AsyncStorage.getItem('klindom.pendingInvite')).toBe('ABC123');
    await act(async () => mockAuth.setToken('supabase-token'));
    await expectPath('/join/ABC123');
  });
});
