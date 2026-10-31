import { SuggestionCatalog } from '@klindom/shared';
import { createApp } from '../src/app.js';
import { catalog } from '../src/suggestions.js';
import { resetDb, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

const app = createApp(testDeps());

it('ships a valid catalog covering the spec rooms', () => {
  expect(SuggestionCatalog.safeParse(catalog).success).toBe(true);
  expect(catalog.rooms.map((r) => r.name)).toEqual([
    'Kitchen', 'Bathroom', 'Bedroom', 'Living room', 'Hallway', 'Balcony', 'Office', 'Laundry room',
  ]);
  expect(catalog.sharedTasks.map((t) => t.name)).toEqual(expect.arrayContaining(['Vacuum', 'Mop floors']));
});

it('serves the catalog to signed-in users', async () => {
  const user = await signIn(app, 'u1');
  const res = await user.client.get('/suggestions');
  expect(res.status).toBe(200);
  expect((await res.json()).rooms).toHaveLength(8);
});

it('creates a home from picked suggestions', async () => {
  const owner = await signIn(app, 'owner', 'Tilen');
  const home = await (await owner.client.post('/homes', {
    name: 'Home',
    timezone: 'Europe/Ljubljana',
    suggestions: {
      rooms: [{ key: 'kitchen', count: 1 }, { key: 'bedroom', count: 2 }],
      taskKeys: ['kitchen.dishes', 'bedroom.bedsheets', 'shared.vacuum'],
    },
  })).json();
  const rooms = await (await owner.client.get(`/homes/${home.id}/rooms`)).json();
  expect(rooms.map((r: { name: string }) => r.name)).toEqual(['Kitchen', 'Bedroom', 'Bedroom 2']);
  const tasks: { name: string; rooms: { name: string }[]; nextDueDate: string }[] =
    await (await owner.client.get(`/homes/${home.id}/tasks`)).json();
  const summary = tasks.map((t) => [t.name, t.rooms.map((r) => r.name).join('+')]).sort();
  expect(summary).toEqual([
    ['Change bedsheets', 'Bedroom'],
    ['Change bedsheets', 'Bedroom 2'],
    ['Dishes', 'Kitchen'],
    ['Vacuum', 'Bedroom+Bedroom 2'],
  ]);
  expect(tasks.every((t) => t.nextDueDate === '2026-10-31')).toBe(true);
});

it('rejects an unknown room key', async () => {
  const owner = await signIn(app, 'owner');
  const res = await owner.client.post('/homes', {
    name: 'Home', timezone: 'Europe/Ljubljana', suggestions: { rooms: [{ key: 'dungeon', count: 1 }], taskKeys: [] },
  });
  expect(res.status).toBe(400);
});
