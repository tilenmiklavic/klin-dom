import webpush from 'web-push';
import { webPushNotifier } from '../src/push/notifier.js';

vi.mock('web-push', () => ({ default: { sendNotification: vi.fn() } }));

const send = vi.mocked(webpush.sendNotification);
const notifier = webPushNotifier({ publicKey: 'pub', privateKey: 'priv', subject: 'mailto:a@b.si' });
const target = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: 'p', auth: 'a' };
const payload = { title: 'Dishes is due today', body: '', url: '/tasks/1', tag: 't' };

beforeEach(() => send.mockReset());

it('passes a send timeout so a silent push service cannot hold the job lock', async () => {
  send.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
  expect(await notifier.send(target, payload)).toBe('ok');
  expect(send.mock.calls[0]![2]).toMatchObject({ timeout: 10_000 });
});

it('a timeout is an error, 404/410 mean gone', async () => {
  send.mockRejectedValueOnce(new Error('Socket timeout'));
  expect(await notifier.send(target, payload)).toBe('error');
  send.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));
  expect(await notifier.send(target, payload)).toBe('gone');
});
