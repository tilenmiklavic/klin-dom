import { ApiError, createApiClient } from '../src/client.js';

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift()!;
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { calls, impl };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const unauthorized = () => json(401, { error: { code: 'unauthorized', message: 'Expired' } });

const header = (c: Call, name: string) => (c.init.headers as Record<string, string>)[name];

it('sends the bearer token and a JSON body', async () => {
  const f = fakeFetch([json(201, { id: 'h1' })]);
  const api = createApiClient({ baseUrl: 'http://api', getToken: async () => 'tok', fetchImpl: f.impl });
  await api.createHome({ name: 'Home', timezone: 'Europe/Ljubljana' });
  expect(f.calls[0]!.url).toBe('http://api/homes');
  expect(f.calls[0]!.init.method).toBe('POST');
  expect(header(f.calls[0]!, 'Authorization')).toBe('Bearer tok');
  expect(header(f.calls[0]!, 'Content-Type')).toBe('application/json');
  expect(JSON.parse(f.calls[0]!.init.body as string)).toEqual({ name: 'Home', timezone: 'Europe/Ljubljana' });
});

it('omits Authorization when there is no token', async () => {
  const f = fakeFetch([json(200, { homeName: 'H', inviterName: 'T' })]);
  const api = createApiClient({ baseUrl: 'http://api', getToken: async () => null, fetchImpl: f.impl });
  await api.previewInvite('abc');
  expect(header(f.calls[0]!, 'Authorization')).toBeUndefined();
});

it('posts the due date when completing a task', async () => {
  const f = fakeFetch([json(201, {})]);
  const api = createApiClient({ baseUrl: 'http://api', getToken: async () => 't', fetchImpl: f.impl });
  await api.completeTask('t1', '2026-10-31');
  expect(f.calls[0]!.url).toBe('http://api/tasks/t1/complete');
  expect(f.calls[0]!.init.body).toBe('{"dueDate":"2026-10-31"}');
});

it('builds query strings and returns undefined for 204', async () => {
  const f = fakeFetch([json(200, []), json(200, {}), new Response(null, { status: 204 })]);
  const api = createApiClient({ baseUrl: 'http://api', getToken: async () => 't', fetchImpl: f.impl });
  await api.listTasks('h1', { scope: 'mine', roomId: 'r1' });
  await api.stats('h1', 'custom', '2026-10-01', '2026-10-31');
  expect(await api.archiveTask('t1')).toBeUndefined();
  expect(f.calls[0]!.url).toBe('http://api/homes/h1/tasks?scope=mine&roomId=r1');
  expect(f.calls[1]!.url).toBe('http://api/homes/h1/stats?range=custom&from=2026-10-01&to=2026-10-31');
  expect(f.calls[2]!.init.method).toBe('DELETE');
});

it('throws ApiError with the code from the body', async () => {
  const f = fakeFetch([json(409, { error: { code: 'transfer_required', message: 'Hand over first' } })]);
  const api = createApiClient({ baseUrl: 'http://api', getToken: async () => 't', fetchImpl: f.impl });
  const err = await api.deleteMe().catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status: 409, code: 'transfer_required', message: 'Hand over first' });
});

it('on 401 calls onUnauthorized once and retries with the fresh token', async () => {
  const f = fakeFetch([unauthorized(), json(200, { user: {}, homes: [] })]);
  let token = 'old';
  const onUnauthorized = vi.fn(async () => {
    token = 'new';
    return true;
  });
  const api = createApiClient({ baseUrl: 'http://api', getToken: async () => token, onUnauthorized, fetchImpl: f.impl });
  await expect(api.bootstrap()).resolves.toEqual({ user: {}, homes: [] });
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
  expect(f.calls).toHaveLength(2);
  expect(header(f.calls[0]!, 'Authorization')).toBe('Bearer old');
  expect(header(f.calls[1]!, 'Authorization')).toBe('Bearer new');
});

it('throws 401 without retrying when onUnauthorized returns false', async () => {
  const f = fakeFetch([unauthorized()]);
  const onUnauthorized = vi.fn(async () => false);
  const api = createApiClient({ baseUrl: 'http://api', getToken: async () => 't', onUnauthorized, fetchImpl: f.impl });
  await expect(api.bootstrap()).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
  expect(f.calls).toHaveLength(1);
});

it('does not loop when the retry also returns 401', async () => {
  const f = fakeFetch([unauthorized(), unauthorized()]);
  const onUnauthorized = vi.fn(async () => true);
  const api = createApiClient({ baseUrl: 'http://api', getToken: async () => 't', onUnauthorized, fetchImpl: f.impl });
  await expect(api.bootstrap()).rejects.toMatchObject({ status: 401 });
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
  expect(f.calls).toHaveLength(2);
});

it('maps a network failure to ApiError 0 network', async () => {
  const f = fakeFetch([new TypeError('Failed to fetch')]);
  const api = createApiClient({ baseUrl: 'http://api', getToken: async () => 't', fetchImpl: f.impl });
  await expect(api.bootstrap()).rejects.toMatchObject({ status: 0, code: 'network' });
});

it('mints a dev token without an Authorization header', async () => {
  const f = fakeFetch([json(200, { token: 'jwt' })]);
  const api = createApiClient({ baseUrl: 'http://api', getToken: async () => null, fetchImpl: f.impl });
  await expect(api.devToken({ sub: 'dev:tilen', name: 'Tilen' })).resolves.toEqual({ token: 'jwt' });
  expect(f.calls[0]!.url).toBe('http://api/dev/token');
  expect(f.calls[0]!.init.method).toBe('POST');
  expect(header(f.calls[0]!, 'Authorization')).toBeUndefined();
  expect(JSON.parse(f.calls[0]!.init.body as string)).toEqual({ sub: 'dev:tilen', name: 'Tilen' });
});
