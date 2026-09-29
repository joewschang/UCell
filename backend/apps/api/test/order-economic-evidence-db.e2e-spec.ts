import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {captureParameters,storeReplaySnapshot} from '@ucell/database';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('ORDER_ECONOMIC_EVIDENCE_REAL_DB',()=>{
  let db:PrismaClient;
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());
  async function fixture(ruleVersionCode='R1'){
    const person=await db.person.create({data:{legalName:'Private lineage holder'}});
    const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});
    const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode}});
    const pv=await db.pvLedger.create({data:{qualificationId:q.qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:order.orderId,eventType:'GPV_CREATED',ruleVersionCode,occurredAt:new Date(),correlationId:randomUUID()}});
    const award=async(sourceEventId:string,sourceAwardId?:string)=>db.bonusAward.create({data:{recipientQualificationId:q.qualificationId,sourceEventId,sourceAwardId,awardType:'REFERRAL',theoryAmount:10,payableAmount:10,activeSnapshot:true,ruleVersionCode:'R1',occurredAt:new Date(),pendingUntil:new Date(),calculationDetail:{privateNote:'do not expose'}}});
    const service=new AdminOperationsService(db as any,new AuditService());
    return {person,q,order,pv,award,read:()=>service.economicLineageByOrderNo(order.orderNo.toString())};
  }
  it('joins direct and derived awards to exact payables while excluding unrelated recipient awards',async()=>{
    const f=await fixture(),direct=await f.award(f.pv.eventId),child=await f.award(randomUUID(),direct.bonusAwardId),unrelated=await f.award(randomUUID());
    const payable=await db.payableEntry.create({data:{qualificationId:f.q.qualificationId,sourceType:'BONUS_AWARD',sourceId:child.bonusAwardId,awardType:'REFERRAL',grossAmount:10,availableAt:new Date(),ruleVersionCode:'R1'}});
    const first=await f.read(),second=await f.read();
    expect(first).toEqual(second);
    const evidence=first.economicEvidence;
    expect(evidence.awards).toHaveLength(2);
    expect(evidence.awards[0].sourcePvReference).toBe(evidence.pvEvents[0].reference);
    expect(evidence.awards[1].sourceAwardReference).toBe(evidence.awards[0].reference);
    expect(evidence.payables).toEqual([expect.objectContaining({awardReference:evidence.awards[1].reference,grossAmount:'10',status:'OPEN',payout:null})]);
    const json=JSON.stringify(first);
    for(const secret of [f.person.personId,f.q.qualificationId,f.order.orderId,direct.bonusAwardId,child.bonusAwardId,unrelated.bonusAwardId,payable.payableEntryId,'Private lineage holder','privateNote']) expect(json).not.toContain(secret);
    expect(await db.payableEntry.findUniqueOrThrow({where:{payableEntryId:payable.payableEntryId}})).toEqual(payable);
  });
  async function periodFixture(kind:string){
    const f=await fixture('R1.0B'),at=f.pv.occurredAt;
    const parameters=await db.$transaction(tx=>captureParameters(tx,at,'R1.0B'));
    const source={format:'UCELL_HISTORICAL_REPLAY_V1' as const,kind:'GPV',sourceId:f.pv.eventId,ruleVersionCode:'R1.0B',at:at.toISOString(),parameters,recipients:[],evidence:{privateIdentity:f.person.personId},inputs:{eventId:f.pv.eventId,orderId:f.order.orderId,volume:'100'}};
    const envelope={format:'UCELL_HISTORICAL_REPLAY_V1' as const,kind,sourceId:randomUUID(),ruleVersionCode:'R1.0B',at:new Date(at.getTime()+1000).toISOString(),parameters,recipients:[],evidence:{sources:[source]},inputs:{periodStart:at.toISOString(),periodEnd:new Date(at.getTime()+1000).toISOString(),totalGpv:'900000'}};
    return {f,envelope,source};
  }
  it.each(['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'])('reports exact sealed %s period membership without allocating period awards',async kind=>{
    const {f,envelope,source}=await periodFixture(kind);
    const unrelated={...source,sourceId:randomUUID(),inputs:{eventId:randomUUID(),orderId:randomUUID(),volume:'899900'}};
    envelope.evidence.sources.push(unrelated);
    const snapshot=await db.$transaction(tx=>storeReplaySnapshot(tx,envelope));
    const evidence=(await f.read()).economicEvidence;
    expect(evidence.periodContributions).toEqual([expect.objectContaining({kind,attribution:'SEALED_PERIOD_INPUT_ONLY',orderOriginalGpv:'100',snapshotHash:snapshot.hash,periodStart:envelope.inputs.periodStart,periodEnd:envelope.inputs.periodEnd,sources:[{sourcePvReference:evidence.pvEvents[0].reference,originalGpv:'100'}]})]);
    expect(evidence.awards).toEqual([]);
    expect(evidence.payables).toEqual([]);
    expect((await f.read()).economicEvidence).toEqual(evidence);
    const json=JSON.stringify(evidence.periodContributions);
    for(const internal of [snapshot.snapshotId,envelope.sourceId,f.pv.eventId,f.order.orderId,f.person.personId,unrelated.sourceId,'900000','899900','privateIdentity'])expect(json).not.toContain(internal);
    expect(await db.historicalReplaySnapshot.findUniqueOrThrow({where:{snapshotId:snapshot.snapshotId}})).toEqual(snapshot);
    const other=await fixture('R1.0B');
    expect((await other.read()).economicEvidence.periodContributions).toEqual([]);
  });
  it.each(['order','volume','duplicate','endBoundary','hash'])('rejects inconsistent sealed period evidence: %s',async fault=>{
    const {f,envelope,source}=await periodFixture('BINARY_K1');
    if(fault==='order')source.inputs.orderId=randomUUID();
    if(fault==='volume')source.inputs.volume='101';
    if(fault==='duplicate')envelope.evidence.sources.push(source);
    if(fault==='endBoundary'){
      envelope.inputs.periodStart=new Date(f.pv.occurredAt.getTime()-1000).toISOString();
      envelope.inputs.periodEnd=f.pv.occurredAt.toISOString();
    }
    if(fault==='hash')await db.historicalReplaySnapshot.create({data:{kind:envelope.kind,sourceId:envelope.sourceId,ruleVersionCode:envelope.ruleVersionCode,content:JSON.parse(JSON.stringify(envelope)),hash:'invalid'}});
    else await db.$transaction(tx=>storeReplaySnapshot(tx,envelope));
    await expect(f.read()).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_CORRUPT'}});
  });
  it('includes return-linked recovery without attributing its whole period award to the order',async()=>{
    const f=await fixture(),periodAward=await f.award(randomUUID());
    const ret=await db.returnCase.create({data:{orderId:f.order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID()}});
    await db.bonusRecoveryEvent.create({data:{bonusAwardId:periodAward.bonusAwardId,returnCaseId:ret.returnCaseId,recoveryAmount:3,outstandingAmount:3,reasonCode:'RETURN_TEST',occurredAt:new Date()}});
    const evidence=(await f.read()).economicEvidence;
    expect(evidence.awards).toEqual([]);
    expect(evidence.recoveries).toEqual([expect.objectContaining({awardIncluded:false,linkedToOrderReturn:true,recoveryAmount:'3',outstandingAmount:'3',recoveredAmount:'0'})]);
  });
  it('includes award recovery once when both award and return edges match',async()=>{
    const f=await fixture(),award=await f.award(f.pv.eventId);
    const ret=await db.returnCase.create({data:{orderId:f.order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID()}});
    await db.bonusRecoveryEvent.create({data:{bonusAwardId:award.bonusAwardId,returnCaseId:ret.returnCaseId,recoveryAmount:2,outstandingAmount:2,reasonCode:'RETURN_TEST',occurredAt:new Date()}});
    const evidence=(await f.read()).economicEvidence;
    expect(evidence.recoveries).toHaveLength(1);
    expect(evidence.recoveries[0]).toMatchObject({awardReference:evidence.awards[0].reference,awardIncluded:true,linkedToOrderReturn:true});
  });
  it('joins only subscription recognition, RPV awards and replay postings explicitly linked to the order',async()=>{
    const f=await fixture();
    const plan=await db.subscriptionPlan.create({data:{planCode:`LINEAGE-${randomUUID()}`,displayName:'Lineage plan',durationMonths:1,prepaidAmount:100,productBoxQty:1,monthlyRecognizedAmount:100,monthlyRpv:10}});
    const subscription=await db.subscription.create({data:{qualificationId:f.q.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,orderId:f.order.orderId,status:'ACTIVE',startMonth:new Date('2026-09-01'),endMonth:new Date('2026-09-01'),ruleVersionCode:'R1'}});
    const schedule=await db.monthlyRecognitionSchedule.create({data:{subscriptionId:subscription.subscriptionId,installmentNo:1,recognitionMonth:new Date('2026-09-01'),recognizedAmount:100,rpvAmount:10,status:'RECOGNIZED',dueAt:new Date('2026-09-01'),recognizedAt:new Date('2026-09-02'),ruleVersionCode:'R1'}});
    const pv=await db.pvLedger.create({data:{qualificationId:f.q.qualificationId,pvType:'RPV',amount:10,sourceType:'SUBSCRIPTION',sourceId:subscription.subscriptionId,sourceLineId:schedule.recognitionId,eventType:'RPV_CREATED',ruleVersionCode:'R1',occurredAt:new Date('2026-09-02'),correlationId:randomUUID()}});
    const award=await db.rpvUplineAwardEvent.create({data:{recognitionId:schedule.recognitionId,sourceQualificationId:f.q.qualificationId,recipientQualificationId:f.q.qualificationId,binaryGeneration:1,effectiveDirectCountSnapshot:1,unlockedDepthSnapshot:5,activeSnapshot:true,theoryAmount:10,payableAmount:10,ruleVersionCode:'R1',occurredAt:new Date('2026-09-02')}});
    const snapshot=await db.historicalReplaySnapshot.create({data:{kind:'RPV',sourceId:schedule.recognitionId,ruleVersionCode:'R1',content:{sealed:true,recipients:[{key:'RPV:G1',qualificationId:f.q.qualificationId,posted:'10',eligible:true}]},hash:'a'.repeat(64)}});
    const posting=await db.entitlementReplayPosting.create({data:{actionKey:`TEST:${randomUUID()}`,snapshotId:snapshot.snapshotId,entitlementKey:'RPV:G1',recipientQualificationId:f.q.qualificationId,originallyPosted:10,recalculatedEntitlement:8,delta:-2,stateHash:'b'.repeat(64)}});
    const evidence=(await f.read()).economicEvidence;
    expect(evidence.subscriptionRecognitions).toEqual([expect.objectContaining({planCode:plan.planCode,installmentNo:1,status:'RECOGNIZED',pvEvent:expect.objectContaining({amount:'10'}),awards:[expect.objectContaining({generation:1,theoryAmount:'10',payableAmount:'10'})],replay:expect.objectContaining({hash:'a'.repeat(64),corrections:[expect.objectContaining({delta:'-2'})]})})]);
    const json=JSON.stringify(evidence.subscriptionRecognitions);
    for(const internal of [subscription.subscriptionId,schedule.recognitionId,pv.eventId,award.rpvAwardEventId,snapshot.snapshotId,posting.postingId,f.q.qualificationId])expect(json).not.toContain(internal);
  });
});
