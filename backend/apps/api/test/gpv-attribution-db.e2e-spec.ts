import {randomUUID} from 'node:crypto';
import {Prisma, PrismaClient} from '@prisma/client';
import {captureParameters, replayHash, storeReplaySnapshot, type ReplayEnvelope} from '@ucell/database';
import {applyGpvAttribution, gpvAttributionsAt, currentTheoryForBall} from '../../../packages/database/src/gpv-attribution';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('GPV attribution projection',()=>{
  let db:PrismaClient;
  beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
  afterAll(()=>db.$disconnect());

  it('selects as-of revisions, removes the old beneficiary, and rejects a damaged current receipt',async()=>{
    await db.$transaction(async tx=>{
      const person=await tx.person.create({data:{legalName:'GPV projection test'}});
      const createBall=()=>tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE'}});
      const [origin,previous,current]=await Promise.all([createBall(),createBall(),createBall()]);
      const rule='R1.0B',at=new Date('2033-01-01T00:00:00Z'),parameters=await captureParameters(tx,at,rule);
      const fact=await tx.pvLedger.create({data:{qualificationId:origin.qualificationId,pvType:'GPV',amount:1000,
        sourceType:'ORDER',eventType:'GPV_CREATED',sourceId:randomUUID(),sourceLineId:randomUUID(),ruleVersionCode:rule,
        parameterSnapshotHash:parameters.hash,occurredAt:at,correlationId:randomUUID()}});
      const original:ReplayEnvelope={format:'UCELL_HISTORICAL_REPLAY_V1',sourceId:fact.eventId,ruleVersionCode:rule,kind:'GPV',at:at.toISOString(),
        parameters,inputs:{qualificationId:origin.qualificationId,orderId:fact.sourceId,lineId:fact.sourceLineId,volume:'1000'},recipients:[],evidence:{}};
      const sealed=await storeReplaySnapshot(tx,original);
      const originalTheory=await tx.theoryCalculationEvidence.create({data:{theoryKind:'REFERRAL',sourceVolumeEventId:fact.eventId,
        sourceQualificationId:origin.qualificationId,recipientQualificationId:previous.qualificationId,fixedGenerationNo:1,baseAmount:1000,rateSnapshot:'0.1',
        theoryAmount:100,activeSnapshot:true,unlockEligibleSnapshot:true,reasonCode:'SOURCE_TEST',historicalSponsorPathHash:replayHash([]),
        ruleVersionCode:rule,parameterSnapshotHash:parameters.hash,occurredAt:at,idempotencyKey:randomUUID()}});
      expect(await currentTheoryForBall(tx,previous.qualificationId)).toMatchObject([{theoryCalculationEvidenceId:originalTheory.theoryCalculationEvidenceId}]);
      const before=new Date('2033-01-02'),after=new Date('2033-01-04');
      expect((await gpvAttributionsAt(tx,[fact.eventId],before)).size).toBe(0);
      expect(applyGpvAttribution(original)).toBe(original);
      const graph={at:original.at,sourceQualification:{qualificationId:origin.qualificationId}};
      const revision={sourceId:fact.eventId,graph,theory:[{recipientQualificationId:current.qualificationId,kind:'REFERRAL',generation:1,baseAmount:'1000',rate:'0.1',amount:'100',active:true,unlocked:true}]};
      const receipt={entityType:'PV_LEDGER',entityId:fact.eventId,action:'GPV_ATTRIBUTION_REBASE',actorType:'SYSTEM',
        beforeHash:sealed.hash,afterHash:replayHash(revision),afterData:revision as Prisma.InputJsonValue,requestId:randomUUID(),correlationId:randomUUID()};
      await tx.auditEvent.create({data:{...receipt,occurredAt:new Date('2033-01-03')}});
      expect((await gpvAttributionsAt(tx,[fact.eventId],before)).size).toBe(0);
      const revisions=await gpvAttributionsAt(tx,[fact.eventId],after);
      expect(applyGpvAttribution(original,revisions.get(fact.eventId)).evidence).toEqual(graph);
      expect(await currentTheoryForBall(tx,previous.qualificationId)).toEqual([]);
      expect(await currentTheoryForBall(tx,current.qualificationId)).toMatchObject([{sourceVolumeEventId:fact.eventId,theoryAmount:'100',reasonCode:'CURRENT_TREE_REBASE'}]);
      await tx.auditEvent.create({data:{...receipt,occurredAt:after,afterHash:'broken'}});
      const damaged=await gpvAttributionsAt(tx,[fact.eventId],after);
      expect(()=>applyGpvAttribution(original,damaged.get(fact.eventId))).toThrow('does not match');
      await expect(currentTheoryForBall(tx,current.qualificationId)).rejects.toThrow('does not match');
      await expect(currentTheoryForBall(tx,previous.qualificationId)).rejects.toThrow('does not match');
    });
  });
});
