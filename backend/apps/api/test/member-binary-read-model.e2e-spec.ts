import { createHash } from 'node:crypto';
import { replayHash } from '@ucell/database';
import { readBinarySettlement, unavailableBinaryView } from '../src/modules/member/member-read.service';

const canonical=(value:any):string=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value!==null&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
function fixture(){
 const periodStart=new Date('2026-08-31T16:00:00.000Z'),periodEnd=new Date('2026-09-07T16:00:00.000Z');
 const parameterBody={format:'UCELL_PARAMETER_SNAPSHOT_V1',ruleVersionCode:'R1.0B',effectiveAt:periodEnd.toISOString(),parameters:[]};
 const parameters={...parameterBody,hash:createHash('sha256').update(canonical(parameterBody)).digest('hex')};
 const content={format:'UCELL_HISTORICAL_REPLAY_V1',kind:'BINARY_K1',sourceId:'11111111-1111-4111-8111-111111111111',at:periodEnd.toISOString(),ruleVersionCode:'R1.0B',parameters,recipients:[],evidence:{carryRecipients:[{qualificationId:'qualification-a',leftPeriodGpv:'1200.5',rightPeriodGpv:'900',leftCarryOut:'300.5',rightCarryOut:'0'}]},inputs:{periodStart:periodStart.toISOString(),periodEnd:periodEnd.toISOString(),totalGpv:'2100.5',k:'1'}} as any;
 return {batch:{settlementBatchId:content.sourceId,settlementType:'BINARY_K1',status:'FINALIZED',periodStart,periodEnd,ruleVersionCode:'R1.0B',calculationHash:'a'.repeat(64),finalizedAt:new Date('2026-09-07T16:01:00.000Z')},snapshot:{content,hash:replayHash(content),ruleVersionCode:'R1.0B'}};
}

describe('Member Binary authoritative read-model boundary',()=>{
 it('keeps current placement counts while failing closed for unavailable monetary and full-tree projections',()=>{
  const view=unavailableBinaryView('qualification-a',[{side:'LEFT',count:'4'},{side:'RIGHT',count:'2'}]);
  expect(view).toEqual({
   qualificationId:'qualification-a',
   left:{count:4,volume:null,carry:null},
   right:{count:2,volume:null,carry:null},
   settlementMetrics:{status:'UNAVAILABLE',reason:'SETTLEMENT_METRICS_READ_MODEL_NOT_AVAILABLE'},
   settlementScope:null,
   fullTree:{status:'UNAVAILABLE',reason:'BINARY_TREE_READ_MODEL_NOT_AVAILABLE'},
  });
 });

 it('does not turn absent placement rows into absent monetary evidence',()=>{
  const view=unavailableBinaryView('qualification-b',[]);
  expect(view.left.count).toBe(0);
  expect(view.right.count).toBe(0);
  expect(view.left.volume).toBeNull();
  expect(view.left.carry).toBeNull();
  expect(view.settlementMetrics.status).toBe('UNAVAILABLE');
 });

 it('materializes volume and carry only from the exact sealed settlement snapshot',async()=>{
  const data=fixture(),tx={settlementBatch:{findUnique:jest.fn().mockResolvedValue(data.batch)},historicalReplaySnapshot:{findUnique:jest.fn().mockResolvedValue(data.snapshot)}};
  const view=await readBinarySettlement(tx,'qualification-a',data.batch.settlementBatchId);
  expect(view.left).toEqual({count:null,volume:1200.5,carry:300.5});
  expect(view.right).toEqual({count:null,volume:900,carry:0});
  expect(view.settlementScope).toMatchObject({settlementBatchId:data.batch.settlementBatchId,ruleVersion:'R1.0B',parameterSnapshotHash:data.snapshot.content.parameters.hash,calculationHash:'a'.repeat(64)});
  expect(tx.historicalReplaySnapshot.findUnique).toHaveBeenCalledWith({where:{kind_sourceId:{kind:'BINARY_K1',sourceId:data.batch.settlementBatchId}}});
 });

 it('fails closed when the selected Qualification has no sealed carry evidence',async()=>{
  const data=fixture(),tx={settlementBatch:{findUnique:jest.fn().mockResolvedValue(data.batch)},historicalReplaySnapshot:{findUnique:jest.fn().mockResolvedValue(data.snapshot)}};
  await expect(readBinarySettlement(tx,'qualification-b',data.batch.settlementBatchId)).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_MISSING'}});
 });

 it('does not disclose a draft settlement',async()=>{
  const data=fixture(),tx={settlementBatch:{findUnique:jest.fn().mockResolvedValue({...data.batch,status:'DRAFT',finalizedAt:null})},historicalReplaySnapshot:{findUnique:jest.fn()}};
  await expect(readBinarySettlement(tx,'qualification-a',data.batch.settlementBatchId)).rejects.toMatchObject({response:{code:'SETTLEMENT_NOT_FINALIZED'}});
  expect(tx.historicalReplaySnapshot.findUnique).not.toHaveBeenCalled();
 });

 it.each([
  ['negative carry','leftCarryOut','-0.0001'],
  ['negative period GPV','rightPeriodGpv','-1'],
  ['non-finite metric','leftPeriodGpv','Infinity'],
  ['unsafe-range metric','rightCarryOut',String(Number.MAX_SAFE_INTEGER+1)],
 ])('fails closed for %s in sealed evidence',async(_label,field,value)=>{
  const data=fixture();
  (data.snapshot.content.evidence.carryRecipients[0] as Record<string,string>)[field]=value;
  data.snapshot.hash=replayHash(data.snapshot.content);
  const tx={settlementBatch:{findUnique:jest.fn().mockResolvedValue(data.batch)},historicalReplaySnapshot:{findUnique:jest.fn().mockResolvedValue(data.snapshot)}};
  await expect(readBinarySettlement(tx,'qualification-a',data.batch.settlementBatchId)).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_MISSING'}});
 });
});
