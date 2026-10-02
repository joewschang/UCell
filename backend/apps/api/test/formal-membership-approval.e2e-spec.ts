import {createHash,randomUUID} from 'node:crypto';
import {PrismaService} from '@ucell/database';
import {AuditService} from '../src/common/audit/audit.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {PiiCryptoService} from '../src/common/security/pii-crypto.service';
import {IdentityMatchFingerprintService} from '../src/common/security/identity-match-fingerprint.service';
import {FormalMemberApplicationService} from '../src/modules/member/formal-member-application.service';
import {FormalMembershipConflictService} from '../src/modules/member/formal-membership-conflict.service';

// Run with test:api:isolated: only its fresh random local DB is permitted.
describe('Formal approval: fresh operating-unit checks and real DB concurrency',()=>{
  const db=new PrismaService();
  const audit=new AuditService();
  const service=new FormalMemberApplicationService(db,new IdempotencyService(db),audit,new PiiCryptoService(),new IdentityMatchFingerprintService());
  const conflicts=new FormalMembershipConflictService(db,audit);
  let actorId:string,contractId:string;
  const prefix=randomUUID();
  const originalEnv={key:process.env.PII_ENCRYPTION_KEY,version:process.env.PII_ENCRYPTION_KEY_VERSION,secret:process.env.IDENTITY_MATCH_HMAC_SECRET};
  beforeAll(async()=>{
    const url=new URL(process.env.DATABASE_URL!);
    if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^\/ucell_jest_[a-f0-9]{32}$/.test(url.pathname))throw new Error('Use the isolated API DB harness');
    process.env.PII_ENCRYPTION_KEY='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    process.env.PII_ENCRYPTION_KEY_VERSION='TEST_ONLY_FORMAL_APPROVAL';
    process.env.IDENTITY_MATCH_HMAC_SECRET='TEST_ONLY_FORMAL_APPROVAL_SECRET_1234567890';
    actorId=(await db.person.create({data:{legalName:'TEST ONLY MEMBERSHIP OPERATOR'}})).personId;
    const text='TEST ONLY PAPER FORMAL CONTRACT';
    contractId=(await db.contractDocumentVersion.create({data:{contractType:'FORMAL_MEMBERSHIP',versionCode:'TEST_ONLY_'+prefix,title:text,contentText:text,contentHash:createHash('sha256').update(text).digest('hex'),audience:'FORMAL_MEMBER',required:true,effectiveFrom:new Date('2020-01-01'),approvalReference:'TEST_ONLY_NOT_PRODUCTION'}})).contractDocumentVersionId;
  });
  afterAll(async()=>{
    for(const [name,value] of Object.entries({PII_ENCRYPTION_KEY:originalEnv.key,PII_ENCRYPTION_KEY_VERSION:originalEnv.version,IDENTITY_MATCH_HMAC_SECRET:originalEnv.secret})){if(value===undefined)delete process.env[name];else process.env[name]=value;}
    await db.$disconnect();
  });
  async function person(label:string){return db.person.create({data:{legalName:'TEST ONLY '+label,status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}});}
  async function paper(personId:string,identity:string,spouseIdentity?:string,corporate=false){
    const reference='TEST-PAPER-'+randomUUID();
    const result=await service.createPaper({
      formalContractVersionId:contractId,representativePersonId:personId,paperApplicationReference:reference,
      applicantType:corporate?'LEGAL_ENTITY':'INDIVIDUAL',
      legalName:'TEST ONLY APPLICANT',gender:'UNDISCLOSED',birthDate:'1990-01-02',nationalityCode:'TW',identityDocumentType:'NATIONAL_ID',identityDocumentNumber:identity,
      legalEntityName:'TEST ONLY CORPORATION '+reference,legalEntityRegistrationNo:reference,legalEntityRegisteredAddress:'TEST ONLY ADDRESS',legalEntityRegistrationCountryCode:'TW',
      representativeLegalName:'TEST ONLY REPRESENTATIVE',representativeNationalityCode:'TW',representativeIdentityDocumentType:'NATIONAL_ID',representativeIdentityDocumentNumber:identity,
      hasSpouse:!!spouseIdentity,spouseName:spouseIdentity?'TEST ONLY SPOUSE':undefined,spouseNationalityCode:spouseIdentity?'TW':undefined,spouseIdentityDocumentType:spouseIdentity?'NATIONAL_ID':undefined,spouseIdentityDocumentNumber:spouseIdentity,
      communicationAddress:'TEST ONLY ADDRESS',phone:'+886900000001',email:'formal-test@example.invalid',bankCode:'TEST',bankAccount:'TEST_ONLY_BANK',accountHolder:'TEST ONLY HOLDER',
    },actorId,randomUUID(),'TEST_ONLY_REQUEST');
    return result.value.id;
  }
  async function ready(id:string,hasSpouse=false){
    const items=await db.formalPaperEvidence.findMany({where:{formalMemberApplicationId:id}});
    for(const item of items)await service.reviewPaperEvidence(id,item.evidenceType,'REVIEWED','TEST_ONLY_PHYSICAL_EVIDENCE','Synthetic fixture',actorId,'TEST_ONLY_REQUEST');
    if(hasSpouse)await service.verifySpouse(id,actorId,randomUUID(),'TEST_ONLY_REQUEST');
    expect((await conflicts.review(id,actorId,'TEST_ONLY_REQUEST')).status).toBe('CLEAR');
    expect((await service.beginReview(id,actorId,'TEST_ONLY_REQUEST')).status).toBe('UNDER_REVIEW');
  }
  async function couple(){
    const a=await person('SPOUSE A'),b=await person('SPOUSE B');
    const identityA=prefix+'-A-'+randomUUID(),identityB=prefix+'-B-'+randomUUID();
    const idA=await paper(a.personId,identityA,identityB),idB=await paper(b.personId,identityB,identityA);
    await ready(idA,true);await ready(idB,true);
    return {a,b,idA,idB};
  }
  it('rejects a new spouse conflict after both applications were reviewed CLEAR without partial writes',async()=>{
    const {a,b,idA,idB}=await couple();
    const ballsBefore=await db.qualification.count();
    expect(await service.approve(idA,actorId,'TEST_ONLY_REQUEST')).toMatchObject({status:'APPROVED',qualificationCreated:false});
    await expect(service.approve(idB,actorId,'TEST_ONLY_REQUEST')).rejects.toMatchObject({response:{code:'FORMAL_APPROVAL_GATE_BLOCKED'}});
    expect((await db.person.findUniqueOrThrow({where:{personId:a.personId}})).membershipState).toBe('FORMAL_MEMBER');
    expect((await db.person.findUniqueOrThrow({where:{personId:b.personId}})).membershipState).toBe('NETWORK_MEMBER');
    expect(await db.formalIdentityIndex.count({where:{personId:b.personId}})).toBe(0);
    expect((await db.formalMemberApplication.findUniqueOrThrow({where:{formalMemberApplicationId:idB}})).status).toBe('UNDER_REVIEW');
    expect(await db.auditEvent.count({where:{entityId:idB,action:'FORMAL_APPLICATION_APPROVED'}})).toBe(0);
    expect(await db.qualification.count()).toBe(ballsBefore);
  });
  it('commits only one of overlapping spouse approvals, then rejects the loser on fresh retry',async()=>{
    const {a,b,idA,idB}=await couple();
    const original=FormalMembershipConflictService.prototype.evaluate;
    let arrived=0,release!:()=>void;
    const barrier=new Promise<void>(resolve=>{release=resolve});
    const spy=jest.spyOn(FormalMembershipConflictService.prototype,'evaluate').mockImplementation(async function(this:FormalMembershipConflictService,id:string,at?:Date){
      const result=await original.call(this,id,at);
      if(id===idA||id===idB){if(++arrived===2)release();await barrier;}
      return result;
    });
    let results:PromiseSettledResult<unknown>[];
    try{results=await Promise.allSettled([service.approve(idA,actorId,'TEST_ONLY_CONCURRENT_A'),service.approve(idB,actorId,'TEST_ONLY_CONCURRENT_B')]);}finally{spy.mockRestore();}
    expect(arrived).toBe(2); // Both transactions reached a fresh CLEAR snapshot.
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    const loser=results.findIndex(result=>result.status==='rejected');
    expect((results[loser] as PromiseRejectedResult).reason).toMatchObject({response:{code:'RETRYABLE_CONFLICT'}});
    await expect(service.approve(loser===0?idA:idB,actorId,'TEST_ONLY_RETRY')).rejects.toMatchObject({response:{code:'FORMAL_APPROVAL_GATE_BLOCKED'}});
    expect(await db.person.count({where:{personId:{in:[a.personId,b.personId]},membershipState:'FORMAL_MEMBER'}})).toBe(1);
    expect(await db.formalIdentityIndex.count({where:{personId:{in:[a.personId,b.personId]}}})).toBe(1);
    expect(await db.auditEvent.count({where:{entityId:{in:[idA,idB]},action:'FORMAL_APPLICATION_APPROVED'}})).toBe(1);
  },15000);
  it('blocks a corporate representative from subsequently gaining an individual formal right',async()=>{
    const representative=await person('CORPORATE REPRESENTATIVE');
    const identity=prefix+'-CORP-'+randomUUID();
    const corporate=await paper(representative.personId,identity,undefined,true);
    await ready(corporate);
    expect(await service.approve(corporate,actorId,'TEST_ONLY_REQUEST')).toMatchObject({status:'APPROVED',applicantType:'LEGAL_ENTITY',qualificationCreated:false});
    expect((await db.person.findUniqueOrThrow({where:{personId:representative.personId}})).membershipState).toBe('NETWORK_MEMBER');
    const individual=await paper(representative.personId,identity);
    expect(await conflicts.evaluate(individual)).toMatchObject({status:'BLOCKED',codes:expect.arrayContaining(['REPRESENTATIVE_CONTROLS_OTHER_FORMAL_ENTITY'])});
  });
  it('blocks the spouse of a formal corporation representative whose Person is still NETWORK_MEMBER',async()=>{
    const representative=await person('CORPORATE SPOUSE REPRESENTATIVE'),spouse=await person('CORPORATE SPOUSE');
    const representativeIdentity=prefix+'-REP-'+randomUUID(),spouseIdentity=prefix+'-SPOUSE-'+randomUUID();
    const corporate=await paper(representative.personId,representativeIdentity,spouseIdentity,true);
    await ready(corporate,true);await service.approve(corporate,actorId,'TEST_ONLY_REQUEST');
    const individual=await paper(spouse.personId,spouseIdentity);
    expect(await conflicts.evaluate(individual)).toMatchObject({status:'BLOCKED',codes:expect.arrayContaining(['APPLICANT_IS_VERIFIED_SPOUSE_OF_FORMAL_MEMBER'])});
  });
});
