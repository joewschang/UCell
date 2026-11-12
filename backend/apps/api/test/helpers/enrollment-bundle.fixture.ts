import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {PiiCryptoService} from '@ucell/database';
import {AuditService} from '../../src/common/audit/audit.service';
import {OutboxService} from '../../src/common/outbox/outbox.service';
import {IdempotencyService} from '../../src/common/idempotency/idempotency.service';
import {PackageConfigService} from '../../src/modules/package-config/package-config.service';
import {quoteEntry} from '../../src/modules/coupon/entry-pricing';
import {OrderService} from '../../src/modules/order/order.service';
import {EnrollmentBundleService} from '../../src/modules/member-bundle/enrollment-bundle.service';
import {EnrollmentBundleInput} from '../../src/modules/member-bundle/enrollment-bundle.dto';
import {createActiveQualificationPackage} from './package-config.fixture';

export async function prepareEnrollmentReview(db:PrismaClient,applicationId:string,actorId:string,pii:PiiCryptoService){
  const legalName='合成群組審核會員';
  const payload={legalName,hasSpouse:false};
  const payloadHash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const snapshot=pii.encrypt(payload);
  const documentTypes=['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER','SIGNED_APPLICATION_AGREEMENT'] as const;
  await db.$transaction([
    db.formalMemberApplicationSnapshot.create({data:{formalMemberApplicationId:applicationId,version:1,payloadHash,
      payloadCiphertext:snapshot.ciphertext,keyVersion:snapshot.keyVersion}}),
    db.formalMemberApplication.update({where:{formalMemberApplicationId:applicationId},data:{status:'SUBMITTED',crossLineReviewStatus:'CLEAR',
      currentSnapshotHash:payloadHash,applicantIdentityFingerprint:randomBytes(32).toString('hex')}}),
    db.formalApplicationDocument.createMany({data:documentTypes.map(documentType=>({
      formalMemberApplicationId:applicationId,documentType,storageObjectKey:'fixture/'+applicationId+'/'+documentType,
      contentSha256:createHash('sha256').update(applicationId+documentType).digest('hex'),mimeType:'image/png',sizeBytes:150,
      uploadedAt:new Date(),status:'PRESENT',malwareScanStatus:'CLEAN',reviewedBy:actorId,reviewedAt:new Date()
    }))})
  ]);
  return legalName;
}

/** Emulate an old checkout writer omitting payment_policy for the named fixture only.
 * Production rows created before the migration receive this identical column default. */
export async function markPreexistingCheckout(db:PrismaClient,applicationId:string){
  await db.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS public.legacy_checkout_fixture(id uuid PRIMARY KEY)');
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION public.legacy_checkout_fixture_policy() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF EXISTS(SELECT 1 FROM public.legacy_checkout_fixture WHERE id=NEW.application_id) THEN NEW.payment_policy:='QUALIFICATION_ONLY'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE OR REPLACE TRIGGER legacy_checkout_fixture BEFORE INSERT ON membership.enrollment_bundle
    FOR EACH ROW EXECUTE FUNCTION public.legacy_checkout_fixture_policy()`);
  await db.$executeRaw`INSERT INTO public.legacy_checkout_fixture VALUES(${applicationId}::uuid) ON CONFLICT DO NOTHING`;
}

export async function createEnrollmentBundleFixture(db:PrismaClient,sponsorCode?:string) {
  const person=await db.person.create({data:{legalName:'Multi qualification fixture',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}});
  const app=await db.formalMemberApplication.create({data:{personId:person.personId,currentSnapshotHash:'a'.repeat(64)}});
  const {version,rule}=await createActiveQualificationPackage(db);
  const key=randomUUID();
  const rp=await db.packageProfile.create({data:{packageClass:'ACTIVE_DURATION',stableCode:'R3-'+key}});
  const packages=new PackageConfigService(db as any);
  const draft=await packages.addVersion(rp.packageProfileId,{displayName:'重銷（三個月）',currency:'TWD',priceAmount:'6000',
    selectableProductQuantity:3,membershipEffect:'NONE',qualificationEffect:'ACTIVE_ENTITLEMENT',targetQualificationRequired:true,
    activeDurationUnit:'MONTH',activeDurationValue:3,recognitionConfigRef:'R1.0B'},'fixture-creator');
  const repId=draft.packageProfileVersionId,start=new Date(Date.now()-60000).toISOString();
  await packages.setProducts(repId,[{productRuleProfileId:rule.productRuleProfileId,minQty:3,maxQty:3}]);
  await packages.approve(repId,'TEST-'+key,'fixture-approver');
  await packages.schedule(repId,{effectiveFrom:start,salesFrom:start});
  const rep=await packages.activate(repId,new Date());
  const make=async (id:string)=>{
    const resolved=await db.packageProfileVersion.findUniqueOrThrow({where:{packageProfileVersionId:id},include:{profile:true}});
    const pricing=await quoteEntry(db as any,resolved,undefined,person.personId);
    return {packageVersionId:id,quoteHash:pricing.quoteHash,selections:[{productRuleProfileId:rule.productRuleProfileId,quantity:3}]};
  };
  const qualification=await make(version.packageProfileVersionId),repurchase=await make(rep.packageProfileVersionId);
  const input:EnrollmentBundleInput={sponsorCode,fulfillmentMethod:'COMPANY_PICKUP',
    balls:[{qualification},{qualification,repurchase},{qualification}]};
  const audit=new AuditService(),idem=new IdempotencyService(db as any);
  const orders=new OrderService(db as any,idem,audit,new OutboxService(),new PackageConfigService(db as any));
  const service=new EnrollmentBundleService(db as any,orders,idem,audit);
  return {personId:person.personId,applicationId:app.formalMemberApplicationId,service,orders,idem,audit,qualification,repurchase,input};
}
