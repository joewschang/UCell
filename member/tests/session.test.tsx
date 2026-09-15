import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApiClient } from '../src/api';
import { SessionGuard } from '../src/session';
import { SessionBoundary } from '../src/SessionBoundary';
let tree: ReactTestRenderer | undefined;
beforeEach(() => vi.stubGlobal('sessionStorage', { getItem: () => 'test-token', removeItem: vi.fn() }));
afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('unmounts sensitive views, clears owned keys and blocks new requests on 401', async () => {
  const guard = new SessionGuard(); const api = createApiClient(guard); const unmount = vi.fn();
  function Sensitive() { useEffect(() => unmount, []); return <p>private member data</p>; }
  await act(async () => { tree = create(<SessionBoundary guard={guard}><Sensitive /></SessionBoundary>); });
  const fetch = vi.fn().mockResolvedValue(new Response('', { status: 401 })); vi.stubGlobal('fetch', fetch);
  await act(async () => { await expect(api('/member/me')).rejects.toThrow('登入已失效'); });
  expect(JSON.stringify(tree!.toJSON())).not.toContain('private member data');
  expect(JSON.stringify(tree!.toJSON())).toContain('會員工作階段已失效');
  expect(unmount).toHaveBeenCalledOnce();
  for (const key of ['ucell_member_token', 'ucell_line_id_token', 'ucell_qualification_id']) expect(sessionStorage.removeItem).toHaveBeenCalledWith(key);
  await expect(api('/member/orders')).rejects.toThrow('登入已失效');
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('cancels parallel requests and rejects late successful responses after expiry', async () => {
  const guard = new SessionGuard(); const api = createApiClient(guard);
  let resolve!: (r: Response) => void; let signal!: AbortSignal;
  vi.stubGlobal('fetch', vi.fn((_path: string, init: RequestInit) => { signal = init.signal!; return new Promise(r => { resolve = r; }); }));
  const result = api('/slow'); const assertion = expect(result).rejects.toThrow('登入已失效');
  guard.expire(); expect(signal.aborted).toBe(true);
  resolve(new Response(JSON.stringify({ name: 'old member' })));
  await assertion;
});
it('rejects a response whose JSON finishes after expiry', async () => {
  const guard = new SessionGuard(); const api = createApiClient(guard);
  let resolve!: (value: unknown) => void;
  const json = vi.fn(() => new Promise(r => { resolve = r; }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json }));
  const result = api('/slow-body'); const assertion = expect(result).rejects.toThrow('登入已失效');
  await Promise.resolve(); guard.expire(); resolve({ private: 'old' }); await assertion;
});
it('does not terminate the session on 403', async () => {
  const guard = new SessionGuard();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
  await expect(createApiClient(guard)('/denied')).rejects.toThrow('無權');
  expect(guard.getSnapshot()).toBe(false);
});
it('locks even if browser storage is unavailable, and notifies once', () => {
  vi.stubGlobal('sessionStorage', { removeItem() { throw Error('blocked'); } });
  const guard = new SessionGuard(); const notify = vi.fn(); guard.subscribe(notify);
  expect(() => { guard.expire(); guard.expire(); }).not.toThrow();
  expect(notify).toHaveBeenCalledOnce(); expect(guard.getSnapshot()).toBe(true);
});
it('rejects malformed JSON without exposing server text', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>internal error</html>')));
  await expect(createApiClient(new SessionGuard())('/data')).rejects.toThrow('資料格式異常');
});
it('preserves caller abort and stops already aborted requests before network access', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const c = new AbortController(); c.abort();
  await expect(createApiClient(new SessionGuard())('/data', { signal: c.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetch).not.toHaveBeenCalled();
});
