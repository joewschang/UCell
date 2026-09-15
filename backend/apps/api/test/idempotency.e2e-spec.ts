import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { RpvService } from '../src/modules/rpv/rpv.service';
import { requestHash } from '../src/common/utils/hash';
import { consumeReplayOutbox } from '@ucell/database';

function fixture(){
  let record:any=null;
  const records={findUnique:jest.fn(async()=>record),create:jest.fn(async({data}:any)=>{record={...data,responseBody:null,statusCode:null};}),update:jest.fn(async({data}:any)=>{record={...record,...data};})};
  const tx={idempotencyRecord:records};
  const prisma={...tx,$transaction:jest.fn(async(fn:any)=>{const before=record;try{return await fn(tx);}catch(e){record=before;throw e;}})};
  return {prisma,records};
}
describe('Idempotency (P0)', () => {
  it('same key + same payload returns original result',async()=>{
    const {prisma,records}=fixture(),service=new IdempotencyService(prisma as any),work=jest.fn(async()=>({eventId:'original'}));
    expect(await service.execute('scope','key',{a:1},work)).toEqual({value:{eventId:'original'},replayed:false});
    expect(await service.execute('scope','key',{a:1},work)).toEqual({value:{eventId:'original'},replayed:true});
    expect(work).toHaveBeenCalledTimes(1);expect(records.create).toHaveBeenCalledTimes(1);
  });
  it('same key + different payload returns IDEMPOTENCY_CONFLICT',async()=>{
    const {prisma}=fixture(),service=new IdempotencyService(prisma as any),work=jest.fn(async()=>({eventId:'original'}));
    await service.execute('scope','key',{a:1},work);
    await expect(service.execute('scope','key',{a:2},work)).rejects.toMatchObject({response:{code:'IDEMPOTENCY_CONFLICT'}});
    expect(work).toHaveBeenCalledTimes(1);
  });
  it('monthly recognition cannot create RPV twice',async()=>{
    const tx={monthlyRecognitionSchedule:{findUnique:jest.fn(async()=>({status:'RECOGNIZED'}))},pvLedger:{create:jest.fn()},rpvUplineAwardEvent:{upsert:jest.fn()}};
    const service=new RpvService({$transaction:async(fn:any)=>fn(tx)} as any,{} as any);
    for(let i=0;i<2;i++)expect(await service.recognize('original')).toEqual({skipped:'ALREADY_RECOGNIZED'});
    expect(tx.pvLedger.create).not.toHaveBeenCalled();expect(tx.rpvUplineAwardEvent.upsert).not.toHaveBeenCalled();
  });
  it('same external event cannot be processed twice',async()=>{
    const tx={outboxEvent:{findUnique:jest.fn(async()=>({outboxEventId:'event',eventType:'RPV_REVERSAL_REQUIRED',processStatus:'PROCESSED'})),update:jest.fn()},pvLedger:{create:jest.fn()},replayAction:{create:jest.fn()}};
    for(let i=0;i<2;i++)expect(await consumeReplayOutbox(tx as any,'event')).toEqual({replayed:true});
    expect(tx.pvLedger.create).not.toHaveBeenCalled();expect(tx.replayAction.create).not.toHaveBeenCalled();expect(tx.outboxEvent.update).not.toHaveBeenCalled();
  });
  it('transaction-visible unfinished record with conflicting payload fails before work',async()=>{
    const work=jest.fn();const tx={idempotencyRecord:{findUnique:jest.fn(async()=>({actorScope:'scope',requestHash:requestHash({a:1}),responseBody:null})),update:jest.fn()}};
    const prisma={idempotencyRecord:{findUnique:jest.fn(async()=>null)},$transaction:async(fn:any)=>fn(tx)};
    await expect(new IdempotencyService(prisma as any).execute('scope','key',{a:2},work)).rejects.toMatchObject({response:{code:'IDEMPOTENCY_CONFLICT'}});
    expect(work).not.toHaveBeenCalled();expect(tx.idempotencyRecord.update).not.toHaveBeenCalled();
  });
  it('partial failure rolls back response and retry runs the operation',async()=>{
    const {prisma,records}=fixture(),service=new IdempotencyService(prisma as any);
    await expect(service.execute('scope','key',{a:1},async()=>{throw new Error('partial failure');})).rejects.toThrow('partial failure');
    expect(records.update).not.toHaveBeenCalled();
    expect(await service.execute('scope','key',{a:1},async()=>({ok:true}))).toEqual({value:{ok:true},replayed:false});
  });
});
