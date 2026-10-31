import { createApp } from '../src/app.js';
import { generateInviteCode } from '../src/repo/invites.js';
import { getTestDb, resetDb, setupHome, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

const app = createApp(testDeps());

async function createInvite() {
  const ctx = await setupHome(app);
  const res = await ctx.owner.client.post(`/homes/${ctx.homeId}/invites`);
  return { ...ctx, res, invite: await res.json() };
}

it('generates human-typable codes', () => {
  for (let i = 0; i < 50; i++) expect(generateInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
});

it('creates an invite with a share link', async () => {
  const { res, invite } = await createInvite();
  expect(res.status).toBe(201);
  expect(invite.url).toBe(`http://localhost:8081/join/${invite.code}`);
});

it('previews an invite without signing in', async () => {
  const { invite } = await createInvite();
  const res = await app.request(`/invites/${invite.code}`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ homeName: 'Miklavič home', inviterName: 'Tilen' });
});

it('joins a home as a member, ignoring case and dash', async () => {
  const { homeId, invite } = await createInvite();
  const ana = await signIn(app, 'ana', 'Ana');
  const res = await ana.client.post(`/invites/${invite.code.replace('-', '').toLowerCase()}/accept`);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ id: homeId, role: 'member' });
});

it('accepting twice keeps one membership', async () => {
  const { homeId, invite } = await createInvite();
  const ana = await signIn(app, 'ana', 'Ana');
  await ana.client.post(`/invites/${invite.code}/accept`);
  expect((await ana.client.post(`/invites/${invite.code}/accept`)).status).toBe(200);
  const [row] = await getTestDb().query<{ count: string }>(
    'select count(*) from home_members where home_id = $1 and user_id = $2',
    [homeId, ana.id],
  );
  expect(row!.count).toBe('1');
});

it('lists active invites for members', async () => {
  const { owner, homeId, invite } = await createInvite();
  const list = await (await owner.client.get(`/homes/${homeId}/invites`)).json();
  expect(list.map((i: { code: string }) => i.code)).toEqual([invite.code]);
});

it('revoked invites no longer preview or accept', async () => {
  const { owner, invite } = await createInvite();
  expect((await owner.client.del(`/invites/${invite.id}`)).status).toBe(204);
  expect((await app.request(`/invites/${invite.code}`)).status).toBe(404);
  const ana = await signIn(app, 'ana', 'Ana');
  expect((await ana.client.post(`/invites/${invite.code}/accept`)).status).toBe(404);
});

it('a member of another home cannot revoke', async () => {
  const { invite } = await createInvite();
  const stranger = await signIn(app, 'stranger');
  expect((await stranger.client.del(`/invites/${invite.id}`)).status).toBe(404);
});
