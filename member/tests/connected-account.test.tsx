import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import App from '../src/App';
import {QualificationProvider} from '../src/QualificationContext';
import {getRepurchaseStatus,selectQualification} from '../src/memberData';
import RepurchaseDetails from '../src/RepurchaseDetails';
import EndSession from '../src/EndSession';
import {SessionGuard} from '../src/session';
import {SessionBoundary} from '../src/SessionBoundary';
let tree:ReactTestRenderer|undefined;
const q={id:'q1',code:'Q1',rank:'ELITE',active:false,ballLabel:'球1'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify({data,meta:{request_id:'test',api_version:'v1',timestamp:'2026-09-16T00:00:00Z'}}),{status});
beforeEach(()=>{vi.stubGlobal('sessionStorage',{getItem:()=>null,setItem:vi.fn(),removeItem:vi.fn()})});
afterEach(()=>{if(tree)act(()=>tree!.unmount());tree=undefined;vi.unstubAllGlobals();vi.restoreAllMocks()});
it('allows a Person without balls to access own profile and server logout without scoped queries',async()=>{
 const fetch=vi.fn(async(url:string)=>url.includes('/qualifications')?response([]):response({name:'Person only',alias:null,memberNo:'P1',email:null,phone:null,gender:null,birthDate:null,membershipState:'NETWORK_MEMBER',mobileVerifiedAt:null}));vi.stubGlobal('fetch',fetch);
 await act(async()=>{tree=create(<MemoryRouter initialEntries={['/me']}><QualificationProvider><App/></QualificationProvider></MemoryRouter>)});
 const text=JSON.stringify(tree!.toJSON());expect(text).toContain('Person only');expect(text).toContain('更新聯絡資料');expect(text).toContain('登出會員服務');
 expect(fetch.mock.calls.every(([url])=>!url.includes('qualificationId'))).toBe(true);
});
it('posts selected ball for server authorization and rejects mismatched response',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response({qualificationId:q.id,qualification:q})).mockResolvedValueOnce(response({qualificationId:'foreign',qualification:{...q,id:'foreign'}}));vi.stubGlobal('fetch',fetch);
 await expect(selectQualification(q,new AbortController().signal)).resolves.toEqual(q);
 expect(fetch.mock.calls[0][1].method).toBe('POST');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({qualificationId:q.id});
 await expect(selectQualification(q,new AbortController().signal)).rejects.toThrow('資格確認回應不符');
});
it('shows Core repurchase status without deriving it from Qualification Active',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({qualificationId:q.id,period:'2026-09',status:'ACTIVE',recognitions:[{id:'recognition',status:'RECOGNIZED',dueAt:'2026-09-15T16:00:00Z'}]})));
 await act(async()=>{tree=create(<RepurchaseDetails q={q}/>)});
 const text=JSON.stringify(tree!.toJSON());expect(text).toContain('已完成');expect(text).toContain('已認列');expect(text).toContain(new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'short'}).format(new Date('2026-09-15T16:00:00Z')));
});
it('rejects foreign repurchase and malformed dates without substituting zero or Active',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response({qualificationId:'foreign',period:'2026-09',status:'ACTIVE',recognitions:[]})).mockResolvedValueOnce(response({qualificationId:q.id,period:'2026-09',status:'PENDING',recognitions:[{id:'r',status:'DUE',dueAt:'invalid'}]}));vi.stubGlobal('fetch',fetch);
 await expect(getRepurchaseStatus(q,new AbortController().signal)).rejects.toThrow('資格不符');
 await expect(getRepurchaseStatus(q,new AbortController().signal)).rejects.toThrow('資格不符');
});
it('retries server logout with same key and locks UI only after confirmed revocation',async()=>{
 const fetch=vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(response({status:'REVOKED'}));vi.stubGlobal('fetch',fetch);
 const guard=new SessionGuard();await act(async()=>{tree=create(<SessionBoundary guard={guard}><EndSession guard={guard} connected/></SessionBoundary>)});
 const button=()=>tree!.root.findAllByType('button').find(b=>b.children.join('')==='登出會員服務')!;
 await act(async()=>button().props.onClick());expect(guard.getSnapshot()).toBe(false);expect(JSON.stringify(tree!.toJSON())).toContain('無法確認伺服器登出');
 await act(async()=>button().props.onClick());expect(guard.getReason()).toBe('revoked');expect(JSON.stringify(tree!.toJSON())).toContain('已登出會員服務');
 const headers=fetch.mock.calls.map(row=>new Headers(row[1].headers));expect(headers[0].get('Idempotency-Key')).toBe(headers[1].get('Idempotency-Key'));
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({intent:'LOGOUT'});
});
