import {randomUUID} from 'node:crypto';
import {ConfigService} from '@nestjs/config';
import {PrismaService} from '@ucell/database';
import {FormalEnrollmentService} from '../src/modules/member/formal-enrollment.service';
import {AuditService} from '../src/common/audit/audit.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {OutboxService} from '../src/common/outbox/outbox.service';
import {OrderService} from '../src/modules/order/order.service';
import {createActiveQualificationPackage} from './helpers/package-config.fixture';
describe('Formal enrollment Stage payments in isolated real DB',()=>{
 const db=new PrismaService(),audit=new AuditService(),idempotency=new IdempotencyService(db),orders=new OrderService(db,idempotency,audit,new OutboxService());
 const config=new ConfigService({UCELL_ENVIRONMENT:'STAGE',STAGE_PAYMENT_MODE:'ASSUME_PAID',NODE_ENV:'test',DATABASE_URL:process.env.DATABASE_URL});
 const service=new FormalEnrollmentService(db,config,idempotency,audit,orders);
 beforeAll(()=>{const url=new URL(process.env.DATABASE_URL!);if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^\/ucell_jest_[a-f0-9]{32}$/.test(url.pathname))throw Error('Isolated harness required');});
 afterAll(()=>db.$disconnect());
 const person=()=>db.person.create({data:{legalName:'TEST ONLY ENROLLMENT',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}});
 it('pays only the owned retail order once without granting formal membership',async()=>{
  const p=await person(),other=await person(),order=await db.order.create({data:{purchaserPersonId:p.personId,purpose:'RETAIL',status:'CONFIRMED',grossAmount:'120',netAmount:'120',ruleVersionCode:'R1.0B'}});
  await expect(service.payCommerce(other.personId,order.orderId,randomUUID(),'TEST_ONLY')).rejects.toMatchObject({response:{code:'STAGE_COMMERCE_ORDER_NOT_FOUND'}});
  expect(await service.payCommerce(p.personId,order.orderId,randomUUID(),'TEST_ONLY')).toMatchObject({status:'PAID',amount:'120.00'});
  await service.payCommerce(p.personId,order.orderId,randomUUID(),'TEST_ONLY');
  expect(await db.paymentEvent.count({where:{orderId:order.orderId}})).toBe(1);
  expect((await db.person.findUniqueOrThrow({where:{personId:p.personId}})).membershipState).toBe('NETWORK_MEMBER');
 });
 it('records one fixed 600 payment, enters pending and never creates a Ball or GPV',async()=>{
  const p=await person(),key=randomUUID(),balls=await db.qualification.count(),gpv=await db.pvLedger.count();
  const first=await service.payFee(p.personId,key,'TEST_ONLY'),retry=await service.payFee(p.personId,key,'TEST_ONLY'),again=await service.payFee(p.personId,randomUUID(),'TEST_ONLY');
  expect(first.value).toMatchObject({amount:'600.00',status:'PAID',simulation:true});expect(retry.replayed).toBe(true);expect(again.value.orderId).toBe(first.value.orderId);
  expect(await db.order.count({where:{purchaserPersonId:p.personId,purpose:'FORMAL_MEMBERSHIP_FEE'}})).toBe(1);
  expect(await db.paymentEvent.count({where:{orderId:first.value.orderId}})).toBe(1);
  expect(await db.qualification.count()).toBe(balls);expect(await db.pvLedger.count()).toBe(gpv);
  expect((await service.status(p.personId)).membershipState).toBe('FORMAL_PENDING');
 });
 it('denies simulated payment in Production before writing money evidence',async()=>{
  const p=await person(),production=new FormalEnrollmentService(db,new ConfigService({UCELL_ENVIRONMENT:'PRODUCTION',STAGE_PAYMENT_MODE:'ASSUME_PAID'}),idempotency,audit,orders);
  await expect(production.payFee(p.personId,randomUUID(),'TEST_ONLY')).rejects.toMatchObject({response:{code:'STAGE_PAYMENT_NOT_AVAILABLE'}});
  expect(await db.order.count({where:{purchaserPersonId:p.personId}})).toBe(0);
 });
 it('pays only the owned package through canonical setup once and prevents an extra fee',async()=>{
  const p=await person(),other=await person(),f=await createActiveQualificationPackage(db);
  const created=await orders.createMember({packageVersionId:f.version.packageProfileVersionId,selections:[{productRuleProfileId:f.rule.productRuleProfileId,quantity:1}]},randomUUID(),'TEST_ONLY',p.personId);
  const id=created.value.orderId,key=randomUUID();
  await expect(service.payPackage(other.personId,id,key,'TEST_ONLY')).rejects.toMatchObject({response:{code:'ENROLLMENT_PACKAGE_ORDER_NOT_FOUND'}});
  const paid=await service.payPackage(p.personId,id,key,'TEST_ONLY');expect(paid).toMatchObject({status:'PAID',amount:'14400.00'});
  await service.payPackage(p.personId,id,key,'TEST_ONLY');expect(await db.paymentEvent.count({where:{orderId:id}})).toBe(1);
  expect(await db.qualificationSetup.count({where:{qualifyingOrderId:id}})).toBe(1);
  expect((await db.qualification.findUniqueOrThrow({where:{qualificationId:paid.qualificationId!}})).status).toBe('DRAFT');
  expect((await service.status(p.personId)).paidPackages).toHaveLength(1);
  await expect(service.payFee(p.personId,randomUUID(),'TEST_ONLY')).rejects.toMatchObject({response:{code:'FORMAL_FEE_ALREADY_COVERED_BY_PACKAGE'}});
 });
 it('requires payment and files for own submission without granting scan clearance or approval',async()=>{
  const p=await person(),other=await person(),app=await db.formalMemberApplication.create({data:{personId:p.personId,currentSnapshotHash:'a'.repeat(64)}});
  await expect(service.submit(other.personId,app.formalMemberApplicationId,randomUUID(),'TEST_ONLY')).rejects.toMatchObject({response:{code:'FORMAL_APPLICATION_NOT_FOUND'}});
  await expect(service.submit(p.personId,app.formalMemberApplicationId,randomUUID(),'TEST_ONLY')).rejects.toMatchObject({response:{code:'FORMAL_ENROLLMENT_PAYMENT_REQUIRED'}});
  await service.payFee(p.personId,randomUUID(),'TEST_ONLY');
  await expect(service.submit(p.personId,app.formalMemberApplicationId,randomUUID(),'TEST_ONLY')).rejects.toMatchObject({response:{code:'FORMAL_ENROLLMENT_DOCUMENTS_REQUIRED'}});
  for(const documentType of ['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'] as const)await db.formalApplicationDocument.create({data:{formalMemberApplicationId:app.formalMemberApplicationId,documentType,status:'PRESENT',malwareScanStatus:'PENDING',storageObjectKey:'TEST_ONLY/'+randomUUID(),contentSha256:'a'.repeat(64),mimeType:'image/png',sizeBytes:8,uploadedAt:new Date()}});
  expect((await service.submit(p.personId,app.formalMemberApplicationId,randomUUID(),'TEST_ONLY')).value.status).toBe('SUBMITTED');
  expect((await db.person.findUniqueOrThrow({where:{personId:p.personId}})).membershipState).toBe('FORMAL_PENDING');
  expect(await db.formalApplicationDocument.count({where:{formalMemberApplicationId:app.formalMemberApplicationId,malwareScanStatus:'CLEAN'}})).toBe(0);
 });
});
