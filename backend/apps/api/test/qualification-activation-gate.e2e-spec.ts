import {assertQualificationActivation} from '../src/modules/qualification/qualification-activation-gate';
describe('qualification activation requires independent membership and payment evidence',()=>{
 const setup={qualificationId:'Q',ownerPersonId:'P',qualifyingOrderId:'O'} as any;
 const tx=(membershipState:string,status:string,q='Q')=>({person:{findUnique:jest.fn(async()=>({membershipState}))},legalEntity:{findUnique:jest.fn(async()=>({membershipState}))},order:{findUnique:jest.fn(async()=>({status,qualificationId:q}))}} as any);
 it.each(['NETWORK_MEMBER','FORMAL_PENDING','SUSPENDED'])('blocks %s even with paid package',async state=>{await expect(assertQualificationActivation(tx(state,'PAID'),setup)).rejects.toMatchObject({response:{code:'FORMAL_MEMBERSHIP_APPROVAL_REQUIRED'}});});
 it.each(['CONFIRMED','CANCELLED','REFUNDED'])('blocks formal member when order is %s',async status=>{await expect(assertQualificationActivation(tx('FORMAL_MEMBER',status),setup)).rejects.toMatchObject({response:{code:'QUALIFICATION_PAYMENT_REQUIRED'}});});
 it('rejects payment for another qualification',async()=>{await expect(assertQualificationActivation(tx('FORMAL_MEMBER','PAID','OTHER'),setup)).rejects.toThrow();});
 it('allows approved paid individual and legal entity setups',async()=>{await expect(assertQualificationActivation(tx('FORMAL_MEMBER','PAID'),setup)).resolves.toBeUndefined();await expect(assertQualificationActivation(tx('FORMAL_MEMBER','PAID'),{...setup,ownerPersonId:null,ownerLegalEntityId:'L'})).resolves.toBeUndefined();});
});
