import {FormalEnrollmentService} from '../src/modules/member/formal-enrollment.service';
function setup(options:any={}){
 const tx:any={$queryRaw:jest.fn(async()=>[]),formalMemberApplication:{findUnique:async()=>({personId:'member',sourceChannel:'MEMBER_WEB',status:'DRAFT'}),update:jest.fn()},packagePurchaseSnapshot:{findUnique:async()=>({personId:options.foreign?'other':'member',packageClass:'QUALIFICATION',membershipEffect:'FORMAL_ELIGIBILITY',paymentDeadline:new Date(options.expired?'2020-01-01':'2099-01-01'),packageName:'啟航'})},order:{findFirst:jest.fn(async()=>({orderId:'order',purchaserPersonId:null})),update:jest.fn()},formalApplicationDocument:{findMany:async()=>['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER','SIGNED_APPLICATION_AGREEMENT'].map(documentType=>({documentType}))},person:{findUniqueOrThrow:async()=>({status:'EFFECTIVE',securityStatus:'NORMAL',membershipState:'FORMAL_PENDING'})}};
 const audit={write:jest.fn()},orders={confirmPayment:jest.fn()};const svc=new FormalEnrollmentService({} as any,{} as any,{execute:async(_s:any,_k:any,_r:any,fn:any)=>({value:await fn(tx)})} as any,audit as any,orders as any);return {svc,tx,audit,orders};
}
describe('Submit unpaid enrollment for review',()=>{
 it.each(['BANK_TRANSFER','CASH'])('accepts an owned valid order and %s intent without recording payment',async paymentMethod=>{const h=setup();await h.svc.submit('member','app','key','req',{orderId:'order',paymentMethod});expect(h.tx.formalMemberApplication.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'SUBMITTED'})}));expect(h.audit.write).toHaveBeenCalledWith(h.tx,expect.objectContaining({afterData:expect.objectContaining({paymentConfirmed:false,paymentMethod,paymentOrderId:'order'})}));expect(h.tx.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({OR:[{purchaserPersonId:'member'},{purchaserPersonId:null}]})}));expect(h.orders.confirmPayment).not.toHaveBeenCalled();expect(h.tx.order.update).not.toHaveBeenCalled();});
 it.each([{foreign:true},{expired:true}])('rejects foreign or expired orders: %p',async options=>{const h=setup(options);await expect(h.svc.submit('member','app','key','req',{orderId:'order',paymentMethod:'BANK_TRANSFER'})).rejects.toThrow();expect(h.tx.formalMemberApplication.update).not.toHaveBeenCalled();});
 it('requires an explicit payment method for unpaid submission',async()=>{const h=setup();await expect(h.svc.submit('member','app','key','req')).rejects.toThrow();expect(h.tx.formalMemberApplication.update).not.toHaveBeenCalled();});
});
it('loads only the current member application and decrypts saved fields with uploaded document markers',async()=>{
 const {PiiCryptoService}=await import('../src/common/security/pii-crypto.service');
 const decrypt=jest.spyOn(PiiCryptoService.prototype,'decrypt').mockReturnValue({legalName:'保存姓名',bankAccount:'1234'});
 const db:any={formalMemberApplication:{findFirst:jest.fn(async()=>({snapshots:[{version:3,payloadCiphertext:'encrypted',keyVersion:'1'}],documents:[{documentType:'BANKBOOK_COVER'}]}))}};
 const svc=new FormalEnrollmentService(db,{} as any,{} as any,{} as any,{} as any);
 expect(await svc.draft('member','app')).toEqual({payload:{legalName:'保存姓名',bankAccount:'1234'},version:3,documents:['BANKBOOK_COVER']});
 expect(db.formalMemberApplication.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{personId:'member',formalMemberApplicationId:'app'}}));
 decrypt.mockRestore();
});
it('prefills registered gender and decrypts only the document number without exposing storage metadata',async()=>{
 const {PiiCryptoService}=await import('../src/common/security/pii-crypto.service');
 const decrypt=jest.spyOn(PiiCryptoService.prototype,'decrypt').mockReturnValue('A123456789');
 const svc=new FormalEnrollmentService({} as any,{} as any,{} as any,{} as any,{} as any);
 const result=svc.registrationPrefill({legalName:'測試',genderCode:'FEMALE',identityDocumentType:'NATIONAL_ID',identityDocumentNumberCiphertext:'encrypted-value',identityDocumentKeyVersion:'1'});
 expect(result).toMatchObject({gender:'FEMALE',identityDocumentType:'NATIONAL_ID',identityDocumentNumber:'A123456789'});
 expect(JSON.stringify(result)).not.toContain('encrypted-value');
 expect(decrypt).toHaveBeenCalledWith('encrypted-value','1');decrypt.mockRestore();
});
