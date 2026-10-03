import {FormalMembershipConflictService} from '../src/modules/member/formal-membership-conflict.service';
import {IdentityMatchFingerprintService} from '../src/common/security/identity-match-fingerprint.service';

describe('R1.0B formal membership spouse/corporate controls',()=>{
  it('uses keyed deterministic fingerprints without exposing raw identity values',()=>{
    process.env.NODE_ENV='test';
    const service=new IdentityMatchFingerprintService();
    const first=service.fingerprintNationalId(' test-id-001 ');
    const second=service.fingerprintNationalId('TEST-ID-001');
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(second);
    expect(first).not.toContain('TEST-ID-001');
  });

  it('blocks an applicant whose verified spouse identity already belongs to a formal member',async()=>{
    const db:any={
      formalMemberApplication:{findUnique:jest.fn(async()=>({
        formalMemberApplicationId:'app',personId:'person-a',applicantType:'INDIVIDUAL',
        applicantIdentityFingerprint:'a'.repeat(64),spouseIdentityFingerprint:'b'.repeat(64),
        legalEntityRegistrationNo:null,legalEntityId:null,
        person:{personId:'person-a',membershipState:'NETWORK_MEMBER'},legalEntity:null,
      }))},
      formalIdentityIndex:{findUnique:jest.fn(async({where}:any)=>where.identityDocumentFingerprint==='b'.repeat(64)?{personId:'person-b'}:null)},
      spouseRelationship:{findFirst:jest.fn(async()=>null)},
      legalEntity:{findUnique:jest.fn(async()=>null)},
      legalEntityRepresentative:{findFirst:jest.fn(async()=>null)},
    };
    const result=await new FormalMembershipConflictService(db).evaluate('app');
    expect(result.status).toBe('BLOCKED');
    expect(result.codes).toContain('SPOUSE_ALREADY_FORMAL_MEMBER');
  });

  it('blocks a legal entity when its representative controls another formal legal entity',async()=>{
    const db:any={
      formalMemberApplication:{findUnique:jest.fn(async()=>({
        formalMemberApplicationId:'app',personId:'rep-a',applicantType:'LEGAL_ENTITY',
        applicantIdentityFingerprint:'c'.repeat(64),spouseIdentityFingerprint:null,
        legalEntityRegistrationNo:'CORP-NEW',legalEntityId:null,
        person:{personId:'rep-a',membershipState:'NETWORK_MEMBER'},legalEntity:null,
      }))},
      formalIdentityIndex:{findUnique:jest.fn(async()=>null)},
      spouseRelationship:{findFirst:jest.fn(async()=>null)},
      legalEntity:{findUnique:jest.fn(async()=>null)},
      legalEntityRepresentative:{findFirst:jest.fn(async()=>({legalEntityId:'corp-existing'}))},
    };
    const result=await new FormalMembershipConflictService(db).evaluate('app');
    expect(result.status).toBe('BLOCKED');
    expect(result.codes).toContain('REPRESENTATIVE_CONTROLS_OTHER_FORMAL_ENTITY');
  });

  it('returns CLEAR only when person spouse and corporate-control checks find no conflict',async()=>{
    const db:any={
      formalMemberApplication:{findUnique:jest.fn(async()=>({
        formalMemberApplicationId:'app',personId:'person-a',applicantType:'INDIVIDUAL',
        applicantIdentityFingerprint:'d'.repeat(64),spouseIdentityFingerprint:null,
        legalEntityRegistrationNo:null,legalEntityId:null,
        person:{personId:'person-a',membershipState:'NETWORK_MEMBER'},legalEntity:null,
      }))},
      formalIdentityIndex:{findUnique:jest.fn(async()=>null)},
      spouseRelationship:{findFirst:jest.fn(async()=>null)},
      legalEntity:{findUnique:jest.fn(async()=>null)},
      legalEntityRepresentative:{findFirst:jest.fn(async()=>null)},
    };
    await expect(new FormalMembershipConflictService(db).evaluate('app')).resolves.toEqual({applicationId:'app',status:'CLEAR',codes:[]});
  });
});
