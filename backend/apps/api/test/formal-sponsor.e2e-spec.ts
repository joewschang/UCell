import {validateFormalSponsor} from '../src/modules/member/formal-application-sponsor';
describe('Formal sponsor validation',()=>{
 it.each(['',undefined])('requires a sponsor before submit',async(code)=>{await expect(validateFormalSponsor({},'p',code)).rejects.toMatchObject({response:{code:'FORMAL_SPONSOR_BALL_REQUIRED'}})});
 it('rejects aliases and invalid formats',async()=>{await expect(validateFormalSponsor({},'p','COMPANY')).rejects.toMatchObject({response:{code:'FORMAL_SPONSOR_BALL_INVALID'}})});
 it('requires an effective Ball owned by another person',async()=>{
  const findFirst=jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ballNo:'A000001',kind:'MEMBER_ORIGIN',currentHolderPersonId:'p'}).mockResolvedValueOnce({qualificationId:'q',ballNo:'A000001',kind:'MEMBER_ORIGIN',currentHolderPersonId:'other'}),db:any={qualification:{findFirst,findUnique:jest.fn().mockResolvedValue(null)}};
  await expect(validateFormalSponsor(db,'p','A000001')).rejects.toMatchObject({response:{code:'SPONSOR_CODE_INELIGIBLE'}});
  await expect(validateFormalSponsor(db,'p','A000001')).rejects.toMatchObject({response:{code:'FORMAL_SPONSOR_BALL_INVALID'}});
  await expect(validateFormalSponsor(db,'p',' a000001 ')).resolves.toMatchObject({sponsorBallNo:'A000001',sponsorQualificationId:'q'});
  expect(findFirst).toHaveBeenLastCalledWith(expect.objectContaining({where:expect.objectContaining({ballNo:'A000001',status:'EFFECTIVE'})}));
 });
});

describe('Company Ball for formal application review',()=>{
 const company={qualificationId:'company-q',ballNo:'UCELL001X000007',kind:'COMPANY_BOOTSTRAP',status:'EFFECTIVE',effectiveAt:new Date('2026-01-01'),currentCompanyPrincipalId:'company',currentCompanyPrincipal:{status:'ACTIVE'},binaryTreeMembership:{binaryTree:{status:'ACTIVE',companyPrincipalId:'company'}}};
 it('accepts an effective company-owned Ball without a personal holder',async()=>{
 const db:any={qualification:{findUnique:jest.fn().mockResolvedValue(company)}};
 await expect(validateFormalSponsor(db,'applicant',' ucell001x000007 ')).resolves.toMatchObject({sponsorQualificationId:'company-q',sponsorBallNo:'UCELL001X000007'});
 });
 it.each([{status:'CANCELLED'},{effectiveAt:new Date('2099-01-01')},{currentCompanyPrincipal:null},{binaryTreeMembership:null},{binaryTreeMembership:{binaryTree:{status:'ARCHIVED',companyPrincipalId:'company'}}},{binaryTreeMembership:{binaryTree:{status:'ACTIVE',companyPrincipalId:'other'}}}])('rejects inactive or mismatched company evidence %j',async change=>{
 const db:any={qualification:{findUnique:jest.fn().mockResolvedValue({...company,...change})}};
 await expect(validateFormalSponsor(db,'applicant',company.ballNo)).rejects.toMatchObject({response:{code:'SPONSOR_CODE_INELIGIBLE'}});
 });
});
