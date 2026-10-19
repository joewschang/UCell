import {PrismaClient, Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {captureParameters} from '@ucell/database';
import {PackageConfigService} from '../src/modules/package-config/package-config.service';
import {OrderService} from '../src/modules/order/order.service';
import {ReturnService} from '../src/modules/return/return.service';
import {resolvePackageParameters} from '../src/modules/order/package-parameters';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {AuditService} from '../src/common/audit/audit.service';
import {OutboxService} from '../src/common/outbox/outbox.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('package Core parameter and return posting boundaries',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
 afterAll(()=>db.$disconnect());
 it('persists actual Core snapshot and rejects zero-value package returns atomically',async()=>{
  const at=new Date(Date.now()-60000),token=randomUUID();
  const policy={gpvRate:'0.6',rpvRate:'0.6',epvRate:'0.6',qualificationPackage:{gpv:true,rpv:false,epv:false,active:'PAYMENT_CALENDAR_MONTH_ASIA_TAIPEI'}};
  await db.runtimeRuleParameter.create({data:{ruleVersionCode:'R1.0B',parameterCode:'OWNER_VOLUME_POLICY_20261019',scopeKey:'*',valueJson:policy,effectiveFrom:at}});
  const person=await db.person.create({data:{legalName:'ISOLATED PACKAGE BOUNDARY',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}});
  const product=await db.productReference.create({data:{sku:'PB-'+token,displayName:'Isolated package product',currentPrice:'4800'}});
  const rule=await db.productRuleProfile.create({data:{productId:product.productId,effectiveFrom:at,gpvRate:'0.6',ruleVersionCode:'R1.0B'}});
  const packages=new PackageConfigService(db as any),profile=await db.packageProfile.findUniqueOrThrow({where:{stableCode:'STARTER'}});
  const version=await packages.addVersion(profile.packageProfileId,{displayName:'Isolated starter',currency:'TWD',priceAmount:'14400',selectableProductQuantity:3,membershipEffect:'FORMAL_ELIGIBILITY',qualificationEffect:'CREATE_QUALIFICATION',targetQualificationRequired:false,recognitionConfigRef:'PO_20261019_QUALIFICATION_GPV_ONLY'},'fixture-author');
  await packages.setProducts(version.packageProfileVersionId,[{productRuleProfileId:rule.productRuleProfileId,maxQty:3}]);
  await packages.approve(version.packageProfileVersionId,'ISOLATED_TEST','fixture-approver');
  await packages.activate(version.packageProfileVersionId);
  const idempotency=new IdempotencyService(db as any),audit=new AuditService(),outbox=new OutboxService();
  const orders=new OrderService(db as any,idempotency,audit,outbox,packages);
  const input={packageVersionId:version.packageProfileVersionId,selections:[{productRuleProfileId:rule.productRuleProfileId,quantity:3}]};
  const key=randomUUID(),request=randomUUID();
  const order=(await orders.createMember(input,key,request,person.personId)).value;
  expect((await orders.createMember(input,key,request,person.personId)).value.orderId).toBe(order.orderId);
  expect(order.ruleVersionCode).toBe('R1.0B');
  const snapshot=await db.packagePurchaseSnapshot.findUniqueOrThrow({where:{orderId:order.orderId}});
  expect(snapshot.recognitionConfigRef).toBe('PO_20261019_QUALIFICATION_GPV_ONLY');
  expect(order.parameterSnapshotHash).not.toBe(snapshot.packageConfigHash);
  const parameters=await captureParameters(db as any,order.confirmedAt!,'R1.0B');
  expect(order.parameterSnapshotHash).toBe(parameters.hash);
  await orders.confirmPayment(order.orderId,{amount:'14400',paymentMethod:'TEST_ONLY',referenceNo:token,occurredAt:new Date().toISOString()},randomUUID(),request);
  const before={returns:await db.returnCase.count(),events:await db.outboxEvent.count(),ledger:await db.pvLedger.count()};
  const returns=new ReturnService(db as any,idempotency,audit,outbox);
  for(const quantity of ['1','3']){
   await expect(returns.post(order.orderId,{lines:[{orderLineId:order.lines[0].orderLineId,quantity}],reasonCode:'ISOLATED_TEST',occurredAt:new Date().toISOString()},randomUUID(),request)).rejects.toMatchObject({response:{code:'PACKAGE_RETURN_ALLOCATION_PENDING'}});
  }
  expect({returns:await db.returnCase.count(),events:await db.outboxEvent.count(),ledger:await db.pvLedger.count()}).toEqual(before);
  expect((await db.order.findUniqueOrThrow({where:{orderId:order.orderId}})).status).toBe('PAID');
  expect(await db.returnLine.count({where:{orderLineId:order.lines[0].orderLineId}})).toBe(0);
 });
 it('rejects mixed Core versions and missing historical policy without substituting current configuration',async()=>{
  const version={recognitionConfigRef:'PO_20261019_QUALIFICATION_GPV_ONLY',configHash:'a'.repeat(64)};
  await expect(resolvePackageParameters(db as any,new Date(),version,['R1.0B','OTHER'])).rejects.toMatchObject({response:{code:'PACKAGE_CORE_RULE_MISMATCH'}});
  await expect(resolvePackageParameters(db as any,new Date('2000-01-01'),version,['R1.0B'])).rejects.toMatchObject({response:{code:'PACKAGE_POLICY_CONFIGURATION_PENDING'}});
  expect(await resolvePackageParameters(db as any,new Date(),{recognitionConfigRef:'LEGACY',configHash:'old'},[])).toEqual({ruleVersionCode:'LEGACY',parameterSnapshotHash:'old'});
 });
});
