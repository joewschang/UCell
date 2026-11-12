import {randomBytes,randomUUID} from 'node:crypto';
import {PrismaService,PiiCryptoService} from '@ucell/database';
import {FormalMemberApplicationService} from '../src/modules/member/formal-member-application.service';
import {IdentityMatchFingerprintService} from '../src/common/security/identity-match-fingerprint.service';
import {createEnrollmentBundleFixture} from './helpers/enrollment-bundle.fixture';

const url=process.env.DATABASE_URL??'';
const isLocal=/^postgres(?:ql)?:\/\/[^/]*@(?:127\.0\.0\.1|localhost):\d+\/(excellence_test|ucell_jest_[a-f0-9]{32})(?:\?|$)/.test(url);
(isLocal?describe:describe.skip)('Review one formal application with multiple pending qualifications',()=>{
  const db=new PrismaService();
  const previousKey=process.env.PII_ENCRYPTION_KEY,previousVersion=process.env.PII_ENCRYPTION_KEY_VERSION;
  beforeAll(()=>{process.env.PII_ENCRYPTION_KEY=randomBytes(32).toString('base64');process.env.PII_ENCRYPTION_KEY_VERSION='synthetic-group-review';});
  afterAll(async()=>{
    if(previousKey===undefined)delete process.env.PII_ENCRYPTION_KEY;else process.env.PII_ENCRYPTION_KEY=previousKey;
    if(previousVersion===undefined)delete process.env.PII_ENCRYPTION_KEY_VERSION;else process.env.PII_ENCRYPTION_KEY_VERSION=previousVersion;
    await db.$disconnect();
  });
  it('checks KYC and the full transfer, records one approval for all balls and leaves an unknown external sponsor empty',async()=>{
    const f=await createEnrollmentBundleFixture(db);
    const Service=process.env.EXCELLENCE_RELEASE_MODULES
      ? require(process.env.EXCELLENCE_RELEASE_MODULES+'/member/formal-member-application.service.js').FormalMemberApplicationService
      : FormalMemberApplicationService;
    const pii=new PiiCryptoService();
    const reviewer=new Service(db,f.idem,f.audit,pii,new IdentityMatchFingerprintService());
    const receipt=(await f.service.create(f.personId,f.applicationId,f.input,randomUUID(),randomUUID())).value;
    const payload=pii.encrypt({legalName:'合成測試會員',hasSpouse:false});
    const actor=(await db.person.create({data:{legalName:'Synthetic group reviewer'}})).personId;
    await db.formalMemberApplicationSnapshot.create({data:{formalMemberApplicationId:f.applicationId,version:1,
      payloadHash:'a'.repeat(64),payloadCiphertext:payload.ciphertext,keyVersion:payload.keyVersion}});
    await db.formalMemberApplication.update({where:{formalMemberApplicationId:f.applicationId},data:{
      status:'UNDER_REVIEW',crossLineReviewStatus:'CLEAR',applicantIdentityFingerprint:randomBytes(32).toString('hex')}});
    const approve=()=>reviewer.approve(f.applicationId,actor,randomUUID());
    await expect(approve()).rejects.toMatchObject({response:{code:'FORMAL_APPROVAL_GATE_BLOCKED'}});
    await db.formalApplicationDocument.createMany({data:(['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER','SIGNED_APPLICATION_AGREEMENT'] as const).map(documentType=>({
      formalMemberApplicationId:f.applicationId,documentType,storageObjectKey:'qa/'+f.applicationId+'/'+documentType,contentSha256:'a'.repeat(64),mimeType:'image/png',sizeBytes:123,uploadedAt:new Date(),status:'PRESENT',malwareScanStatus:'CLEAN',reviewedBy:actor,reviewedAt:new Date()}))});
    await expect(approve()).rejects.toMatchObject({response:{code:'FORMAL_ENROLLMENT_BUNDLE_ROOT_UNPAID'}});
    const request={amount:receipt.payableTotal,paymentMethod:'BANK_TRANSFER',referenceNo:randomUUID(),occurredAt:new Date().toISOString()};
    await f.orders.confirmEnrollmentPayment(receipt.balls[0].qualification.orderId,request,randomUUID(),randomUUID(),actor);
    const approved=await approve();
    expect(approved).toMatchObject({status:'APPROVED',approvedQualifications:3,bundleId:receipt.bundleId,activationStatus:'AWAITING_PLACEMENT'});
    await expect(approve()).rejects.toMatchObject({response:{code:'FORMAL_APPLICATION_NOT_APPROVABLE'}});
    const audits=await db.auditEvent.findMany({where:{action:'FORMAL_APPLICATION_APPROVED',entityId:f.applicationId}});
    expect(audits).toHaveLength(1);
    expect(audits[0].afterData).toMatchObject({bundleId:receipt.bundleId,qualificationCount:3});
    expect(await db.sponsorRelationship.count({where:{childQualificationId:{in:receipt.balls.map(b=>b.qualificationId)}}})).toBe(0);
    const details=await reviewer.adminDetail(f.applicationId,actor,randomUUID());
    expect(details.enrollmentBundle).toMatchObject({bundleId:receipt.bundleId,rootSponsor:null,paymentVerified:true});
    expect(details.enrollmentBundle.balls).toHaveLength(3);
  });
});
