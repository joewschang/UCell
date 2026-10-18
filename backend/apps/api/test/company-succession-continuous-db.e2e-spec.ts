import {randomUUID} from 'node:crypto';
import {PrismaService,Prisma,captureParameters,recognizeConsumption,sealGpvEvent,processHistoricalReturn} from '@ucell/database';
import {BinaryTreeService,TreePrincipal} from '../src/modules/binary-tree/binary-tree.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {BonusQueryService} from '../src/modules/bonus/bonus-query.service';
import {GlobalPoolService} from '../src/modules/global-pool/global-pool.service';
import {GlobalPoolPersistence} from '../src/modules/global-pool/global-pool-persistence';
import {UnifiedPayableService} from '../src/modules/payout/unified-payable.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw Error('ISOLATED_DATABASE_REQUIRED');
const db=new PrismaService(),query=new BonusQueryService(db),ids:string[]=[];
let tree:any,product:any,start:Date,first:any,second:any,returned:any,companyOrders:any[],originalAwards:any,memberPayables:any;
const day=86400000,at=(days:number)=>new Date(start.getTime()+days*day);
// Synthetic 30-day periods advance business time; wall-clock and tree guards remain real.
const calendar={captureForPeriod:(tx:Prisma.TransactionClient,_start:Date,end:Date)=>captureParameters(tx,end,'R1.0B')};
const global=new GlobalPoolService(db,{} as any,query,calendar as any,new GlobalPoolPersistence());
const pay=new UnifiedPayableService(db,{} as any);
afterAll(()=>db.$disconnect());
async function sources(offset:number){
 const orders:any[]=[];
 for(const qid of ids.slice(1)){
  const paidAt=at(offset),snapshot=await captureParameters(db as any,paidAt,'R1.0B');
  const order=await db.order.create({data:{qualificationId:qid,purpose:'RETAIL',status:'PAID',paidAt,grossAmount:4000000,netAmount:4000000,ruleVersionCode:'R1.0B',parameterSnapshotHash:snapshot.hash,
   lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:4000000,lineAmount:4000000,gpvRateSnapshot:1,gpvAmountSnapshot:4000000,ruleProfileSnapshot:{synthetic:true}}}},include:{lines:true}});
  await db.$transaction(async tx=>{const r=await recognizeConsumption(tx,{qualificationId:qid,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,amount:4000000,eligible:true,concreteVolumeType:'GPV',productProfileVersion:'SYNTHETIC',ruleVersionCode:'R1.0B',parameterSnapshotHash:snapshot.hash,recognizedAt:paidAt,activeThreshold:'2000'});await sealGpvEvent(tx,r.volume!);});
  orders.push(order);
 }
 return orders;
}
beforeAll(async()=>{
 const person=await db.person.create({data:{legalName:'SYNTHETIC CONTINUOUS SUCCESSION'}}),subject=randomUUID();
 await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
 await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode:'SUPER_ADMIN',validFrom:new Date(Date.now()-1000)}});
 const session=await db.authSession.create({data:{personId:person.personId,provider:'ENTRA',subject,roleCode:'SUPER_ADMIN',tokenHash:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+3600000)}});
 const principal:TreePrincipal={personId:person.personId,provider:'ENTRA',subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};
 const trees=new BinaryTreeService(db,new IdempotencyService(db),new OrganizationService(db));
 tree=(await trees.create(principal,{treeName:'Continuous company succession',reason:'Synthetic evidence-complete fixture'},randomUUID())).value;
 await trees.change(principal,tree.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'Synthetic'},randomUUID());
 for(let i=0;i<3;i++){
  const now=new Date(),q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:now}});ids.push(q.qualificationId);
  await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:now,sourceType:'SYNTHETIC'}});
  await db.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:now,sourceType:'SYNTHETIC'}});
  await db.qualificationHolderHistory.create({data:{qualificationId:q.qualificationId,holderPersonId:person.personId,effectiveFrom:now,sourceType:'SYNTHETIC',sourceId:randomUUID()}});
  if(i===0)await trees.confirmCompanySponsor(principal,tree.binaryTreeId,{qualificationId:q.qualificationId,reason:'Synthetic'},randomUUID());
  else await db.sponsorRelationship.create({data:{childQualificationId:q.qualificationId,sponsorQualificationId:ids[0],sponsorSequenceNo:i,effectiveFrom:now}});
  await trees.place(principal,tree.binaryTreeId,{qualificationId:q.qualificationId,binaryParentQualificationId:i===0?tree.companyQualificationIds[3]:ids[0],side:i===2?'RIGHT':'LEFT',expectedVersion:2+i,reason:'Synthetic'},randomUUID());
 }
 start=new Date();
 await db.activePeriod.create({data:{qualificationId:ids[0],activeFrom:start,activeTo:at(31),ruleVersionCode:'R1.0B',sourceType:'SYNTHETIC',sourceId:randomUUID()}});
 product=await db.productReference.create({data:{sku:'SUCCESSION-'+randomUUID(),displayName:'Synthetic',currentPrice:4000000}});
},60000);
it('period one pays the member all five GLOBAL ranks with complete tree evidence',async()=>{
 await sources(10);first=await global.evaluateAndSettle(start,at(30));
 expect(first.distributedAmount.toString()).toBe('400000');expect(first.undistributedAmount.toString()).toBe('0');
 const awards=await db.globalPoolAward.findMany({where:{globalPoolSettlementId:first.globalPoolSettlementId}});
 expect(awards).toHaveLength(5);expect(awards.every(a=>a.qualificationId===ids[0])).toBe(true);
 expect(await db.awardEconomicDestination.count({where:{sourceSettlementId:first.globalPoolSettlementId}})).toBe(0);
 await pay.materialize(at(100));memberPayables=await db.payableEntry.findMany({where:{qualificationId:ids[0]},orderBy:{payableEntryId:'asc'}});
 expect(memberPayables).toHaveLength(5);expect(memberPayables.reduce((n:any,e:any)=>n.add(e.grossAmount),new Prisma.Decimal(0)).toString()).toBe('400000');
},60000);
it('period two routes the same member-origin qualification to company B without upgrading STARTER',async()=>{
 const company=await db.companyPrincipal.findUniqueOrThrow({where:{code:'UCELL_COMPANY'}}),owner=await db.qualificationOwnerInterval.findFirstOrThrow({where:{qualificationId:ids[0],effectiveTo:null}});
 await db.$transaction(async tx=>{
  await tx.qualificationOwnerInterval.update({where:{ownerIntervalId:owner.ownerIntervalId},data:{effectiveTo:at(31),closedRecordedAt:new Date()}});
  await tx.qualificationOwnerInterval.create({data:{qualificationId:ids[0],ownerType:'COMPANY',companyPrincipalId:company.companyPrincipalId,effectiveFrom:at(31),sourceType:'SYNTHETIC_COMPANY_SUCCESSION',sourceId:randomUUID(),evidenceHash:'e'.repeat(64)}});
  // Future simulation uses effective ownership intervals; the current holder must stay current.
 });
 expect(await query.isActiveAt(db as any,ids[0],at(60))).toBe(true);
 expect(await db.activePeriod.count({where:{qualificationId:ids[0],activeFrom:{lte:at(60)},OR:[{activeTo:null},{activeTo:{gt:at(60)}}]}})).toBe(0);
 companyOrders=await sources(40);second=await global.evaluateAndSettle(at(30),at(60));
 expect(second.distributedAmount.toString()).toBe('400000');
 const destinations=await db.awardEconomicDestination.findMany({where:{sourceSettlementId:second.globalPoolSettlementId},include:{effects:true}});
 expect(destinations).toHaveLength(5);
 for(const d of destinations){expect(d.qualificationId).toBe(ids[0]);expect(d.binaryTreeId).toBe(tree.binaryTreeId);expect(d.bindingId).toBeNull();expect(d.companyPosition).toBeNull();expect(d.effects).toHaveLength(1);expect(d.effects[0].amountDelta.eq(d.finalAmount)).toBe(true);}
 expect((await db.qualification.findUniqueOrThrow({where:{qualificationId:ids[0]}})).planLevelCode).toBe('STARTER');
 expect(await db.companyBootstrapProfileBinding.count({where:{qualificationId:ids[0]}})).toBe(0);
 await pay.materialize(at(100));expect(await db.payableEntry.findMany({where:{qualificationId:ids[0]},orderBy:{payableEntryId:'asc'}})).toEqual(memberPayables);
 originalAwards=await db.globalPoolAward.findMany({where:{globalPoolSettlementId:second.globalPoolSettlementId},orderBy:{globalPoolAwardId:'asc'}});
},60000);
it('period three return removes company entitlement through B adjustments and retains prior member payables',async()=>{
 const order=companyOrders[0];returned=await db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',postedAt:at(70),occurredAt:at(70),reasonCode:'SYNTHETIC_FULL_RETURN',idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:order.lines[0].orderLineId,quantity:1,returnAmount:4000000,gpvReversalAmount:4000000}}}});
 await db.$transaction(tx=>processHistoricalReturn(tx,returned.returnCaseId),{timeout:30000});
 const destinations=await db.awardEconomicDestination.findMany({where:{sourceSettlementId:second.globalPoolSettlementId},include:{effects:true}});
 for(const d of destinations){expect(d.effects).toHaveLength(2);expect(d.effects.reduce((n,e)=>n.add(e.amountDelta),new Prisma.Decimal(0)).toString()).toBe('0');}
 expect(await db.bonusRecoveryEvent.count({where:{returnCaseId:returned.returnCaseId}})).toBe(0);
 const reservoir=await db.reservoirLedgerEffect.aggregate({where:{sourceGlobalSettlementId:second.globalPoolSettlementId},_sum:{amount:true}});expect(reservoir._sum.amount!.toString()).toBe('200000');
 expect(await db.globalPoolAward.findMany({where:{globalPoolSettlementId:second.globalPoolSettlementId},orderBy:{globalPoolAwardId:'asc'}})).toEqual(originalAwards);
 expect(await db.payableEntry.findMany({where:{qualificationId:ids[0]},orderBy:{payableEntryId:'asc'}})).toEqual(memberPayables);
},60000);
it('settlement and return retries preserve destinations, effects and historical member economic ownership',async()=>{
 const state=async()=>({effects:await db.reservoirBEffect.findMany({orderBy:{effectId:'asc'}}),destinations:await db.awardEconomicDestination.findMany({orderBy:{destinationId:'asc'}}),a:await db.reservoirLedgerEffect.findMany(),payables:await db.payableEntry.findMany({orderBy:{payableEntryId:'asc'}})});
 const before=await state();
 await db.$transaction(tx=>processHistoricalReturn(tx,returned.returnCaseId),{timeout:30000});
 expect((await global.evaluateAndSettle(start,at(30))).globalPoolSettlementId).toBe(first.globalPoolSettlementId);
 expect((await global.evaluateAndSettle(at(30),at(60))).globalPoolSettlementId).toBe(second.globalPoolSettlementId);
 await pay.materialize(at(100));expect(await state()).toEqual(before);
 expect(await db.qualificationGlobalRankHistory.count({where:{qualificationId:ids[0]}})).toBe(5);
},60000);


