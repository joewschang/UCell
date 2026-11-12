import {randomUUID} from 'node:crypto';
import {Prisma, PrismaClient} from '@prisma/client';
import {appendEntitlementDelta, captureParameters, periodK0, periodMatching, replayHash, storeReplaySnapshot, type HistoricalRecipient, type ReplayEnvelope} from '@ucell/database';
import {settlementRebaseBaseline} from '../../../packages/database/src/settlement-rebase-baseline';

const url=process.env.PHASE2_TEST_DATABASE_URL;

(url?describe:describe.skip)('replay of approved changes in settlement recipients',()=>{
  let db:PrismaClient;
  beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
  afterAll(()=>db.$disconnect());

  it.each(['REFERRAL_K0','MATCHING_K2'] as const)('%s preserves old postings and calculates a partial return for a newly eligible recipient',async kind=>{
    const at=new Date('2034-01-01T00:00:00Z'),iso=at.toISOString(),rule='R1.0B';
    await db.$transaction(async tx=>{
      const parameters=await captureParameters(tx,at,rule);
      const person=await tx.person.create({data:{legalName:'Reattribution test member'}});
      const q=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE'}});
      const sourceQ=(await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE'}})).qualificationId;
      const binary=await tx.bonusAward.create({data:{recipientQualificationId:sourceQ,awardType:'BINARY',theoryAmount:100,payableAmount:100,activeSnapshot:true,ruleVersionCode:rule,occurredAt:at,pendingUntil:at,calculationDetail:{}}});
      const sourceEventId=randomUUID(),sourceAwardId=binary.bonusAwardId,batchId=randomUUID();
      const qualification={qualificationId:q.qualificationId,at:iso,plan:{planCode:'STARTER'},status:{status:'EFFECTIVE'},activeIntervals:[{activeFrom:iso}]};
      const graph={at:iso,sponsor:[{childQualificationId:sourceQ,sponsorQualificationId:q.qualificationId}],binary:[],qualifications:{[q.qualificationId]:qualification},effectiveDirectCounts:{[q.qualificationId]:1}};
      const source:ReplayEnvelope={format:'UCELL_HISTORICAL_REPLAY_V1',kind:'GPV',sourceId:sourceEventId,ruleVersionCode:rule,at:iso,parameters,recipients:[],evidence:{},inputs:{qualificationId:sourceQ,volume:'1000',orderId:randomUUID(),lineId:randomUUID()}};
      const original:ReplayEnvelope={...source,kind,sourceId:batchId,inputs:{},evidence:{sources:[source],matchingSources:[]}};
      const sealed=await storeReplaySnapshot(tx,original);
      const awardType=kind==='REFERRAL_K0'?'REFERRAL':'MATCHING';
      const award=await tx.bonusAward.create({data:{recipientQualificationId:q.qualificationId,awardType,sourceEventId:kind==='REFERRAL_K0'?sourceEventId:null,sourceAwardId:kind==='MATCHING_K2'?sourceAwardId:null,generationNo:1,theoryAmount:10,payableAmount:10,activeSnapshot:true,ruleVersionCode:rule,occurredAt:at,pendingUntil:at,calculationDetail:{}}});
      const recipient:HistoricalRecipient={key:award.bonusAwardId,awardId:award.bonusAwardId,qualificationId:q.qualificationId,awardType,generation:1,active:true,eligible:true,theory:'10',posted:'10',pendingUntil:iso,rate:'0.1',sourceAwardId,sourceEventId,detail:{originalCalculationSourceVolume:'1000'},qualification};
      const revised:ReplayEnvelope={...original,recipients:[recipient],evidence:{sources:[{...source,evidence:graph}],matchingSources:[{sourceAwardId,sourceQualificationId:sourceQ,evidence:graph}]}};
      const snapshotHash=replayHash(revised);
      const revision=await tx.historicalReplaySnapshot.create({data:{kind:'AWARD_REBASE_V1_'+kind,sourceId:randomUUID(),ruleVersionCode:rule,hash:snapshotHash,content:revised as unknown as Prisma.InputJsonValue}});
      const pointer={version:1,originalSnapshotId:sealed.snapshotId,originalHash:sealed.hash,snapshotId:revision.snapshotId,snapshotHash,topologyHash:replayHash(graph),retiredAwardIds:[]};
      const receipt={actorType:'SYSTEM',action:'AWARD_REBASE_BASELINE',entityType:'SETTLEMENT_BATCH',entityId:batchId,afterHash:snapshotHash,requestId:randomUUID(),correlationId:randomUUID()};
      await tx.auditEvent.create({data:{...receipt,afterData:pointer}});
      const baseline=await settlementRebaseBaseline(tx,sealed);
      expect(baseline.postingSnapshotIds).toEqual([sealed.snapshotId,revision.snapshotId]);
      const half=new Prisma.Decimal(500);
      const result=kind==='REFERRAL_K0'?periodK0(baseline.envelope,new Map([[sourceEventId,half]])):periodMatching(baseline.envelope,new Map([[sourceAwardId,new Prisma.Decimal(50)]]),half);
      const next=result.payables.get(award.bonusAwardId)!;
      expect(next.toString()).toBe('5');
      const action=randomUUID();
      const post=()=>appendEntitlementDelta(tx,baseline.row,baseline.envelope.recipients[0],next,action,replayHash(action));
      const change=await post();
      expect(change.delta.toString()).toBe('-5');
      expect(change.snapshotId).toBe(revision.snapshotId);
      expect((await post()).postingId).toBe(change.postingId);
      expect(await tx.entitlementReplayPosting.count({where:{snapshotId:sealed.snapshotId}})).toBe(0);
      await tx.auditEvent.create({data:{...receipt,afterData:{...pointer,originalHash:'invalid'}}});
      await expect(settlementRebaseBaseline(tx,sealed)).rejects.toThrow('Settlement reattribution');
    },{timeout:20000});
  });
});
