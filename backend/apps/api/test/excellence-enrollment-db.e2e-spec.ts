import {randomBytes,randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {PiiCryptoService} from '@ucell/database';
import {createEffectiveMemberSponsorFixture} from './helpers/member-sponsor.fixture';
import {createEnrollmentBundleFixture,prepareEnrollmentReview} from './helpers/enrollment-bundle.fixture';
import {FormalMemberApplicationService} from '../src/modules/member/formal-member-application.service';
import {IdentityMatchFingerprintService} from '../src/common/security/identity-match-fingerprint.service';
import {PackageConfigService} from '../src/modules/package-config/package-config.service';
import {quoteEntry} from '../src/modules/coupon/entry-pricing';
import {QualificationPlacementService} from '../src/modules/qualification/qualification-placement.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {activateEnrollmentBundleIfReady} from '../src/modules/member-bundle/excellence-activation';
import {enrollmentBundlePayment} from '../src/modules/member/enrollment-bundle-payment';
import {reportBundleTransfer} from '../src/modules/member/enrollment-bundle-report';
import {adminBundlePayment} from '../src/modules/order/enrollment-bundle-receipt';
import {OrderService} from '../src/modules/order/order.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('Combined enrollment prepayment and atomic per-ball entitlements',()=>{
  const db=new PrismaClient({datasources:{db:{url}}});
  const originalKey=process.env.PII_ENCRYPTION_KEY,originalVersion=process.env.PII_ENCRYPTION_KEY_VERSION;
  beforeAll(()=>{
    process.env.PII_ENCRYPTION_KEY=randomBytes(32).toString('base64');
    process.env.PII_ENCRYPTION_KEY_VERSION='synthetic-excellence';
  });
  afterAll(async()=>{
    if(originalKey===undefined)delete process.env.PII_ENCRYPTION_KEY;else process.env.PII_ENCRYPTION_KEY=originalKey;
    if(originalVersion===undefined)delete process.env.PII_ENCRYPTION_KEY_VERSION;else process.env.PII_ENCRYPTION_KEY_VERSION=originalVersion;
    await db.$disconnect();
  });
  it('accepts a verified transfer before sponsor selection and activates three separately funded quarters only after group approval and placement',async()=>{
    const f=await createEnrollmentBundleFixture(db),sponsor=await createEffectiveMemberSponsorFixture(db);
    const actor=sponsor.actor.personId!, uid=randomUUID();
    const catalog=new PackageConfigService(db as any);
    const product=await db.productReference.create({data:{sku:'QUARTER-'+uid,displayName:'Fixture',currentPrice:3000}});
    const rule=await db.productRuleProfile.create({data:{productId:product.productId,effectiveFrom:new Date(0),gpvRate:0,ruleVersionCode:'R1.0B',parameterSnapshotHash:'b'.repeat(64)}});
    await db.runtimeRuleParameter.createMany({skipDuplicates:true,data:[{ruleVersionCode:'R1.0B',parameterCode:'OWNER_VOLUME_POLICY_20261019',scopeKey:'*',effectiveFrom:new Date(0),valueJson:{
      gpvRate:'0.6',rpvRate:'0.6',epvRate:'0.6',qualificationPackage:{gpv:true,rpv:false,epv:false,active:'PAYMENT_CALENDAR_MONTH_ASIA_TAIPEI'}
    }}]});
    const quarter=await db.packageProfile.findUniqueOrThrow({where:{stableCode:'ACTIVE_QUARTER'}});
    const config=await catalog.addVersion(quarter.packageProfileId,{displayName:'季活躍',currency:'TWD',priceAmount:'6000',selectableProductQuantity:2,
      membershipEffect:'NONE',qualificationEffect:'ACTIVE_ENTITLEMENT',targetQualificationRequired:true,activeDurationUnit:'MONTH',activeDurationValue:3,
      recognitionConfigRef:'PO_20261019_REPURCHASE_60'},'fixture');
    const repId=config.packageProfileVersionId,from=new Date(Date.now()-60000).toISOString();
    await catalog.setProducts(repId,[{productRuleProfileId:rule.productRuleProfileId,minQty:2,maxQty:2}]);
    await catalog.approve(repId,'TEST-'+uid,'approver');
    await catalog.schedule(repId,{effectiveFrom:from,salesFrom:from});
    await catalog.activate(repId,new Date());
    const version=await db.packageProfileVersion.findUniqueOrThrow({where:{packageProfileVersionId:repId},include:{profile:true}});
    const price=await quoteEntry(db as any,version,undefined,f.personId);
    const repurchase={packageVersionId:repId,quoteHash:price.quoteHash,selections:[{productRuleProfileId:rule.productRuleProfileId,quantity:2}]};
    const input={...f.input,planCode:'EXCELLENCE' as const,balls:Array.from({length:3},()=>({qualification:f.qualification,repurchase}))};
    const create=(body:typeof f.input)=>f.service.create(f.personId,f.applicationId,body,randomUUID(),randomUUID());
    await expect(create({...input,balls:f.input.balls})).rejects.toMatchObject({response:{code:'EXCELLENCE_SELECTION_INVALID'}});
    await expect(create({...input,balls:input.balls.slice(0,2)})).rejects.toMatchObject({response:{code:'EXCELLENCE_SELECTION_INVALID'}});
    const g=(await create(input)).value, ids=g.balls.map(b=>b.qualificationId),orders=g.balls.flatMap(b=>[b.qualification.orderId,b.repurchase!.orderId]);
    expect(g).toMatchObject({rootSponsor:null,planCode:'EXCELLENCE',paymentPolicy:'COMBINED',payableTotal:'63000.00'});
    expect(g.balls[0].repurchase?.packageName).toBe('重銷（三個月）');
    const view=()=>enrollmentBundlePayment(db as any,f.applicationId,f.personId);
    const progress=()=>db.$transaction(tx=>activateEnrollmentBundleIfReady(tx,f.applicationId,randomUUID()));
    const bank={amount:g.payableTotal,paymentMethod:'BANK_TRANSFER',referenceNo:uid,occurredAt:new Date().toISOString()};
    await db.$transaction(tx=>reportBundleTransfer(tx,f.applicationId,f.personId,{amount:bank.amount,accountLastFive:'12345',paidAt:bank.occurredAt}));
    const pii=new PiiCryptoService(),releaseModules=process.env.EXCELLENCE_RELEASE_MODULES;
    const ReviewService=releaseModules
      ? require(releaseModules+'/member/formal-member-application.service.js').FormalMemberApplicationService
      : FormalMemberApplicationService;
    const reviewer=new ReviewService(db as any,f.idem,f.audit,pii,new IdentityMatchFingerprintService());
    const approvedName=await prepareEnrollmentReview(db,f.applicationId,actor,pii);
    await reviewer.beginReview(f.applicationId,actor,randomUUID());
    const approve=()=>reviewer.approve(f.applicationId,actor,randomUUID());
    await expect(approve()).rejects.toMatchObject({response:{code:'FORMAL_ENROLLMENT_BUNDLE_ROOT_UNPAID'}});
    expect((await view())?.rootPaid).toBe(false);
    expect(await progress()).toEqual({status:'AWAITING_PAYMENT'});
    const pay=(amount:string)=>f.orders.confirmEnrollmentPayment(orders[1],{...bank,amount},randomUUID(),randomUUID(),actor);
    await expect(pay(g.qualificationTotal)).rejects.toMatchObject({response:{code:'BUNDLE_RECEIPT_AMOUNT_MISMATCH'}});
    await pay(g.payableTotal);
    await pay(g.payableTotal);
    expect((await adminBundlePayment(db as any,orders[1]))?.lines.map(l=>l.kind)).toEqual(['ENTRY','REPURCHASE','ENTRY','REPURCHASE','ENTRY','REPURCHASE']);
    expect((await view())?.rootPaid).toBe(true);
    expect(await progress()).toEqual({status:'AWAITING_APPROVAL'});
    expect(await db.paymentEvent.count({where:{orderId:{in:orders}}})).toBe(0);
    expect(await db.subscription.count({where:{qualificationId:{in:ids}}})).toBe(0);
    expect(await approve()).toMatchObject({status:'APPROVED',approvedQualifications:3,bundleId:g.bundleId,activationStatus:'AWAITING_PLACEMENT'});
    await expect(approve()).rejects.toMatchObject({response:{code:'FORMAL_APPLICATION_NOT_APPROVABLE'}});
    const approvals=await db.auditEvent.findMany({where:{entityId:f.applicationId,action:'FORMAL_APPLICATION_APPROVED'}});
    expect(approvals).toHaveLength(1);
    expect(approvals[0].afterData).toMatchObject({bundleId:g.bundleId,qualificationCount:3});
    const member=await db.person.findUniqueOrThrow({where:{personId:f.personId}});
    expect(member.membershipState).toBe('FORMAL_MEMBER');
    if(releaseModules)expect(member.legalName).toBe(approvedName);
    expect(await progress()).toEqual({status:'AWAITING_PLACEMENT'});
    expect(await db.sponsorRelationship.count({where:{childQualificationId:{in:ids}}})).toBe(0);
    await f.service.setRootSponsor(f.personId,f.applicationId,sponsor.qualification.ballNo!,randomUUID(),randomUUID());
    expect(await db.paymentEvent.count({where:{orderId:{in:orders}}})).toBe(3);
    expect(await db.subscription.count({where:{qualificationId:{in:ids}}})).toBe(0);
    const placement=new QualificationPlacementService(db as any,f.idem,f.audit,new OrganizationService(db as any));
    const root={qualificationId:ids[0],binaryParentQualificationId:sponsor.qualification.qualificationId,side:'LEFT' as const,reasonCode:'test placement'};
    const key=randomUUID();
    const original=OrderService.applyEnrollmentAllocation;
    const failLast=jest.spyOn(OrderService,'applyEnrollmentAllocation').mockImplementation((...args)=>{
      if(args[1]===orders[5])throw Error('third repurchase interrupted');
      return original(...args);
    });
    try {await expect(placement.placeByAdmin(actor,root,key,randomUUID())).rejects.toThrow('third repurchase interrupted');}
    finally {failLast.mockRestore();}
    expect(await db.subscription.count({where:{qualificationId:{in:ids}}})).toBe(0);
    expect(await db.binaryPlacement.count({where:{childQualificationId:{in:ids}}})).toBe(0);
    expect(await db.qualification.count({where:{qualificationId:{in:ids},status:'DRAFT'}})).toBe(3);
    expect(await db.paymentEvent.count({where:{orderId:{in:orders}}})).toBe(3);
    await placement.placeByAdmin(actor,root,key,randomUUID());
    await placement.placeByAdmin(actor,root,key,randomUUID());
    expect(await progress()).toEqual({status:'ACTIVE'});
    expect(await db.paymentEvent.count({where:{orderId:{in:orders}}})).toBe(6);
    for(const [i,id] of ids.entries()){
      const expectedParent=i?ids[0]:sponsor.qualification.qualificationId;
      expect(await db.sponsorRelationship.findUniqueOrThrow({where:{childQualificationId:id}})).toMatchObject({sponsorQualificationId:expectedParent});
      expect(await db.binaryPlacement.findUniqueOrThrow({where:{childQualificationId:id}})).toMatchObject({parentQualificationId:expectedParent,side:i===2?'RIGHT':'LEFT'});
      const sub=await db.subscription.findMany({where:{qualificationId:id},include:{schedules:true}});
      expect(sub).toHaveLength(1);
      expect(sub[0]).toMatchObject({orderId:g.balls[i].repurchase!.orderId,status:'ACTIVE'});
      expect(sub[0].schedules).toHaveLength(3);
    }
  },120000);
});
