import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import MemberAwardJourney from '../src/MemberAwardJourney';
import {MemberPageHeader} from '../src/MemberPageHeader';
import MemberTodaySummary from '../src/MemberTodaySummary';
import {getMemberTree,newMemberTreeTime} from '../src/memberData';

const meta={request_id:'member-v2-test',timestamp:'2026-09-19T00:00:00.000Z',api_version:'v1'};
const response=(data:unknown)=>new Response(JSON.stringify({data,meta}));
const q={id:'q1',code:'A000001',rank:'LEADER',active:true,ballLabel:'球 A000001'};
const futureSnapshot=()=>new Date(Date.now()+60_000).toISOString();

beforeEach(()=>vi.stubGlobal('sessionStorage',{getItem:()=>null,setItem:vi.fn(),removeItem:vi.fn()}));
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

it('keeps tree pagination bound to the same snapshot and rejects unsafe tree payloads',async()=>{
 const fetch=vi.fn(async()=>response({status:'AVAILABLE',snapshotToken:'snapshot-1',snapshotExpiresAt:futureSnapshot(),parentBallNo:'A000001',hiddenBootstrapBoundary:true,items:[{ballNo:'A000020',binaryPositionNo:'20',side:'LEFT',nodeKind:'AnonymousBallNode'}],nextCursor:'cursor-2'}));
 vi.stubGlobal('fetch',fetch);
 const time=newMemberTreeTime();
 await expect(getMemberTree(q,undefined,'snapshot-1',time,'cursor-2',new AbortController().signal)).resolves.toMatchObject({snapshotToken:'snapshot-1',nextCursor:'cursor-2'});
 const url=String(fetch.mock.calls[0][0]);
 expect(url).toContain('ballNo=A000001');
 expect(url).toContain('snapshotToken=snapshot-1');
 expect(url).toContain('after=cursor-2');
 fetch.mockResolvedValueOnce(response({status:'AVAILABLE',snapshotToken:'snapshot-2',snapshotExpiresAt:futureSnapshot(),parentBallNo:'A000001',hiddenBootstrapBoundary:false,items:[],nextCursor:null}));
 await expect(getMemberTree(q,undefined,'snapshot-1',time,undefined,new AbortController().signal)).rejects.toThrow('安全組織資料格式異常');
 fetch.mockResolvedValueOnce(response({status:'AVAILABLE',snapshotToken:'snapshot-1',snapshotExpiresAt:futureSnapshot(),parentBallNo:'A000021',hiddenBootstrapBoundary:false,items:[],nextCursor:null}));
 await expect(getMemberTree(q,'A000020','snapshot-1',time,undefined,new AbortController().signal)).rejects.toThrow('安全組織資料格式異常');
 fetch.mockResolvedValueOnce(response({status:'AVAILABLE',snapshotToken:'snapshot-1',snapshotExpiresAt:futureSnapshot(),parentBallNo:'A000001',hiddenBootstrapBoundary:false,items:[{ballNo:'A000021',binaryPositionNo:'21',side:'RIGHT',nodeKind:'AnonymousBallNode',memberNo:null}],nextCursor:null}));
 await expect(getMemberTree(q,undefined,'snapshot-1',time,undefined,new AbortController().signal)).rejects.toThrow('安全組織資料格式異常');
 fetch.mockResolvedValueOnce(response({status:'AVAILABLE',snapshotToken:'snapshot-1',snapshotExpiresAt:futureSnapshot(),parentBallNo:'A000001',hiddenBootstrapBoundary:false,companyEconomics:{reservoirB:'forbidden'},items:[],nextCursor:null}));
 await expect(getMemberTree(q,undefined,'snapshot-1',time,undefined,new AbortController().signal)).rejects.toThrow('安全組織資料格式異常');
});

it('uses Taipei month boundaries for the tree snapshot context',()=>{
 const time=newMemberTreeTime(new Date('2026-09-30T17:00:00.000Z'));
 expect(time.periodStart).toBe('2026-09-30T16:00:00.000Z');
 expect(time.periodEnd).toBe('2026-10-31T16:00:00.000Z');
});

it('labels the legacy plan-level field as a plan and controls repurchase details accessibly',()=>{
 const html=renderToStaticMarkup(<MemberTodaySummary q={q} monthlyRepurchaseStatus="PENDING" repurchaseDetailsOpen={true} onShowRepurchaseDetails={()=>{}}/>);
 expect(html).toContain('<dt>方案</dt><dd>領袖</dd>');
 expect(html).not.toContain('<dt>等級</dt>');
 expect(html).toContain('aria-expanded="true"');
 expect(html).toContain('aria-controls="repurchase-details"');
});

it('keeps page headers safe when an authoritative member number is not available yet',()=>{
 const html=renderToStaticMarkup(<MemberPageHeader title="我的組織" q={q}/>);
 expect(html).toContain('會員編號');
 expect(html).toContain('尚未提供');
 expect(html).toContain('方案 領袖');
 expect(html).not.toContain('等級 領袖');
});

it('renders a member-safe award journey with Ball context and no internal award identifier',()=>{
 const html=renderToStaticMarkup(<MemberAwardJourney q={q} period="2026-09" award={{id:'550e8400-e29b-41d4-a716-446655440000',name:'推薦獎金',status:'PENDING',amount:null,theoryAmount:null,finalAmount:null,payableAmount:null,settlementStatus:'PENDING',pendingReason:'SETTLEMENT_NOT_FINALIZED',settlementDate:null,nominalPayoutDate:null,adjustedPayoutDate:null,businessCalendarVersion:null,ruleVersion:null,parameterSnapshotHash:null}}/>);
 expect(html).toContain('球編號');
 expect(html).toContain('A000001');
 expect(html).toContain('查詢月份');
 expect(html).toContain('2026-09');
 expect(html).toContain('查看可用的結算說明');
 expect(html).toContain('結算尚未完成');
 expect(html).not.toContain('SETTLEMENT_NOT_FINALIZED');
 expect(html).not.toContain('550e8400-e29b-41d4-a716-446655440000');
 expect(html).not.toContain('Reservoir');
});
