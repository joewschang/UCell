import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApiClient, REQUEST_TIMEOUT_MS } from '../src/api';
import { SessionGuard } from '../src/session';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function pendingFetch() {
  let signal!: AbortSignal;
  const fetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
    signal = init.signal!;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  vi.stubGlobal('fetch', fetch);
  return { fetch, signal: () => signal };
}
it('times out a stalled request and permits an explicit retry without expiring the session', async () => {
  const pending = pendingFetch(); const guard = new SessionGuard(); const api = createApiClient(guard);
  const result = expect(api('/member/me')).rejects.toThrow('連線逾時');
  await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS); await result;
  expect(pending.signal().aborted).toBe(true); expect(guard.getSnapshot()).toBe(false);
  expect(pending.fetch).toHaveBeenCalledTimes(1); // No automatic retry, including writes.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":true}')));
  await expect(api('/member/me')).resolves.toEqual({ ok: true });
  expect(vi.getTimerCount()).toBe(0);
});
it('bounds response-body decoding as well as response headers', async () => {
  vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => Promise.resolve({ ok: true,
    json: () => new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(Error('body cancelled')))),
  })));
  const result = expect(createApiClient(new SessionGuard())('/member/me')).rejects.toThrow('連線逾時');
  await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS); await result;
  expect(vi.getTimerCount()).toBe(0);
});
it('preserves caller cancellation and removes its timeout', async () => {
  pendingFetch(); const caller = new AbortController();
  const result = expect(createApiClient(new SessionGuard())('/member/me', { signal: caller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  caller.abort(); await result; expect(vi.getTimerCount()).toBe(0);
});
it('preserves session expiry when it cancels a stalled request', async () => {
  pendingFetch(); const guard = new SessionGuard();
  const result = expect(createApiClient(guard)('/member/me')).rejects.toThrow('登入已失效');
  guard.expire(); await result; expect(vi.getTimerCount()).toBe(0);
});
it('removes timers after HTTP failures and does not retry a write', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('', { status: 503 })); vi.stubGlobal('fetch', fetch);
  await expect(createApiClient(new SessionGuard())('/future-write', { method: 'POST', body: '{}' })).rejects.toThrow('暫時無法讀取');
  expect(fetch).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
