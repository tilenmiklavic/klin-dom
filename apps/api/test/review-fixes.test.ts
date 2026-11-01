import { createApp } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import type { Db } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { getTestDb, resetDb, setupHomeWithRooms, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

const clock = new FixedClock(new Date('2026-10-31T09:00:00Z'));
const app = createApp(testDeps({ clock }));
beforeEach(() => clock.set(new Date('2026-10-31T09:00:00Z')));

async function dailyTask(a = app) {
  const ctx = await setupHomeWithRooms(a);
  const task = await (await ctx.owner.client.post(`/homes/${ctx.homeId}/tasks`, {
    name: 'Dishes', icon: 'dishes', roomIds: [ctx.kitchen.id], intervalCount: 1, intervalUnit: 'day',
  })).json();
  return { ...ctx, task };
}

it('a task completed twice in one day can still be completed the next day', async () => {
  const { owner, task } = await dailyTask();
  await owner.client.post(`/tasks/${task.id}/complete`, { dueDate: '2026-10-31' });
  await owner.client.post(`/tasks/${task.id}/complete`, { dueDate: '2026-11-01' });
  clock.set(new Date('2026-11-01T09:00:00Z'));
  const res = await owner.client.post(`/tasks/${task.id}/complete`, { dueDate: '2026-11-01' });
  expect(res.status).toBe(201);
  expect((await res.json()).task.nextDueDate).toBe('2026-11-02');
});

it('completing from a stale view after a skip completes the current occurrence', async () => {
  const { owner, task } = await dailyTask();
  await owner.client.post(`/tasks/${task.id}/skip`);
  const res = await owner.client.post(`/tasks/${task.id}/complete`, { dueDate: '2026-10-31' });
  expect(res.status).toBe(201);
  expect((await res.json()).completion.dueDate).toBe('2026-11-01');
});

it('a removed member cannot rejoin with an old invite, but can with a new one', async () => {
  const { owner, homeId } = await setupHomeWithRooms(app);
  const old = await (await owner.client.post(`/homes/${homeId}/invites`)).json();
  const ana = await signIn(app, 'ana', 'Ana');
  await ana.client.post(`/invites/${old.code}/accept`);
  const anas = await (await ana.client.post(`/homes/${homeId}/invites`)).json();
  await owner.client.del(`/homes/${homeId}/members/${ana.id}`);
  expect((await ana.client.post(`/invites/${old.code}/accept`)).status).toBe(404);
  expect((await app.request(`/invites/${anas.code}`)).status).toBe(404);
  clock.set(new Date('2026-10-31T10:00:00Z'));
  const fresh = await (await owner.client.post(`/homes/${homeId}/invites`)).json();
  expect((await ana.client.post(`/invites/${fresh.code}/accept`)).status).toBe(200);
});

it('editing a task does not revert a completion that landed meanwhile', async () => {
  const base = getTestDb();
  // Simulates a completion committing between PATCH's read and its write.
  let taskId = '';
  let armed = false;
  // Simulates a completion committing after PATCH loaded the task but before its transaction writes.
  const racing: Db = {
    query: (sql, params) => base.query(sql, params),
    tx: (fn) => {
      if (armed) {
        armed = false;
        return base
          .query(`update tasks set next_due_date = '2026-11-01' where id = $1`, [taskId])
          .then(() => base.tx(fn));
      }
      return base.tx(fn);
    },
    withAdvisoryLock: (key, fn) => base.withAdvisoryLock(key, fn),
  };
  const raceApp = createApp(testDeps({ clock, db: racing }));
  const { owner, task } = await dailyTask(raceApp);
  taskId = task.id;
  armed = true;
  const res = await owner.client.patch(`/tasks/${task.id}`, { name: 'Wash dishes' });
  expect(await res.json()).toMatchObject({ name: 'Wash dishes', nextDueDate: '2026-11-01' });
});

it('answers CORS preflight for the app origin', async () => {
  const res = await app.request('/homes', {
    method: 'OPTIONS',
    headers: { origin: 'http://localhost:8081', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' },
  });
  expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
  expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization');
});

it('requires an explicit opt-in for dev auth', () => {
  expect(() => loadConfig({ AUTH_MODE: 'dev', AUTH_DEV_SECRET: 's' })).toThrow(/ALLOW_DEV_AUTH/);
  expect(loadConfig({ AUTH_MODE: 'dev', AUTH_DEV_SECRET: 's', ALLOW_DEV_AUTH: 'true' }).AUTH_MODE).toBe('dev');
});

