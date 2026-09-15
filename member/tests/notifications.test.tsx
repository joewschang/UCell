import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import Notifications from '../src/Notifications';
import { NotificationProvider, useNotifications, visibleNotices } from '../src/NotificationContext';
let tree: ReactTestRenderer;
let state: ReturnType<typeof useNotifications>;
const q1 = { id: 'q1', code: 'Q1', rank: 'ELITE', active: true, ballLabel: '球1' };
function Probe({ q }: { q: string }) { state = useNotifications(q); return null; }
const shell = (q = 'q1', enabled = true) => <MemoryRouter><NotificationProvider enabled={enabled}><Notifications key={q} q={{ ...q1, id: q, code: q }}/><Probe q={q}/></NotificationProvider></MemoryRouter>;
async function mount(q = 'q1', enabled = true) { await act(async () => { tree = create(shell(q, enabled)); }); }
afterEach(() => { if (tree) act(() => tree.unmount()); vi.unstubAllGlobals(); });
const button = (label: string) => tree.root.findAllByType('button').find(b => b.children.join('') === label)!;
it('shows Person notices plus only the selected qualification', () => {
  expect(visibleNotices('q1').map(n => n.id)).toEqual(['demo-welcome', 'demo-order-q1']);
  expect(visibleNotices('q2').map(n => n.id)).toEqual(['demo-welcome', 'demo-account-q2']);
  expect(visibleNotices(undefined)).toEqual([]);
});
it('marks one notification once without changing another', async () => {
  await mount();
  act(() => { state.markRead('q1', ['demo-order-q1']); state.markRead('q1', ['demo-order-q1']); });
  expect(state.unread).toBe(1); expect(state.readIds.size).toBe(1);
});
it('rejects a foreign notification batch atomically', async () => {
  await mount();
  expect(() => state.markRead('q1', ['demo-welcome', 'demo-account-q2'])).toThrow('不屬於');
  expect(state.unread).toBe(2); expect(state.readIds.size).toBe(0);
});
it('shares Person-wide read state but isolates qualification-specific read state', async () => {
  await mount();
  act(() => state.markRead('q1', ['demo-welcome', 'demo-order-q1']));
  await act(async () => tree.update(shell('q2')));
  expect(state.unread).toBe(1);
  expect(JSON.stringify(tree.toJSON())).not.toContain('訂單狀態查看提醒');
});
it('filters unread/category and shows an empty state', async () => {
  await mount();
  act(() => tree.root.findByType('select').props.onChange({ target: { value: 'ACCOUNT' } }));
  expect(JSON.stringify(tree.toJSON())).toContain('目前篩選條件下沒有通知');
  act(() => tree.root.findByType('select').props.onChange({ target: { value: 'ALL' } }));
  act(() => button('只看未讀').props.onClick());
  act(() => button('目前範圍全部標為已讀（示範）').props.onClick());
  expect(state.unread).toBe(0);
  expect(button('目前範圍全部標為已讀（示範）').props.disabled).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('目前篩選條件下沒有通知');
});
it('expands safely without marking read automatically', async () => {
  await mount(); act(() => button('查看通知').props.onClick());
  expect(JSON.stringify(tree.toJSON())).toContain('不是公司正式公告');
  expect(state.unread).toBe(2);
  act(() => button('收合通知').props.onClick());
  expect(JSON.stringify(tree.toJSON())).not.toContain('不是公司正式公告');
});
it('resets demo read state when the provider is unmounted', async () => {
  await mount(); act(() => state.markRead('q1', ['demo-welcome']));
  act(() => tree.unmount()); await mount(); expect(state.unread).toBe(2);
});
it('does not perform network or storage writes in demo mode', async () => {
  const write = vi.fn(() => { throw Error('Unexpected write'); });
  vi.stubGlobal('fetch', write); vi.stubGlobal('sessionStorage', { setItem: write }); vi.stubGlobal('localStorage', { setItem: write });
  await mount(); act(() => state.markRead('q1', ['demo-welcome'])); expect(write).not.toHaveBeenCalled();
});
it('does not show mock unread counts or allow mutations in real mode', async () => {
  await mount('q1', false);
  expect(state.notices).toEqual([]);
  expect(() => state.markRead('q1', ['demo-welcome'])).toThrow('尚未串接');
  expect(JSON.stringify(tree.toJSON())).toContain('尚無法確認未讀數量');
  expect(tree.root.findAllByType('button')).toHaveLength(0);
});
