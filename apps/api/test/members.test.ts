import { createApp } from '../src/app.js';
import { resetDb, setupHome, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

const app = createApp(testDeps());

it('GET /homes/:id/members/me returns defaults', async () => {
  const { owner, homeId } = await setupHome(app);
  const res = await owner.client.get(`/homes/${homeId}/members/me`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ notificationsEnabled: true, defaultReminderTime: '08:00' });
});

it('PATCH updates and returns settings', async () => {
  const { owner, homeId } = await setupHome(app);
  const res = await owner.client.patch(`/homes/${homeId}/members/me`, { defaultReminderTime: '07:30' });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ notificationsEnabled: true, defaultReminderTime: '07:30' });
  const off = await owner.client.patch(`/homes/${homeId}/members/me`, { notificationsEnabled: false });
  expect(await off.json()).toEqual({ notificationsEnabled: false, defaultReminderTime: '07:30' });
});

it("PATCH rejects '7:30'", async () => {
  const { owner, homeId } = await setupHome(app);
  expect((await owner.client.patch(`/homes/${homeId}/members/me`, { defaultReminderTime: '7:30' })).status).toBe(400);
});

it('non-member gets 404', async () => {
  const { homeId } = await setupHome(app);
  const stranger = await signIn(app, 'stranger');
  expect((await stranger.client.get(`/homes/${homeId}/members/me`)).status).toBe(404);
  expect((await stranger.client.patch(`/homes/${homeId}/members/me`, { notificationsEnabled: false })).status).toBe(404);
});
