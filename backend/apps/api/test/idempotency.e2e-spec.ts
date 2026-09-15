import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { RpvService } from '../src/modules/rpv/rpv.service';

describe('Idempotency (P0)',()=>{
  it('same key + same payload returns original result',async()=>{
    const prisma:any={idempotencyRecord:{findUnique:jest.fn().mockResolvedValue({requestHash:'x',responseBody:{ok:true},statusCode:200})}};
    const service=new IdempotencyService(prisma); const hash=require('../src/common/utils/hash').requestHash({a:1}); prisma.idempotencyRecord.findUnique.mockResolvedValue({requestHash:hash,responseBody:{ok:true},statusCode:200});
    await expect(service.execute('scope','key',{a:1},async()=>({ok:false}))).resolves.toEqual({value:{ok:true},replayed:true});
  });
  it('same key + different payload returns IDEMPOTENCY_CONFLICT',async()=>{
    const prisma:any={idempotencyRecord:{findUnique:jest.fn().mockResolvedValue({requestHash:'different',responseBody:{},statusCode:200})}};
    await expect(new IdempotencyService(prisma).execute('scope','key',{a:1},async()=>({}))).rejects.toMatchObject({response:{code:'IDEMPOTENCY_CONFLICT'}});
  });
  it('monthly recognition cannot create RPV twice',async()=>{
    const tx:any={monthlyRecognitionSchedule:{findUnique:jest.fn().mockResolvedValue({status:'RECOGNIZED'})}};
    const prisma:any={$transaction:jest.fn((fn:any)=>fn(tx))}; const service=new RpvService(prisma,{} as any);
    await expect(service.recognize('recognition')).resolves.toEqual({skipped:'ALREADY_RECOGNIZED'});
  });
  it('same external event cannot be processed twice',async()=>{
    const tx:any={monthlyRecognitionSchedule:{findUnique:jest.fn().mockResolvedValue(null)}};
    const prisma:any={$transaction:jest.fn((fn:any)=>fn(tx))}; const service=new RpvService(prisma,{} as any);
    await expect(service.recognize('missing-event')).resolves.toEqual({skipped:'NOT_FOUND'});
  });
});
