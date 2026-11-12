import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {createEnrollmentBundleFixture} from './helpers/enrollment-bundle.fixture';
import {createEffectiveMemberSponsorFixture} from './helpers/member-sponsor.fixture';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('formal application multi-qualification checkout',()=>{
  let db:PrismaClient;
  beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
  afterAll(()=>db.$disconnect());
  it('uses one atomic, owner-bound checkout, apportions packages, and safely recovers entirely expired bills',async()=>{
    const f=await createEnrollmentBundleFixture(db),key=randomUUID(),run=(body=f.input,idempotencyKey=key)=>f.service.create(f.personId,f.applicationId,body,idempotencyKey,randomUUID());
    expect(await f.service.read(f.personId,f.applicationId)).toBeNull();
    const other=await db.person.create({data:{legalName:'Another applicant',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}});
    await expect(f.service.read(other.personId,f.applicationId)).rejects.toMatchObject({response:{code:'FORMAL_APPLICATION_NOT_FOUND'}});
    await expect(f.service.create(other.personId,f.applicationId,f.input,randomUUID(),randomUUID())).rejects.toMatchObject({response:{code:'FORMAL_APPLICATION_NOT_FOUND'}});
    const invalid=structuredClone(f.input);
    invalid.balls[2].qualification.quoteHash='0'.repeat(64);
    await expect(run(invalid,randomUUID())).rejects.toMatchObject({response:{code:'PACKAGE_QUOTE_CHANGED'}});
    expect(await db.qualification.count({where:{currentHolderPersonId:f.personId}})).toBe(0);
    const result=await run();
    expect(result.replayed).toBe(false);
    const receipt=result.value;
    expect(receipt.balls.map(b=>[b.parentPosition,b.side])).toEqual([[null,null],[1,'LEFT'],[1,'RIGHT']]);
    expect(receipt.balls.map(b=>b.repurchase?.total??null)).toEqual([null,'6000.00',null]);
    expect(receipt.qualificationTotal).toBe('45000.00');
    expect(receipt.total).toBe('51000.00');
    expect(receipt.balls.every(b=>!b.repurchasePayable)).toBe(true);
    expect((await run()).value.bundleId).toBe(receipt.bundleId);
    expect((await run(f.input,randomUUID())).value.bundleId).toBe(receipt.bundleId);
    expect(await db.qualification.count({where:{currentHolderPersonId:f.personId}})).toBe(3);
    expect(await db.packagePurchaseSnapshot.findUniqueOrThrow({where:{orderId:receipt.balls[1].repurchase!.orderId}}))
      .toMatchObject({targetQualificationId:receipt.balls[1].qualificationId,personId:f.personId});
    await expect(run({...f.input,balls:f.input.balls.slice(0,2)})).rejects.toMatchObject({response:{code:'IDEMPOTENCY_CONFLICT'}});
    await expect(run({...f.input,balls:f.input.balls.slice(0,2)},randomUUID())).rejects.toMatchObject({response:{code:'ENROLLMENT_BUNDLE_EXISTS'}});
    await expect(f.orders.createMember(f.qualification as any,randomUUID(),randomUUID(),f.personId)).rejects.toMatchObject({response:{code:'ENROLLMENT_BUNDLE_EXISTS'}});
    await expect(f.service.release(f.personId,f.applicationId,receipt.bundleId,randomUUID(),randomUUID())).rejects.toMatchObject({response:{code:'ENROLLMENT_BUNDLE_CANNOT_RELEASE'}});
    const expiredClock=jest.spyOn(Date,'now').mockReturnValue(Date.now()+8*86400000);
    expect((await f.service.read(f.personId,f.applicationId))?.mayRestart).toBe(true);
    await f.service.release(f.personId,f.applicationId,receipt.bundleId,randomUUID(),randomUUID());
    expect(await f.service.read(f.personId,f.applicationId)).toBeNull();
    expect(await db.qualification.count({where:{currentHolderPersonId:f.personId,status:'VOIDED'}})).toBe(3);
    expiredClock.mockRestore();
    const replacement=(await run(f.input,randomUUID())).value;
    expect(replacement.bundleId).not.toBe(receipt.bundleId);
    expect(replacement.total).toBe('51000.00');
    const sponsor=await createEffectiveMemberSponsorFixture(db),second=await createEffectiveMemberSponsorFixture(db);
    const select=(personId:string,code:string,key=randomUUID())=>f.service.setRootSponsor(personId,f.applicationId,code,key,randomUUID());
    await db.formalMemberApplication.update({where:{formalMemberApplicationId:f.applicationId},data:{status:'SUBMITTED',submittedAt:new Date()}});
    await db.$executeRaw`INSERT INTO commerce.enrollment_bundle_payment_report(bundle_id,amount,account_last_five,paid_at)
      VALUES(${replacement.bundleId}::uuid,${replacement.payableTotal}::numeric,'12345',now())`;
    await expect(select(other.personId,sponsor.qualification.ballNo)).rejects.toMatchObject({response:{code:'FORMAL_APPLICATION_NOT_FOUND'}});
    expect(await f.service.sponsorCandidate(f.personId,f.applicationId,sponsor.qualification.ballNo!)).toEqual({ballNo:sponsor.qualification.ballNo,name:sponsor.holder.legalName});
    await expect(f.service.sponsorCandidate(other.personId,f.applicationId,sponsor.qualification.ballNo!)).rejects.toMatchObject({response:{code:'FORMAL_APPLICATION_NOT_FOUND'}});
    const selected=await select(f.personId,sponsor.qualification.ballNo);
    expect(selected.value.rootSponsor).toEqual({ballNo:sponsor.qualification.ballNo,name:sponsor.holder.legalName});
    expect((await select(f.personId,sponsor.qualification.ballNo)).value.rootSponsor).toEqual(selected.value.rootSponsor);
    expect(await db.qualificationSponsorSelectionEvidence.count({where:{qualificationId:replacement.balls[0].qualificationId}})).toBe(1);
    await expect(select(f.personId,second.qualification.ballNo)).rejects.toMatchObject({response:{code:'BUNDLE_ROOT_SPONSOR_EXISTS'}});
    expect(replacement).toMatchObject({planCode:'CUSTOM',paymentPolicy:'COMBINED',payableTotal:'51000.00'});
    await f.orders.confirmEnrollmentPayment(replacement.balls[0].qualification.orderId,{amount:replacement.payableTotal,
      paymentMethod:'BANK_TRANSFER',referenceNo:randomUUID(),occurredAt:new Date().toISOString()},randomUUID(),randomUUID(),sponsor.actor.personId!);
    expect((await select(f.personId,sponsor.qualification.ballNo)).value.rootSponsor).toEqual(selected.value.rootSponsor);
  },60000);
});
