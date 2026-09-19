import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach,beforeEach, expect, it, vi } from 'vitest';
import { QualificationProvider, useQualification } from '../src/QualificationContext';
const getQualifications = vi.hoisted(() => vi.fn());
const selectQualification=vi.hoisted(()=>vi.fn());
const getPerson=vi.hoisted(()=>vi.fn());
vi.mock('../src/memberData', () => ({ getQualifications,selectQualification,getPerson }));
beforeEach(()=>{selectQualification.mockImplementation(async q=>q);getPerson.mockResolvedValue({memberNo:'2609000001'});});
let tree: ReactTestRenderer | undefined;
const items = ['q1', 'q2'].map(id => ({ id, code: id, rank: 'ELITE', active: true, ballLabel: id }));
function Probe() { const s = useQualification(); return <><p>{s.loading ? 'loading' : s.error ?? s.current?.id ?? 'empty'}</p><button onClick={() => s.select('q2')}>switch</button><button onClick={s.retry}>retry</button></>; }
function IdentityProbe(){const s=useQualification();return <p>{s.memberNoStatus==='available'?s.memberNo:'unavailable'}</p>;}
afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('loads and switches qualifications when selection storage is unavailable', async () => {
  vi.stubGlobal('sessionStorage', { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } });
  getQualifications.mockResolvedValue(items);
  await act(async () => { tree = create(<QualificationProvider><Probe /></QualificationProvider>); });
  expect(tree!.root.findByType('p').children).toEqual(['q1']);
  await act(async () => tree!.root.findAllByType('button')[0].props.onClick());
  expect(tree!.root.findByType('p').children).toEqual(['q2']);
});
it('keeps the verified own member number in shared member context',async()=>{
 getQualifications.mockResolvedValue(items);
 getPerson.mockResolvedValue({memberNo:'2609000001'});
 await act(async()=>{tree=create(<QualificationProvider><IdentityProbe/></QualificationProvider>);});
 expect(tree!.root.findByType('p').children).toEqual(['2609000001']);
});
it('hides scoped data during server validation and fails closed on denied selection',async()=>{
 getQualifications.mockResolvedValue(items);vi.stubGlobal('sessionStorage',{getItem:()=>null,setItem:vi.fn()});
 let reject!:(e:Error)=>void;selectQualification.mockImplementation(()=>new Promise((_resolve,r)=>{reject=r}));
 await act(async()=>{tree=create(<QualificationProvider><Probe/></QualificationProvider>)});
 await act(async()=>{void tree!.root.findAllByType('button')[0].props.onClick()});
 expect(tree!.root.findByType('p').children).toEqual(['loading']);
 await act(async()=>reject(Error('403 qualification denied')));
 expect(tree!.root.findByType('p').children).toEqual(['403 qualification denied']);
 expect(sessionStorage.setItem).not.toHaveBeenCalledWith('ucell_qualification_id','q2');
});
it('aborts server selection and ignores its late result on unmount',async()=>{
 getQualifications.mockResolvedValue(items);let resolve!:(q:typeof items[0])=>void;
 selectQualification.mockImplementation(()=>new Promise(r=>{resolve=r}));
 await act(async()=>{tree=create(<QualificationProvider><Probe/></QualificationProvider>)});
 await act(async()=>{void tree!.root.findAllByType('button')[0].props.onClick()});
 const signal=selectQualification.mock.calls.at(-1)![1] as AbortSignal;
 await act(async()=>tree!.unmount());tree=undefined;expect(signal.aborted).toBe(true);
 await act(async()=>resolve(items[1]));
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
