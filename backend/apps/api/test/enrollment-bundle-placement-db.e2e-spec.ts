import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {AuditService} from '../src/common/audit/audit.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {OutboxService} from '../src/common/outbox/outbox.service';
import {BinaryTreeService} from '../src/modules/binary-tree/binary-tree.service';
import {EnrollmentBundleService} from '../src/modules/member-bundle/enrollment-bundle.service';
import {OrderService} from '../src/modules/order/order.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {PackageConfigService} from '../src/modules/package-config/package-config.service';
import {internalSponsorAtPayment} from '../src/modules/qualification/enrollment-bundle-placement';
import {QualificationPlacementService} from '../src/modules/qualification/qualification-placement.service';
import {SponsorResolver} from '../src/modules/qualification/sponsor-resolver.service';
import {createEffectiveMemberSponsorFixture} from './helpers/member-sponsor.fixture';
import {createEnrollmentBundleFixture,markPreexistingCheckout} from './helpers/enrollment-bundle.fixture';
import {quoteEntry} from '../src/modules/coupon/entry-pricing';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;

describeDb('Formal enrollment group placement on PostgreSQL',()=>{
  const db=new PrismaClient({datasources:{db:{url}}});
  const idem=new IdempotencyService(db as any), audit=new AuditService(), org=new OrganizationService(db as any);
  const packages=new PackageConfigService(db as any);
  const orders=new OrderService(db as any,idem,audit,new OutboxService(),packages,new SponsorResolver(db as any),org);
  const checkout=new EnrollmentBundleService(db as any,orders,idem,audit);
  const placement=new QualificationPlacementService(db as any,idem,audit,org);
  const trees=new BinaryTreeService(db as any,idem,org);
  let sample:Awaited<ReturnType<typeof createEnrollmentBundleFixture>>;
  beforeAll(async()=>{sample=await createEnrollmentBundleFixture(db);});
  afterAll(()=>db.$disconnect());

  it.each(['admin-console','sponsor-owner'] as const)('places four balls once through %s, rolling back failed attempts',async route=>{
    const fixture=await createEffectiveMemberSponsorFixture(db), sponsor=fixture.qualification.qualificationId;
    const person=await db.person.create({data:{legalName:'Placement '+randomUUID(),status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}});
    const app=await db.formalMemberApplication.create({data:{personId:person.personId,currentSnapshotHash:'a'.repeat(64)}});
    const input=sample.qualification;
    const {pricing}=await db.$transaction(tx=>packages.checkoutData(tx,person.personId,input));
    const rp=await db.packageProfileVersion.findUniqueOrThrow({where:{packageProfileVersionId:sample.repurchase.packageVersionId},include:{profile:true}});
    const rpQuote=await quoteEntry(db as any,rp,undefined,person.personId);
    const repurchase={...sample.repurchase,quoteHash:rpQuote.quoteHash};
    await markPreexistingCheckout(db,app.formalMemberApplicationId);
    const group=(await checkout.create(person.personId,app.formalMemberApplicationId,{sponsorCode:fixture.qualification.ballNo!,fulfillmentMethod:'COMPANY_PICKUP',
      balls:Array.from({length:4},(_,index)=>({qualification:{...input,quoteHash:pricing.quoteHash},...(index===1?{repurchase}:{})}))},randomUUID(),randomUUID())).value;
    const ids=group.balls.map(ball=>ball.qualificationId);
    const [root,left,right]=ids;
    expect(ids).toHaveLength(4);
    const inGroup={childQualificationId:{in:ids}};
    const assertUnplaced=async()=>{
      expect(await db.binaryPlacement.count({where:inGroup})).toBe(0);
      expect(await db.qualification.count({where:{qualificationId:{in:ids},status:'DRAFT'}})).toBe(4);
      expect(await db.placementEvidence.count({where:{qualificationId:{in:ids}}})).toBe(0);
    };
    await expect(db.$transaction(tx=>internalSponsorAtPayment(tx,left,group.balls[1].qualification.orderId,new Date())))
      .rejects.toMatchObject({response:{code:'BUNDLE_PARENT_PAYMENT_REQUIRED'}});
    await expect(db.sponsorRelationship.create({data:{childQualificationId:left,sponsorQualificationId:sponsor,sponsorSequenceNo:5,effectiveFrom:new Date()}}))
      .rejects.toThrow(/BUNDLE_SPONSOR_MISMATCH/);
    const actor=fixture.actor.personId!, treeId=fixture.tree.binaryTreeId;
    await orders.confirmEnrollmentPayment(group.balls[0].qualification.orderId,
      {amount:group.qualificationTotal,paymentMethod:'BANK_TRANSFER',referenceNo:randomUUID(),occurredAt:new Date().toISOString()},
      randomUUID(),randomUUID(),actor);
    const expectedParents=[sponsor,root,root,left];
    for (const [index,id] of ids.entries()) {
      expect(await db.sponsorRelationship.findUniqueOrThrow({where:{childQualificationId:id}}))
        .toMatchObject({sponsorQualificationId:expectedParents[index],sponsorSequenceNo:[1,1,2,1][index]});
    }
    await assertUnplaced();
    await expect(db.$transaction(tx=>org.createBinaryPlacement(tx,{childQualificationId:root,parentQualificationId:sponsor,side:'LEFT',effectiveFrom:new Date()},{sourceType:'FIXTURE',actorId:actor,reason:'incomplete bundle'})))
      .rejects.toThrow(/BUNDLE_GROUP_PLACEMENT_INCOMPLETE/);
    expect(await placement.pendingForSponsorOwner(person.personId)).toEqual([]);
    expect(await placement.pendingForSponsorOwner(fixture.holder.personId)).toMatchObject([{bundleBallCount:4}]);
    const addon=group.balls[1].repurchase!;
    const payAddon=()=>orders.confirmPayment(addon.orderId,{amount:addon.total,paymentMethod:'BANK_TRANSFER',referenceNo:randomUUID(),occurredAt:new Date().toISOString()},randomUUID(),randomUUID(),actor,'MANUAL_ADMIN');
    await expect(payAddon()).rejects.toMatchObject({response:{code:'BUNDLE_REPURCHASE_AWAITS_PLACEMENT'}});
    const rootPlacement={qualificationId:root,binaryParentQualificationId:sponsor,side:'RIGHT' as const,reasonCode:'bundle-test'};
    await expect(placement.placeByAdmin(actor,rootPlacement,randomUUID(),randomUUID()))
      .rejects.toMatchObject({response:{code:'FORMAL_MEMBERSHIP_APPROVAL_REQUIRED'}});
    await expect(placement.placeByAdmin(actor,{...rootPlacement,qualificationId:left},randomUUID(),randomUUID()))
      .rejects.toMatchObject({response:{code:'BUNDLE_ROOT_PLACEMENT_REQUIRED'}});
    await assertUnplaced();
    await db.person.update({where:{personId:person.personId},data:{membershipState:'FORMAL_MEMBER'}});
    const write=org.createBinaryPlacement.bind(org);
    const failThird=jest.spyOn(org,'createBinaryPlacement').mockImplementation((tx,edge,metadata)=>{
      if(edge.childQualificationId===right)throw new Error('third placement interrupted');
      return write(tx,edge,metadata);
    });
    try {
      await expect(placement.placeByAdmin(actor,rootPlacement,randomUUID(),randomUUID())).rejects.toThrow('third placement interrupted');
    } finally {failThird.mockRestore();}
    await assertUnplaced();
    const {topologyVersion}=await db.binaryTree.findUniqueOrThrow({where:{binaryTreeId:treeId}});
    const place={qualificationId:root,binaryParentQualificationId:sponsor,side:'RIGHT' as const,expectedVersion:topologyVersion,reason:'enrollment bundle'};
    const key=randomUUID();
    if(route==='admin-console') {
      const preflight=await trees.preview(fixture.actor,treeId,place);
      const confirmed={...place,preflightToken:preflight.preflightToken};
      expect((await trees.place(fixture.actor,treeId,confirmed,key)).value.topologyVersion).toBe(topologyVersion+4);
      expect((await trees.place(fixture.actor,treeId,confirmed,key)).replayed).toBe(true);
    } else {
      const pending=await placement.pendingForSponsorOwner(fixture.holder.personId);
      const external={placementReference:pending[0].placementReference!,binaryParentBallNo:fixture.qualification.ballNo!,side:'RIGHT' as const};
      const first=await placement.placeBySponsorOwnerReference(fixture.holder.personId,external,key,randomUUID());
      expect(await placement.placeBySponsorOwnerReference(fixture.holder.personId,external,key,randomUUID())).toEqual(first);
    }
    for (const [index,id] of ids.entries()) {
      expect(await db.binaryPlacement.findUniqueOrThrow({where:{childQualificationId:id}}))
        .toMatchObject({parentQualificationId:expectedParents[index],side:index===0||index===2?'RIGHT':'LEFT'});
      expect(await db.binaryTreeMembership.findUniqueOrThrow({where:{qualificationId:id}})).toMatchObject({binaryTreeId:treeId});
      expect(await db.qualification.findUniqueOrThrow({where:{qualificationId:id}})).toMatchObject({status:'EFFECTIVE',ballNo:expect.any(String)});
      expect(await db.placementEvidence.findFirstOrThrow({where:{qualificationId:id}}))
        .toMatchObject({placedByType:index===0?(route==='admin-console'?'ADMIN_OVERRIDE':'SPONSOR_OWNER'):'SYSTEM_AUTO'});
      expect(await db.outboxEvent.count({where:{aggregateId:id,eventType:'QUALIFICATION_PLACED'}})).toBe(1);
    }
    await payAddon();
    const addOnPayment=await db.outboxEvent.findFirstOrThrow({where:{aggregateId:addon.orderId,eventType:'PACKAGE_PAYMENT_CONFIRMED'}});
    expect(addOnPayment.payload).toMatchObject({qualificationId:left,orderId:addon.orderId,packageClass:'ACTIVE_DURATION'});
    expect(await db.paymentEvent.count({where:{orderId:addon.orderId}})).toBe(1);
  },120000);
});
