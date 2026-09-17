import {applyGpvImmediateEffects, Prisma} from '@ucell/database';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';

const ROLLBACK='GPV_IMMEDIATE_TEST_ROLLBACK';
const d=(value:string|number)=>new Prisma.Decimal(value);

function localTestDatabaseUrl(){
  const raw=process.env.GPV_IMMEDIATE_TEST_DATABASE_URL??process.env.DATABASE_URL;
  if(!raw) throw new Error('GPV_IMMEDIATE_DB_TEST_URL_REQUIRED');
  const url=new URL(raw),database=decodeURIComponent(url.pathname.replace(/^\//,''));
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!database.endsWith('_test'))
    throw new Error('GPV_IMMEDIATE_DB_TEST_REQUIRES_LOCAL_TEST_DATABASE');
  return raw;
}

describe('v3 GPV immediate economic evidence',()=>{
  let db:PrismaClient;
  beforeAll(()=>{db=new PrismaClient({datasources:{db:{url:localTestDatabaseUrl()}}});});
  afterAll(()=>db?.$disconnect());

  it('writes immediate fixed-generation theory and isolated Binary volume exactly once without an Award',async()=>{
    await expect(db.$transaction(async tx=>{
      const at=new Date('2041-09-05T04:00:00.000Z'),effectiveFrom=new Date('2040-01-01T00:00:00.000Z');
      const rule=`TEST_GPV_IMMEDIATE_${randomUUID()}`;
      for(const [parameterCode,scopeKey,valueJson] of [
        ['referral.g1.rate','STARTER','.15'],
        ['equalization.rate','ELITE:G2','.10'],
        ['equalization.rate','LEADER:G3','.05'],
      ] as const) await tx.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode,scopeKey,valueJson,effectiveFrom}});

      const person=await tx.person.create({data:{legalName:'GPV immediate owner',status:'EFFECTIVE'}});
      const makeQualification=async(planCode:string,active:boolean)=>{
        const q=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:planCode,status:'EFFECTIVE'}});
        await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode,effectiveFrom,sourceType:'GPV_IMMEDIATE_TEST'}});
        await tx.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom,sourceType:'GPV_IMMEDIATE_TEST'}});
        if(active) await tx.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:effectiveFrom,activeTo:new Date('2041-10-01T00:00:00.000Z'),sourceType:'GPV_IMMEDIATE_TEST',ruleVersionCode:rule}});
        return q;
      };
      const source=await makeQualification('STARTER',true);
      const samePersonOtherBall=await makeQualification('LEADER',true);
      const g1=await makeQualification('STARTER',true);
      const g2=await makeQualification('ELITE',false);
      const g3=await makeQualification('LEADER',true);
      const firstDirect=await makeQualification('STARTER',false);

      await tx.sponsorRelationship.createMany({data:[
        {sponsorQualificationId:g1.qualificationId,childQualificationId:firstDirect.qualificationId,sponsorSequenceNo:1,effectiveFrom},
        {sponsorQualificationId:g1.qualificationId,childQualificationId:source.qualificationId,sponsorSequenceNo:2,effectiveFrom},
        {sponsorQualificationId:g2.qualificationId,childQualificationId:g1.qualificationId,sponsorSequenceNo:1,effectiveFrom},
        {sponsorQualificationId:g3.qualificationId,childQualificationId:g2.qualificationId,sponsorSequenceNo:1,effectiveFrom},
      ]});
      await tx.binaryPlacement.createMany({data:[
        {parentQualificationId:g1.qualificationId,childQualificationId:firstDirect.qualificationId,side:'LEFT',effectiveFrom},
        {parentQualificationId:g1.qualificationId,childQualificationId:source.qualificationId,side:'RIGHT',effectiveFrom},
        {parentQualificationId:g2.qualificationId,childQualificationId:g1.qualificationId,side:'LEFT',effectiveFrom},
      ]});
      const event=await tx.pvLedger.create({data:{qualificationId:source.qualificationId,pvType:'GPV',amount:d(1000),sourceType:'TEST_ORDER',sourceId:randomUUID(),
        eventType:'GPV_CREATED',ruleVersionCode:rule,parameterSnapshotHash:'test-input-snapshot',occurredAt:at,correlationId:randomUUID()}});

      await applyGpvImmediateEffects(tx,event);
      await applyGpvImmediateEffects(tx,event);

      const theories=await tx.theoryCalculationEvidence.findMany({where:{sourceVolumeEventId:event.eventId},orderBy:{fixedGenerationNo:'asc'}});
      expect(theories).toHaveLength(3);
      expect(theories.map(row=>[row.theoryKind,row.recipientQualificationId,row.fixedGenerationNo,row.theoryAmount.toString(),row.reasonCode])).toEqual([
        ['REFERRAL',g1.qualificationId,1,'150','ELIGIBLE'],
        ['REFERRAL_MATCHING',g2.qualificationId,2,'0','HISTORICAL_INACTIVE'],
        ['REFERRAL_MATCHING',g3.qualificationId,3,'7.5','ELIGIBLE'],
      ]);

      const binary=await tx.binaryVolumeLedger.findMany({where:{sourceVolumeEventId:event.eventId},orderBy:{binaryGenerationNo:'asc'}});
      expect(binary.map(row=>[row.ancestorQualificationId,row.binaryGenerationNo,row.side,row.amount.toString()])).toEqual([
        [g1.qualificationId,1,'RIGHT','1000'],
        [g2.qualificationId,2,'LEFT','1000'],
      ]);
      expect(await tx.historicalReplaySnapshot.count({where:{kind:'GPV',sourceId:event.eventId}})).toBe(1);
      expect(await tx.bonusAward.count({where:{sourceEventId:event.eventId}})).toBe(0);
      expect(await tx.theoryCalculationEvidence.count({where:{sourceVolumeEventId:event.eventId,recipientQualificationId:samePersonOtherBall.qualificationId}})).toBe(0);
      expect(await tx.binaryVolumeLedger.count({where:{sourceVolumeEventId:event.eventId,ancestorQualificationId:samePersonOtherBall.qualificationId}})).toBe(0);
      throw new Error(ROLLBACK);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000})).rejects.toThrow(ROLLBACK);
  },40000);

  it('fails closed and rolls back when a historical recipient snapshot is missing',async()=>{
    const eventId=randomUUID();
    await expect(db.$transaction(async tx=>{
      const at=new Date('2042-09-05T04:00:00.000Z'),effectiveFrom=new Date('2040-01-01T00:00:00.000Z'),rule=`TEST_GPV_MISSING_${randomUUID()}`;
      await tx.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode:'referral.g1.rate',scopeKey:'STARTER',valueJson:'.15',effectiveFrom}});
      const person=await tx.person.create({data:{legalName:'GPV missing snapshot',status:'EFFECTIVE'}});
      const source=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE'}});
      const sponsor=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE'}});
      for(const q of [source,sponsor]) await tx.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom,sourceType:'GPV_IMMEDIATE_TEST'}});
      await tx.qualificationPlanHistory.create({data:{qualificationId:source.qualificationId,planCode:'STARTER',effectiveFrom,sourceType:'GPV_IMMEDIATE_TEST'}});
      // Sponsor plan history is deliberately absent; current Qualification state cannot substitute.
      await tx.sponsorRelationship.create({data:{sponsorQualificationId:sponsor.qualificationId,childQualificationId:source.qualificationId,sponsorSequenceNo:1,effectiveFrom}});
      const event=await tx.pvLedger.create({data:{eventId,qualificationId:source.qualificationId,pvType:'GPV',amount:d(1000),sourceType:'TEST_ORDER',sourceId:randomUUID(),eventType:'GPV_CREATED',ruleVersionCode:rule,parameterSnapshotHash:'missing',occurredAt:at,correlationId:randomUUID()}});
      await applyGpvImmediateEffects(tx,event);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000})).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_MISSING'}});
    expect(await db.historicalReplaySnapshot.count({where:{kind:'GPV',sourceId:eventId}})).toBe(0);
    expect(await db.theoryCalculationEvidence.count({where:{sourceVolumeEventId:eventId}})).toBe(0);
    expect(await db.binaryVolumeLedger.count({where:{sourceVolumeEventId:eventId}})).toBe(0);
  },40000);
});
