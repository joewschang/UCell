import {Prisma,replayHash} from '@ucell/database';
import {readFoundingPerformance} from '../src/modules/binary-tree/binary-tree-metrics';
import {aggregateGeo,GeoBallFact} from '../src/modules/organization-geo/geo-aggregation';
const at='2026-08-10T00:00:00.000Z';
const time={timezone:'Asia/Taipei' as const,asOf:'2026-09-01T00:00:00.000Z',knowledgeCutoff:'2026-09-15T00:00:00.000Z',periodStart:'2026-07-31T16:00:00.000Z',periodEnd:'2026-08-31T16:00:00.000Z'};
function source(id:string,ball:string,volume:string,side:string){
 const parameters={format:'UCELL_PARAMETER_SNAPSHOT_V1',ruleVersionCode:'TEST_ONLY',effectiveAt:at,parameters:[]};
 const content={format:'UCELL_HISTORICAL_REPLAY_V1',kind:'GPV',sourceId:id,ruleVersionCode:'TEST_ONLY',at,parameters:{...parameters,hash:replayHash(parameters)},recipients:[],evidence:{sourceQualification:{qualificationId:ball},binary:[{childQualificationId:ball,parentQualificationId:'root',side}]},inputs:{volume}};
 return {row:{eventId:id,qualificationId:ball,sourceLineId:id+'-line',ruleVersionCode:'TEST_ONLY',amount:new Prisma.Decimal(volume),occurredAt:new Date(at),recordedAt:new Date(at)},snapshot:{snapshotId:id+'-snapshot',sourceId:id,ruleVersionCode:'TEST_ONLY',content,hash:replayHash(content),createdAt:new Date(at)}};
}
const facts:GeoBallFact[]=[
 {qualificationId:'ball-left',personId:'person-a',ownerType:'MEMBER',firstSide:'LEFT',placedAt:at,active:'ACTIVE',cityCode:'63000',districtCode:'63000010'},
 {qualificationId:'ball-right',personId:'person-a',ownerType:'MEMBER',firstSide:'RIGHT',placedAt:at,active:'ACTIVE',cityCode:'63000',districtCode:'63000010'},
 {qualificationId:'ball-unlocated',personId:'person-b',ownerType:'MEMBER',firstSide:'RIGHT',placedAt:at,active:'UNKNOWN',cityCode:null,districtCode:null},
];
function fixture(){
 const sources=[source('left-source','ball-left','100.1234','LEFT'),source('right-source','ball-right','200.0000','RIGHT')];
 const recordedAt=new Date('2026-09-10T00:00:00.000Z');
 const correction={eventId:'return-reversal',sourceId:'return',sourceLineId:'return-line',sourceType:'RETURN',eventType:'GPV_REVERSAL',qualificationId:'ball-left',ruleVersionCode:'TEST_ONLY',reversalOfEventId:'left-source',amount:new Prisma.Decimal('-20'),recordedAt};
 const tx={
  $queryRaw:jest.fn(async()=>sources.map(s=>({event_id:s.row.eventId,first_side:s.snapshot.content.evidence.binary[0].side}))),
  pvLedger:{findMany:jest.fn(async(query:any)=>query.where.eventId?sources.map(s=>s.row):recordedAt<=query.where.recordedAt.lte?[correction]:[])},
  historicalReplaySnapshot:{findMany:jest.fn(async()=>sources.map(s=>s.snapshot))},
  returnLine:{findMany:jest.fn(async(query:any)=>query.where.orderLineId==='left-source-line'&&recordedAt<=query.where.returnCase.postedAt.lte?[{returnLineId:'return-line',returnCaseId:'return',gpvReversalAmount:new Prisma.Decimal(20)}]:[])},
  auditEvent:{findMany:jest.fn(async()=>[{auditEventId:'TEST_ONLY_RETURN_AUDIT'}])},
 };
 return {tx,sources};
}
async function capture(f:ReturnType<typeof fixture>,known=time.knowledgeCutoff){
 const source=await readFoundingPerformance(f.tx as any,'tree','root',{...time,knowledgeCutoff:known},true);
 expect(source.status).toBe('AVAILABLE');
 if(source.status!=='AVAILABLE')throw new Error('Synthetic source validation failed');
 const context={side:'ALL' as const,level:'CITY' as const,periodStart:time.periodStart,periodEnd:time.periodEnd,gpvAvailable:true};
 return {source,context,geo:aggregateGeo(facts,source.sourceFacts??[],context)};
}
describe('Geo verified source and historical knowledge reconciliation',()=>{
 it('applies a later recorded return once to the original source month and reconciles city and firstSide totals',async()=>{
  const f=fixture(),before=await capture(f,'2026-09-05T00:00:00.000Z'),after=await capture(f);
  expect(before.geo.summary.gpv).toBe('300.1234');expect(after.geo.summary.gpv).toBe('280.1234');
  expect(after.source.sourceFacts).toHaveLength(2);expect(after.source.value.month).toBe(after.geo.summary.gpv);
  const left=aggregateGeo(facts,after.source.sourceFacts??[],{...after.context,side:'LEFT'}),right=aggregateGeo(facts,after.source.sourceFacts??[],{...after.context,side:'RIGHT'});
  expect(left.summary.gpv).toBe('80.1234');expect(right.summary.gpv).toBe('200.0000');
  expect(new Prisma.Decimal(left.summary.gpv!).add(right.summary.gpv!).toFixed(4)).toBe(after.geo.summary.gpv);
  expect(after.geo.summary).toMatchObject({descendantBalls:3,uniqueMembers:2,unlocatedBalls:1,activeRate:null});
  expect(after.geo.distribution.reduce((sum,r)=>sum.add(r.gpv!),new Prisma.Decimal(0)).toFixed(4)).toBe(after.geo.summary.gpv);
 });
 it('does not expose internal source facts in the existing non-Geo tree response',async()=>{
  const f=fixture();expect(await readFoundingPerformance(f.tx as any,'tree','root',time)).not.toHaveProperty('sourceFacts');
 });
 it('does not permit a tampered sealed source to become a Geo total',async()=>{
  const f=fixture();f.sources[0].snapshot.content.inputs.volume='999';
  expect(await readFoundingPerformance(f.tx as any,'tree','root',time,true)).toMatchObject({status:'UNAVAILABLE',reason:'HISTORICAL_GPV_EVIDENCE_INVALID',value:null});
 });
});
