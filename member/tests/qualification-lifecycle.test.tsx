import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { QualificationProvider, useQualification } from '../src/QualificationContext';
const getQualifications = vi.hoisted(() => vi.fn());
vi.mock('../src/memberData', () => ({ getQualifications }));
let tree: ReactTestRenderer | undefined;
const items = ['q1', 'q2'].map(id => ({ id, code: id, rank: 'ELITE', active: true, ballLabel: id }));
function Probe() { const s = useQualification(); return <><p>{s.loading ? 'loading' : s.error ?? s.current?.id ?? 'empty'}</p><button onClick={() => s.select('q2')}>switch</button><button onClick={s.retry}>retry</button></>; }
afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('loads and switches qualifications when selection storage is unavailable', async () => {
  vi.stubGlobal('sessionStorage', { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } });
  getQualifications.mockResolvedValue(items);
  await act(async () => { tree = create(<QualificationProvider><Probe /></QualificationProvider>); });
  expect(tree!.root.findByType('p').children).toEqual(['q1']);
  act(() => tree!.root.findAllByType('button')[0].props.onClick());
  expect(tree!.root.findByType('p').children).toEqual(['q2']);
});
it('aborts the qualification request when its provider unmounts', async () => {
  getQualifications.mockImplementation(() => new Promise(() => {}));
  await act(async () => { tree = create(<QualificationProvider><Probe /></QualificationProvider>); });
  const signal = getQualifications.mock.calls[0][0] as AbortSignal;
  expect(signal.aborted).toBe(false);
  act(() => tree!.unmount()); tree = undefined;
  expect(signal.aborted).toBe(true);
});
it('cancels the old attempt and ignores its late result after retry', async () => {
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
  let resolve!: (value: typeof items) => void;
  getQualifications.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce([items[1]]);
  await act(async () => { tree = create(<QualificationProvider><Probe /></QualificationProvider>); });
  const old = getQualifications.mock.calls[0][0] as AbortSignal;
  await act(async () => tree!.root.findAllByType('button')[1].props.onClick());
  expect(old.aborted).toBe(true);
  await act(async () => resolve([items[0]]));
  expect(tree!.root.findByType('p').children).toEqual(['q2']);
});
