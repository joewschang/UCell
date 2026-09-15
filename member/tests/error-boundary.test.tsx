import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from '../src/AppErrorBoundary';
import { SessionGuard } from '../src/session';
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {}); // Expected React test diagnostics only.
  vi.stubGlobal('sessionStorage', { removeItem: vi.fn() });
});
afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Broken(): never { throw Error('private-token-and-stack'); }
it('renders healthy content without invalidating the session', () => {
  const guard = new SessionGuard();
  act(() => { tree = create(<AppErrorBoundary guard={guard}><p>healthy</p></AppErrorBoundary>); });
  expect(tree!.root.findByType('p').children).toEqual(['healthy']);
  expect(guard.getSnapshot()).toBe(false);
});
it('unmounts private views, aborts requests and hides exception details after a render failure', () => {
  const guard = new SessionGuard(); const controller = new AbortController(); guard.register(controller);
  const unmount = vi.fn();
  function Private() { useEffect(() => unmount, []); return <p>private draft</p>; }
  act(() => { tree = create(<AppErrorBoundary guard={guard}><Private /></AppErrorBoundary>); });
  act(() => tree!.update(<AppErrorBoundary guard={guard}><Private /><Broken /></AppErrorBoundary>));
  expect(unmount).toHaveBeenCalledOnce(); expect(controller.signal.aborted).toBe(true);
  expect(guard.getSnapshot()).toBe(true);
  const rendered = JSON.stringify(tree!.toJSON());
  expect(rendered).toContain('會員畫面暫時無法顯示');
  expect(rendered).not.toContain('private');
  expect(sessionStorage.removeItem).toHaveBeenCalledTimes(3);
});
it('keeps recovery available even when storage cleanup fails and reloads only on click', () => {
  vi.stubGlobal('sessionStorage', { removeItem() { throw Error('blocked'); } });
  const reload = vi.fn(); vi.stubGlobal('window', { location: { reload } });
  act(() => { tree = create(<AppErrorBoundary guard={new SessionGuard()}><Broken /></AppErrorBoundary>); });
  expect(reload).not.toHaveBeenCalled();
  act(() => tree!.root.findByType('button').props.onClick());
  expect(reload).toHaveBeenCalledOnce();
});
