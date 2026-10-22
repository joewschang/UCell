import {MemberReadService} from '../src/modules/member/member-read.service';
import {FormalMemberApplicationService} from '../src/modules/member/formal-member-application.service';
import {validTaiwanNationalId} from '../src/common/security/taiwan-national-id';
describe('member enrollment and own order history',()=>{
 it('restricts queries to own purchases, own package snapshots and authorized qualifications',async()=>{
  const findMany=jest.fn().mockResolvedValue([{orderId:'PACKAGE-ORDER',orderNo:123n,status:'PAID',purpose:'ENTRY',netAmount:{toString:()=> '14400'},createdAt:new Date(),paidAt:new Date(),payments:[],lines:[],fulfillments:[{status:'SHIPPED',shipments:[{carrier:'KERRY_TJ',trackingNo:'12345678901',status:'IN_TRANSIT',updatedAt:new Date()}]}]}]);
  const db:any={order:{findMany},packagePurchaseSnapshot:{findMany:jest.fn().mockResolvedValue([{orderId:'PACKAGE-ORDER',packageName:'啟航套組',paymentDeadline:null}])}};
  const service=new MemberReadService(db,{qualifications:jest.fn().mockResolvedValue([{id:'OWNED'}])} as any,{} as any);
  const result=await service.myOrders('PERSON');expect(db.packagePurchaseSnapshot.findMany.mock.calls[0][0].where).toEqual({personId:'PERSON'});
  expect(findMany.mock.calls[0][0].where).toEqual({OR:[{orderId:{in:['PACKAGE-ORDER']}},{purchaserPersonId:'PERSON'},{qualificationId:{in:['OWNED']}}]});
  expect(result[0].fulfillments[0].shipments[0].trackingNo).toBe('12345678901');expect(result[0].paymentStatus).toBe('PAID');expect(result[0].packageName).toBe('啟航套組');expect(JSON.stringify(result)).not.toContain('PERSON');
 });
 it('enforces identity checksum and email before saving or encrypting',()=>{
  const service=new FormalMemberApplicationService({} as any,{} as any,{} as any,{} as any,{} as any);
  expect(validTaiwanNationalId('A123456789')).toBe(true);
  expect(()=>(service as any).normalize({email:'broken'})).toThrow();
  expect(()=>(service as any).normalize({email:'a@example.com',identityDocumentType:'NATIONAL_ID',identityDocumentNumber:'A123456788'})).toThrow();
 });
});
