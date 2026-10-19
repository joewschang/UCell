import {EpvService} from '../src/modules/epv/epv.service';
import {processRecognition} from '../../worker/src/main';

describe('prepaid package EPV boundary',()=>{
 it('cannot recognize the entire prepaid order through the ordinary EPV endpoint',async()=>{
  const tx={order:{findUnique:jest.fn().mockResolvedValue({orderId:'package',paidAt:new Date(),purpose:'REPURCHASE',lines:[{ruleProfileSnapshot:{packageSelection:true}}]})},pvLedger:{create:jest.fn(),findFirst:jest.fn()}};
  const db={$transaction:async(work:any)=>work(tx)};
  await expect(new EpvService(db as any,{} as any,{} as any,{} as any).recognizeOrder('package')).rejects.toMatchObject({response:{code:'PACKAGE_MONTHLY_RECOGNITION_REQUIRED'}});
  expect(tx.pvLedger.create).not.toHaveBeenCalled();expect(tx.pvLedger.findFirst).not.toHaveBeenCalled();
 });
 it('does not post a prepared subscription through the legacy monthly worker',async()=>{
  const tx={monthlyRecognitionSchedule:{findUnique:jest.fn().mockResolvedValue({status:'SCHEDULED',dueAt:new Date(0),subscription:{status:'PENDING'}})},$queryRaw:jest.fn(),pvLedger:{upsert:jest.fn()}};
  await processRecognition('prepared',{$transaction:async(work:any)=>work(tx)} as any);
  expect(tx.$queryRaw).not.toHaveBeenCalled();expect(tx.pvLedger.upsert).not.toHaveBeenCalled();
 });
});
