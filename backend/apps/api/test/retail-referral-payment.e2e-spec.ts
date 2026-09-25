import {processRetailReferralPayment} from '../../worker/src/main';
describe('Retail Referral payment behavior',()=>{
 it('processes a paid WEB_MEMBER order with no eligible referral line without creating an Award',async()=>{
  const update=jest.fn(); const tx:any={outboxEvent:{findUnique:jest.fn().mockResolvedValue({processStatus:'PROCESSING',payload:{orderId:'o1'}}),update},order:{findUnique:jest.fn().mockResolvedValue({orderId:'o1',qualificationId:null,purchaserPersonId:'p1',status:'PAID',paidAt:new Date(),ruleVersionCode:'R1.0B',retailReferralLineSnapshots:[{retailReferralEnabled:false}]})}};
  const withOutboxLease=jest.fn(async (_db:any,_lease:any,work:any)=>work(tx));
  await processRetailReferralPayment({} as any,{outboxEventId:'e1'} as any,{withOutboxLease} as any);
  expect(tx.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({processStatus:'PROCESSED'})}));
  expect(tx.bonusAward).toBeUndefined();
 });
});
