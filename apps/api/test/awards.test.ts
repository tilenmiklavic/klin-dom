import { createApp } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import { evaluateAwards } from '../src/jobs/awards.js';
import { addMember, getTestDb, insertTask, resetDb, setupHome, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

const clock = new FixedClock(new Date('2026-10-31T09:00:00Z'));
const app = createApp(testDeps({ clock }));

type Award = { kind: string; userId: string | null; userName: string | null };
const dashboard = async (client: { get(p: string): Promise<Response> }, homeId: string) =>
  (await (await client.get(`/homes/${homeId}/dashboard`)).json()) as { newAwards: Award[] };
const kinds = (a: Award[]) => a.map((x) => x.kind).sort();

it('first completion earns first_task for that user, shown once in newAwards, gone after /awards/seen', async () => {
  const { owner, homeId } = await setupHome(app);
  const taskId = await insertTask(homeId, owner.id);
  expect((await dashboard(owner.client, homeId)).newAwards).toEqual([]);

  clock.set(new Date('2026-10-31T09:05:00Z'));
  expect((await owner.client.post(`/tasks/${taskId}/complete`, {})).status).toBe(201);
  const dash = await dashboard(owner.client, homeId);
  expect(dash.newAwards.find((a) => a.kind === 'first_task')).toMatchObject({ userId: owner.id, userName: 'Tilen' });

  expect((await owner.client.post(`/homes/${homeId}/awards/seen`)).status).toBe(204);
  expect((await dashboard(owner.client, homeId)).newAwards).toEqual([]);
});

it("another member sees household awards but not someone else's personal one", async () => {
  const { owner, homeId } = await setupHome(app);
  const ana = await signIn(app, 'ana', 'Ana');
  await addMember(homeId, ana.id);
  const taskId = await insertTask(homeId, owner.id);
  await owner.client.post(`/tasks/${taskId}/complete`, {});
  const kindsForAna = kinds((await dashboard(ana.client, homeId)).newAwards);
  expect(kindsForAna).not.toContain('first_task');
  expect(kindsForAna).toContain('all_fresh');
});

it('evaluating twice inserts nothing new', async () => {
  const { owner, homeId } = await setupHome(app);
  const taskId = await insertTask(homeId, owner.id);
  await owner.client.post(`/tasks/${taskId}/complete`, {});
  await evaluateAwards(getTestDb(), homeId, clock.now());
  expect(await evaluateAwards(getTestDb(), homeId, clock.now())).toBe(0);
});

it('all_fresh when every task is fresh', async () => {
  const { owner, homeId } = await setupHome(app);
  await insertTask(homeId, owner.id, { nextDueDate: '2026-11-05' });
  expect(await evaluateAwards(getTestDb(), homeId, clock.now())).toBe(1);
  const [row] = await getTestDb().query<{ kind: string; user_id: string | null }>('select kind, user_id from awards');
  expect(row).toEqual({ kind: 'all_fresh', user_id: null });
});

it("history returns the month's daily_rings and today's live ring", async () => {
  const { owner, homeId } = await setupHome(app);
  await insertTask(homeId, owner.id, { nextDueDate: '2026-10-31' });
  await getTestDb().query(
    `insert into daily_rings (home_id, date, today_done, today_total, closed, week_done, week_total, fresh_pct) values
     ($1, '2026-10-30', 2, 2, true, 2, 5, 100), ($1, '2026-10-29', 1, 3, false, 1, 5, 80), ($1, '2026-09-30', 1, 1, true, 1, 1, 100)`,
    [homeId],
  );
  const res = await owner.client.get(`/homes/${homeId}/history?month=2026-10`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    month: '2026-10',
    days: [
      { date: '2026-10-29', done: 1, total: 3, closed: false },
      { date: '2026-10-30', done: 2, total: 2, closed: true },
    ],
    today: { date: '2026-10-31', done: 0, total: 1 },
    awards: [],
  });
});

it('history month=2026-13 → 400', async () => {
  const { owner, homeId } = await setupHome(app);
  expect((await owner.client.get(`/homes/${homeId}/history?month=2026-13`)).status).toBe(400);
  expect((await owner.client.get(`/homes/${homeId}/history`)).status).toBe(400);
});

it("a removed member's award shows userName \"Former member\"", async () => {
  const { owner, homeId } = await setupHome(app);
  const ana = await signIn(app, 'ana', 'Ana');
  await addMember(homeId, ana.id);
  await getTestDb().query(`insert into awards (home_id, user_id, kind) values ($1, $2, 'first_task')`, [homeId, ana.id]);
  await getTestDb().query('delete from home_members where home_id = $1 and user_id = $2', [homeId, ana.id]);
  const res = await owner.client.get(`/homes/${homeId}/history?month=2026-10`);
  const body = (await res.json()) as { awards: Award[] };
  expect(body.awards).toMatchObject([{ kind: 'first_task', userId: ana.id, userName: 'Former member' }]);
});
