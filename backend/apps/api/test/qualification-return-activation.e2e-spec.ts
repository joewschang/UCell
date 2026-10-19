import {assertQualificationActivation} from '../src/modules/qualification/qualification-activation-gate';
const setup={qualificationId:'q',ownerPersonId:'p',ownerLegalEntityId:null,qualifyingOrderId:'o'};
function fixture(state='RETURN_REVIEW_PENDING',reviewed=false){return {person:{findUnique:jest.fn().mockResolvedValue({membershipState:'FORMAL_MEMBER'})},order:{findUnique:jest.fn().mockResolvedValue({qualificationId:'q',status:'PARTIAL_RETURN'})},qualificationSetup:{findUnique:jest.fn().mockResolvedValue({setupStatus:state})},auditEvent:{findFirst:jest.fn().mockResolvedValue(reviewed?{entityId:'q'}:null)}};}
it('requires a current completed return review before activating a partially returned package',async()=>{
 const tx=fixture();await expect(assertQualificationActivation(tx as any,setup)).rejects.toMatchObject({response:{code:'QUALIFICATION_RETURN_REVIEW_REQUIRED'}});
 tx.qualificationSetup.findUnique.mockResolvedValue({setupStatus:'PLACEMENT_PENDING'});
 await expect(assertQualificationActivation(tx as any,setup)).rejects.toMatchObject({response:{code:'QUALIFICATION_RETURN_REVIEW_REQUIRED'}});
 tx.auditEvent.findFirst.mockResolvedValue({entityId:'q'});
 await expect(assertQualificationActivation(tx as any,setup)).resolves.toBeUndefined();
 tx.qualificationSetup.findUnique.mockResolvedValue({setupStatus:'RETURN_REVIEW_PENDING'});
 await expect(assertQualificationActivation(tx as any,setup)).rejects.toBeDefined();
});
it('preserves the formal-member and full-return activation barriers',async()=>{
 const tx=fixture('PLACEMENT_PENDING',true);
 tx.person.findUnique.mockResolvedValue({membershipState:'NETWORK_MEMBER'});
 await expect(assertQualificationActivation(tx as any,setup)).rejects.toMatchObject({response:{code:'FORMAL_MEMBERSHIP_APPROVAL_REQUIRED'}});
 tx.person.findUnique.mockResolvedValue({membershipState:'FORMAL_MEMBER'});tx.order.findUnique.mockResolvedValue({qualificationId:'q',status:'RETURNED'});
 await expect(assertQualificationActivation(tx as any,setup)).rejects.toMatchObject({response:{code:'QUALIFICATION_PAYMENT_REQUIRED'}});
});
