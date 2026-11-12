import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {AuditService} from '../../src/common/audit/audit.service';
import {OutboxService} from '../../src/common/outbox/outbox.service';
import {IdempotencyService} from '../../src/common/idempotency/idempotency.service';
import {PackageConfigService} from '../../src/modules/package-config/package-config.service';
import {quoteEntry} from '../../src/modules/coupon/entry-pricing';
import {OrderService} from '../../src/modules/order/order.service';
import {EnrollmentBundleService} from '../../src/modules/member-bundle/enrollment-bundle.service';
import {EnrollmentBundleInput} from '../../src/modules/member-bundle/enrollment-bundle.dto';
import {createActiveQualificationPackage} from './package-config.fixture';

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
