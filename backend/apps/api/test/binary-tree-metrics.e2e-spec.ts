import {Prisma,replayHash} from '@ucell/database';
import {readFoundingPerformance,readFoundingCarry} from '../src/modules/binary-tree/binary-tree-metrics';
const at='2026-09-10T00:00:00.000Z',time={timezone:'Asia/Taipei' as const,asOf:'2026-10-01T00:00:00.000Z',knowledgeCutoff:'2026-11-10T00:00:00.000Z',periodStart:'2026-08-31T16:00:00.000Z',periodEnd:'2026-09-30T16:00:00.000Z'};
function seal(kind:string,sourceId:string,evidence:any,inputs:any){const p={format:'UCELL_PARAMETER_SNAPSHOT_V1',ruleVersionCode:'TEST_ONLY',effectiveAt:at,parameters:[]},content={format:'UCELL_HISTORICAL_REPLAY_V1',kind,sourceId,ruleVersionCode:'TEST_ONLY',at,parameters:{...p,hash:replayHash(p)},recipients:[],evidence,inputs};return {snapshotId:'snapshot',sourceId,ruleVersionCode:'TEST_ONLY',content,hash:replayHash(content),createdAt:new Date(at)};}
function performance(){
 const row={eventId:'event',qualificationId:'child',sourceLineId:'line',ruleVersionCode:'TEST_ONLY',amount:new Prisma.Decimal('100.1234'),occurredAt:new Date(at)};
 const snapshot=seal('GPV','event',{sourceQualification:{qualificationId:'child'},binary:[{childQualificationId:'child',parentQualificationId:'root',side:'LEFT'}]},{volume:'100.1234'});
 const tx={$queryRaw:jest.fn(async()=>[{event_id:'event',first_side:'LEFT'}]),pvLedger:{findMany:jest.fn(async(query:any)=>query.where.eventId?[row]:[])},historicalReplaySnapshot:{findMany:jest.fn(async()=>[snapshot])},returnLine:{findMany:jest.fn(async()=>[])},auditEvent:{findMany:jest.fn(async()=>[{auditEventId:'audit'}])}};
 return {tx,row,snapshot};
}
describe('Tree GPV source evidence',()=>{
 it('reads exact stored points and original month once',async()=>{const f=performance();expect(await readFoundingPerformance(f.tx as any,'tree','root',time)).toMatchObject({status:'AVAILABLE',value:{cumulative:'100.1234',month:'100.1234',leftMonth:'100.1234',rightMonth:'0.0000'},sourceEvents:1});});
 it('keeps November POSTED return corrections in the original September window',async()=>{
  const f=performance(),correction={eventId:'reversal',sourceId:'return',sourceLineId:'return-line',sourceType:'RETURN',eventType:'GPV_REVERSAL',qualificationId:'child',ruleVersionCode:'TEST_ONLY',reversalOfEventId:'event',amount:new Prisma.Decimal('-20.0000'),recordedAt:new Date('2026-11-01')};
  f.tx.pvLedger.findMany.mockImplementation(async(query:any)=>query.where.eventId?[f.row]:[correction] as any);
  f.tx.returnLine.findMany.mockResolvedValue([{returnLineId:'return-line',returnCaseId:'return',gpvReversalAmount:new Prisma.Decimal(20)}] as any);
  expect(await readFoundingPerformance(f.tx as any,'tree','root',time)).toMatchObject({value:{cumulative:'80.1234',month:'80.1234'}});
  expect(await readFoundingPerformance(f.tx as any,'tree','root',{...time,periodStart:'2026-09-30T16:00:00.000Z',periodEnd:'2026-10-31T16:00:00.000Z'})).toMatchObject({value:{cumulative:'80.1234',month:'0.0000'}});
 });
 it('does not cap the captured path at twelve generations',async()=>{
  const f=performance();f.snapshot.content.evidence.binary=Array.from({length:14},(_,i)=>({childQualificationId:i?'q'+i:'child',parentQualificationId:i===13?'root':'q'+(i+1),side:'LEFT'}));f.snapshot.hash=replayHash(f.snapshot.content);
  expect(await readFoundingPerformance(f.tx as any,'tree','root',time)).toMatchObject({status:'AVAILABLE',value:{cumulative:'100.1234'}});
 });
 it('refuses a corrupt snapshot and a changed historical side',async()=>{
  const f=performance();f.snapshot.hash='bad';expect(await readFoundingPerformance(f.tx as any,'tree','root',time)).toMatchObject({status:'UNAVAILABLE',value:null});
  f.snapshot.content.evidence.binary[0].side='RIGHT';f.snapshot.hash=replayHash(f.snapshot.content);expect(await readFoundingPerformance(f.tx as any,'tree','root',time)).toMatchObject({reason:'HISTORICAL_TREE_PATH_MISMATCH'});
 });
 it('withholds totals until every posted return has matching reversal evidence',async()=>{
  const f=performance();f.tx.returnLine.findMany.mockResolvedValue([{returnLineId:'pending'}] as any);expect(await readFoundingPerformance(f.tx as any,'tree','root',time)).toMatchObject({status:'UNAVAILABLE',reason:'RETURN_REPLAY_NOT_CONVERGED',value:null});
 });
 it('fails closed at the source bound without truncating the total',async()=>{
  const f=performance();f.tx.$queryRaw.mockResolvedValue(Array(2001).fill({event_id:'source',first_side:'LEFT'}));expect(await readFoundingPerformance(f.tx as any,'tree','root',time)).toMatchObject({reason:'SOURCE_LIMIT_REQUIRES_PROJECTION',value:null});expect(f.tx.pvLedger.findMany).not.toHaveBeenCalled();
 });
});
function carry(){const row={createdAt:new Date(at),periodEnd:new Date('2026-09-15'),ruleVersionCode:'TEST_ONLY',pairedPv:new Prisma.Decimal(100),leftCarryOut:new Prisma.Decimal(20),rightCarryOut:new Prisma.Decimal(10)},snapshot=seal('BINARY_K1','batch',{carryRecipients:[{qualificationId:'root',pairedPv:'100',leftCarryOut:'20',rightCarryOut:'10'}]},{});return {row,tx:{binaryCarry:{findMany:jest.fn(async()=>[row])},settlementBatch:{findMany:jest.fn(async()=>[{settlementBatchId:'batch',ruleVersionCode:'TEST_ONLY'}])},historicalReplaySnapshot:{findUnique:jest.fn(async()=>snapshot)},settlementRecalculationRequest:{findFirst:jest.fn(async()=>null)},replayCarryProjection:{findFirst:jest.fn(async()=>null)}}};}
describe('Tree Carry read source',()=>{
 it('reads sealed original values and their settlement reference',async()=>{const f=carry();expect(await readFoundingCarry(f.tx as any,'root',time)).toMatchObject({status:'AVAILABLE',value:{left:'20.0000',right:'10.0000'},settlementId:'batch',replaySequence:null});});
 it('uses stored replay values without recomputation',async()=>{const f=carry();f.tx.replayCarryProjection.findFirst.mockResolvedValue({createdAt:new Date(at),sequence:7n,carry:{root:{left:'3.5',right:'0',pairedPv:'42.125'}},stateHash:'replay-hash'} as any);expect(await readFoundingCarry(f.tx as any,'root',time)).toMatchObject({status:'AVAILABLE',value:{left:'3.5000',right:'0.0000',pairedPv:'42.1250'},pairPvStatus:'AVAILABLE',replaySequence:'7'});});
 it('does not return original Carry when replay evidence is incomplete',async()=>{const f=carry();f.tx.replayCarryProjection.findFirst.mockResolvedValue({sequence:8n,carry:{}} as any);expect(await readFoundingCarry(f.tx as any,'root',time)).toMatchObject({status:'UNAVAILABLE',reason:'CARRY_CORRECTION_INCOMPLETE',value:null});});
 it('withholds pending replay and ambiguous rule versions',async()=>{const f=carry();f.tx.settlementRecalculationRequest.findFirst.mockResolvedValue({status:'PENDING'} as any);expect(await readFoundingCarry(f.tx as any,'root',time)).toMatchObject({reason:'CARRY_REPLAY_PENDING'});f.tx.binaryCarry.findMany.mockResolvedValue([f.row,{...f.row,ruleVersionCode:'OTHER'}]);expect(await readFoundingCarry(f.tx as any,'root',time)).toMatchObject({reason:'AMBIGUOUS_CARRY_RULE_VERSION'});});
});
