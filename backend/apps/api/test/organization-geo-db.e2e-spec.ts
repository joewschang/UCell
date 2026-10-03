import {randomUUID} from 'node:crypto';
import {PrismaService,recognizeConsumption,replayHash} from '@ucell/database';
import {readBallActiveEvidence,readBallsActiveEvidence} from '../src/modules/binary-tree/tree-active-evidence';
import {BinaryTreeService,TreePrincipal} from '../src/modules/binary-tree/binary-tree.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {OrganizationGeoService,GeoQuery} from '../src/modules/organization-geo/organization-geo.service';
describe('Geo authorized historical subtree real DB',()=>{
 const db=new PrismaService(),geo=new OrganizationGeoService(db),trees=new BinaryTreeService(db,new IdempotencyService(db),new OrganizationService(db));
 let admin:TreePrincipal,rootBallNo:string,input:GeoQuery;
 beforeAll(async()=>{
  const url=new URL(process.env.DATABASE_URL!);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||!/^\/ucell_jest_[a-f0-9]{32}$/.test(url.pathname))throw new Error('Use isolated API DB harness');
  const person=await db.person.create({data:{legalName:'TEST ONLY GEO ADMIN'}}),subject=randomUUID();
  await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
  await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode:'SUPER_ADMIN',validFrom:new Date(Date.now()-1000)}});
  const session=await db.authSession.create({data:{personId:person.personId,provider:'ENTRA',subject,roleCode:'SUPER_ADMIN',tokenHash:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+3600000)}});
  admin={personId:person.personId,provider:'ENTRA',subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};
  const tree=(await trees.create(admin,{treeName:'TEST ONLY GEO TREE',reason:'Synthetic reconciliation'},randomUUID())).value;
  rootBallNo=(await db.qualification.findUniqueOrThrow({where:{qualificationId:tree.companyQualificationIds[0]}})).ballNo!;
  const now=new Date();input={rootBallNo,dateFrom:new Date(now.getTime()-86400000).toISOString(),dateTo:now.toISOString(),asOf:now.toISOString(),knowledgeCutoff:now.toISOString()};
 });
 afterAll(()=>db.$disconnect());
 it('excludes root self, reconciles LEFT+RIGHT, preserves company ownership and unlocated population',async()=>{
  const result=await geo.capture(admin,input);
  expect(result.status).toBe('AVAILABLE');
  expect(result.summary).toMatchObject({descendantBalls:6,uniqueMembers:0,leftBalls:3,rightBalls:3,unlocatedBalls:6,gpv:'0.0000',eligibleMemberBalls:0,activeRate:null});
  expect(result.distribution).toHaveLength(1);
  expect(result.distribution[0]).toMatchObject({areaCode:'UNLOCATED',balls:6,members:0,gpv:'0.0000'});
  expect(result.carry).toMatchObject({status:'UNAVAILABLE',reason:'NO_SETTLED_CARRY'});
  expect(JSON.stringify(result)).not.toMatch(/addressCiphertext|latitude|longitude|TEST ONLY GEO ADMIN|personId/);
 });
 it('applies the exact same firstSide to counts and GPV',async()=>{
  const left=await geo.capture(admin,{...input,side:'LEFT'}),right=await geo.capture(admin,{...input,side:'RIGHT'});
  expect(left.summary?.descendantBalls).toBe(3);expect(right.summary?.descendantBalls).toBe(3);
  expect(left.summary?.gpv).toBe('0.0000');expect(right.summary?.gpv).toBe('0.0000');
 });
 it('historical root absence never falls back to current tree',async()=>{
  await expect(geo.capture(admin,{...input,dateFrom:'2020-01-01T00:00:00.000Z',dateTo:'2020-02-01T00:00:00.000Z',asOf:'2020-02-01T00:00:00.000Z'})).rejects.toMatchObject({response:{code:'GEO_ROOT_NOT_FOUND'}});
 });
 it('denies Member credentials before root lookup',async()=>{
  await expect(geo.capture({...admin,provider:'LINE',role:'MEMBER'},input)).rejects.toMatchObject({response:{code:'TREE_ACCESS_DENIED'}});
 });
 it('batch Active evidence preserves single-ball semantics for active, inactive and unknown qualifications',async()=>{
  const person=await db.person.create({data:{legalName:'TEST ONLY BATCH ACTIVE'}});
  const qualifications=[];
  for(let i=0;i<3;i++)qualifications.push(await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}}));
  const at=new Date('2026-09-10T00:00:00.000Z');
  for(let i=0;i<2;i++)await db.$transaction(tx=>recognizeConsumption(tx,{qualificationId:qualifications[i].qualificationId,sourceType:'TEST_ORDER',sourceId:randomUUID(),amount:i===0?1400:100,eligible:true,concreteVolumeType:'GPV',productProfileVersion:'TEST',ruleVersionCode:'R1',parameterSnapshotHash:'a'.repeat(64),recognizedAt:at,activeThreshold:1200}));
  const time={timezone:'Asia/Taipei' as const,asOf:'2026-09-15T00:00:00.000Z',knowledgeCutoff:new Date().toISOString(),periodStart:'2026-08-31T16:00:00.000Z',periodEnd:'2026-09-30T16:00:00.000Z'};
  await db.$transaction(async tx=>{
   const batch=await readBallsActiveEvidence(tx,qualifications.map(q=>q.qualificationId),time);
   for(const q of qualifications)expect(batch.get(q.qualificationId)).toEqual(await readBallActiveEvidence(tx,q.qualificationId,time));
   expect(qualifications.map(q=>batch.get(q.qualificationId)?.state)).toEqual(['ACTIVE','INACTIVE','UNKNOWN']);
  });
 });
 it('clamps all-time trend to evidenced root creation rather than fabricating pre-creation snapshots',async()=>{
  const result=await geo.trend(admin,{...input,dateFrom:'1970-01-01T00:00:00.000Z',interval:'MONTH'});
  expect(result.actualPeriodStart).not.toBe('1970-01-01T00:00:00.000Z');
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0].summary?.descendantBalls).toBe(6);
 });
 it('reconciles stored sealed GPV and a later known posted return across real SQL firstSide queries',async()=>{
  const tree=(await trees.create(admin,{treeName:'TEST ONLY GPV RECONCILIATION',reason:'Isolated historical source fixture'},randomUUID())).value;
  const [root,left,right]=tree.companyQualificationIds;
  const occurredAt=new Date(),lineId=randomUUID();
  const sources=[];
  for(const [qualificationId,side,volume] of [[left,'LEFT','100.1234'],[right,'RIGHT','200.0000']] as const){
   const row=await db.pvLedger.create({data:{qualificationId,pvType:'GPV',amount:volume,sourceType:'TEST_ONLY',sourceId:randomUUID(),sourceLineId:qualificationId===left?lineId:randomUUID(),eventType:'GPV_CREATED',ruleVersionCode:'TEST_ONLY',occurredAt,correlationId:randomUUID()}});
   const parameters={format:'UCELL_PARAMETER_SNAPSHOT_V1',ruleVersionCode:'TEST_ONLY',effectiveAt:occurredAt.toISOString(),parameters:[]};
   const content={format:'UCELL_HISTORICAL_REPLAY_V1',kind:'GPV',sourceId:row.eventId,ruleVersionCode:'TEST_ONLY',at:occurredAt.toISOString(),parameters:{...parameters,hash:replayHash(parameters)},recipients:[],evidence:{sourceQualification:{qualificationId},binary:[{childQualificationId:qualificationId,parentQualificationId:root,side}]},inputs:{volume}};
   await db.historicalReplaySnapshot.create({data:{kind:'GPV',sourceId:row.eventId,ruleVersionCode:'TEST_ONLY',content,hash:replayHash(content)}});
   sources.push(row);
  }
  await new Promise(resolve=>setTimeout(resolve,5));
  const beforeKnown=new Date();
  // Separate the historical checkpoint from subsequent evidence at millisecond precision.
  await new Promise(resolve=>setTimeout(resolve,5));
  const postedAt=new Date();
  const order=await db.order.create({data:{qualificationId:left,grossAmount:100,netAmount:100,ruleVersionCode:'TEST_ONLY'}});
  const product=await db.productReference.create({data:{sku:'GEO-TEST-'+randomUUID(),displayName:'TEST ONLY GPV',currentPrice:100}});
  await db.orderLine.create({data:{orderLineId:lineId,orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:1,gpvAmountSnapshot:'100.1234',ruleProfileSnapshot:{testOnly:true}}});
  const returned=await db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'TEST_ONLY',occurredAt,postedAt,idempotencyKey:randomUUID(),correlationId:randomUUID()}});
  const returnLine=await db.returnLine.create({data:{returnCaseId:returned.returnCaseId,orderLineId:lineId,quantity:1,returnAmount:20,gpvReversalAmount:20}});
  await db.pvLedger.create({data:{qualificationId:left,pvType:'GPV',amount:-20,sourceType:'RETURN',sourceId:returned.returnCaseId,sourceLineId:returnLine.returnLineId,eventType:'GPV_REVERSAL',ruleVersionCode:'TEST_ONLY',occurredAt,reversalOfEventId:sources[0].eventId,correlationId:randomUUID()}});
  await db.auditEvent.create({data:{actorType:'SYSTEM',action:'RETURN_REVERSAL_PROCESSED',entityType:'RETURN_CASE',entityId:returned.returnCaseId,requestId:randomUUID(),correlationId:randomUUID()}});
  await new Promise(resolve=>setTimeout(resolve,5));
  const afterKnown=new Date(),query:GeoQuery={rootQualificationId:root,dateFrom:new Date(occurredAt.getTime()-1000).toISOString(),dateTo:afterKnown.toISOString(),asOf:afterKnown.toISOString(),knowledgeCutoff:afterKnown.toISOString()};
  const before=await geo.capture(admin,{...query,knowledgeCutoff:beforeKnown.toISOString()}),after=await geo.capture(admin,query);
  expect(before.summary?.gpv).toBe('300.1234');expect(after.summary?.gpv).toBe('280.1234');
  const leftResult=await geo.capture(admin,{...query,side:'LEFT'}),rightResult=await geo.capture(admin,{...query,side:'RIGHT'});
  expect(leftResult.summary?.gpv).toBe('80.1234');expect(rightResult.summary?.gpv).toBe('200.0000');
  expect(after.distribution).toEqual([expect.objectContaining({areaCode:'UNLOCATED',gpv:'280.1234'})]);
  expect((await geo.capture(admin,query)).summary?.gpv).toBe('280.1234');
 });
 it('deduplicates a two-ball member and preserves ownership across effective and knowledge checkpoints',async()=>{
  const tree=(await trees.create(admin,{treeName:'TEST ONLY OWNER HISTORY',reason:'Isolated ownership fixture'},randomUUID())).value;
  await trees.change(admin,tree.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'TEST ONLY'},randomUUID());
  const first=await db.person.create({data:{legalName:'TEST ONLY TWO BALL MEMBER'}}),second=await db.person.create({data:{legalName:'TEST ONLY NEW HOLDER'}});
  const balls=[];
  for(let i=0;i<2;i++){
   const at=new Date(),q=await db.qualification.create({data:{currentHolderPersonId:first.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
   await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:at,sourceType:'TEST_ONLY'}});
   await db.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:at,sourceType:'TEST_ONLY'}});
   await db.qualificationHolderHistory.create({data:{qualificationId:q.qualificationId,holderPersonId:first.personId,effectiveFrom:at,sourceType:'TEST_ONLY',sourceId:randomUUID()}});
   await trees.confirmCompanySponsor(admin,tree.binaryTreeId,{qualificationId:q.qualificationId,reason:'TEST ONLY'},randomUUID());
   await trees.place(admin,tree.binaryTreeId,{qualificationId:q.qualificationId,binaryParentQualificationId:tree.companyQualificationIds[i===0?3:5],side:'LEFT',expectedVersion:2+i,reason:'TEST ONLY'},randomUUID());
   balls.push(q.qualificationId);
  }
  await new Promise(resolve=>setTimeout(resolve,5));
  const before=new Date();
  await new Promise(resolve=>setTimeout(resolve,5));
  const transferredAt=new Date();
  await db.$transaction(async tx=>{
   const owner=await tx.qualificationOwnerInterval.findFirstOrThrow({where:{qualificationId:balls[0],effectiveTo:null}});
   await tx.qualificationOwnerInterval.update({where:{ownerIntervalId:owner.ownerIntervalId},data:{effectiveTo:transferredAt,closedRecordedAt:transferredAt}});
   await tx.qualificationOwnerInterval.create({data:{qualificationId:balls[0],ownerType:'MEMBER',personId:second.personId,effectiveFrom:transferredAt,sourceType:'TEST_ONLY_TRANSFER',sourceId:randomUUID(),evidenceHash:'b'.repeat(64)}});
  });
  await new Promise(resolve=>setTimeout(resolve,5));
  const after=new Date(),query:GeoQuery={rootQualificationId:tree.companyQualificationIds[0],dateFrom:new Date(before.getTime()-86400000).toISOString(),dateTo:after.toISOString(),asOf:after.toISOString(),knowledgeCutoff:after.toISOString()};
  const current=await geo.capture(admin,query),pastEffective=await geo.capture(admin,{...query,asOf:before.toISOString(),dateTo:before.toISOString()}),pastKnown=await geo.capture(admin,{...query,knowledgeCutoff:before.toISOString()});
  expect(current.summary).toMatchObject({descendantBalls:8,uniqueMembers:2,eligibleMemberBalls:2,unlocatedBalls:8,unknownActiveBalls:2,activeRate:null});
  for(const result of [pastEffective,pastKnown])expect(result.summary).toMatchObject({descendantBalls:8,uniqueMembers:1,eligibleMemberBalls:2,unlocatedBalls:8});
  expect(current.summary?.leftBalls).toBe(4);expect(current.summary?.rightBalls).toBe(4);
  expect(JSON.stringify(current)).not.toMatch(/TEST ONLY TWO BALL MEMBER|TEST ONLY NEW HOLDER|personId/);
 });
 it('reads finalized sealed Carry and pairedPv, then only the replay known at each checkpoint',async()=>{
  const tree=(await trees.create(admin,{treeName:'TEST ONLY CARRY HISTORY',reason:'Isolated sealed Carry reconciliation'},randomUUID())).value;
  const root=tree.companyQualificationIds[0],periodEnd=new Date(),periodStart=new Date(periodEnd.getTime()-86400000);
  const batch=await db.settlementBatch.create({data:{settlementType:'BINARY_K1',periodStart,periodEnd,ruleVersionCode:'TEST_ONLY',status:'FINALIZED',finalizedAt:periodEnd}});
  await db.binaryCarry.create({data:{qualificationId:root,periodEnd,ruleVersionCode:'TEST_ONLY',leftCarryIn:0,rightCarryIn:0,leftPeriodGpv:120,rightPeriodGpv:110,pairedPv:100,leftCarryOut:20,rightCarryOut:10,weeklyCapSnapshot:1000}});
  const parameters={format:'UCELL_PARAMETER_SNAPSHOT_V1',ruleVersionCode:'TEST_ONLY',effectiveAt:periodEnd.toISOString(),parameters:[]};
  const content={format:'UCELL_HISTORICAL_REPLAY_V1',kind:'BINARY_K1',sourceId:batch.settlementBatchId,ruleVersionCode:'TEST_ONLY',at:periodEnd.toISOString(),parameters:{...parameters,hash:replayHash(parameters)},recipients:[],evidence:{carryRecipients:[{qualificationId:root,pairedPv:'100',leftCarryOut:'20',rightCarryOut:'10'}]},inputs:{}};
  await db.historicalReplaySnapshot.create({data:{kind:'BINARY_K1',sourceId:batch.settlementBatchId,ruleVersionCode:'TEST_ONLY',content,hash:replayHash(content)}});
  await new Promise(resolve=>setTimeout(resolve,5));
  const originalKnown=new Date();
  await new Promise(resolve=>setTimeout(resolve,5));
  const order=await db.order.create({data:{qualificationId:root,grossAmount:100,netAmount:100,ruleVersionCode:'TEST_ONLY'}});
  const returned=await db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'TEST_ONLY',occurredAt:periodEnd,postedAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID()}});
  const request=await db.settlementRecalculationRequest.create({data:{sourceReturnCaseId:returned.returnCaseId,settlementType:'BINARY_K1',periodStart,periodEnd,impactedQualificationId:root}});
  await new Promise(resolve=>setTimeout(resolve,5));
  const pendingKnown=new Date();
  await new Promise(resolve=>setTimeout(resolve,5));
  const revisedCarry={[root]:{left:'3.5000',right:'0.0000',pairedPv:'42.1250'}};
  const projection=await db.replayCarryProjection.create({data:{actionKey:randomUUID(),settlementBatchId:batch.settlementBatchId,periodEnd,ruleVersionCode:'TEST_ONLY',carry:revisedCarry,stateHash:replayHash(revisedCarry)}});
  await db.settlementRecalculationRequest.update({where:{settlementRecalculationRequestId:request.settlementRecalculationRequestId},data:{status:'PROCESSED',processedAt:new Date()}});
  await new Promise(resolve=>setTimeout(resolve,5));
  const after=new Date(),query:GeoQuery={rootQualificationId:root,dateFrom:periodStart.toISOString(),dateTo:after.toISOString(),asOf:after.toISOString(),knowledgeCutoff:after.toISOString()};
  const original=await geo.capture(admin,{...query,knowledgeCutoff:originalKnown.toISOString()});
  expect(original.carry).toMatchObject({status:'AVAILABLE',value:{left:'20.0000',right:'10.0000',pairedPv:'100.0000'},pairPvStatus:'AVAILABLE',settlementId:batch.settlementBatchId,replaySequence:null});
  const pending=await geo.capture(admin,{...query,knowledgeCutoff:pendingKnown.toISOString()});
  expect(pending.carry).toMatchObject({status:'UNAVAILABLE',reason:'CARRY_REPLAY_PENDING',value:null});
  const revised=await geo.capture(admin,query);
  expect(revised.carry).toMatchObject({status:'AVAILABLE',value:{left:'3.5000',right:'0.0000',pairedPv:'42.1250'},replaySequence:projection.sequence.toString(),settlementId:batch.settlementBatchId});
  expect((await geo.capture(admin,query)).carry).toEqual(revised.carry);
  const stored=await db.binaryCarry.findUniqueOrThrow({where:{qualificationId_periodEnd_ruleVersionCode:{qualificationId:root,periodEnd,ruleVersionCode:'TEST_ONLY'}}});
  expect(stored.pairedPv.toFixed(4)).toBe('100.0000');
 });
 it('rejects revoked sessions and does not trust the client role',async()=>{
  await db.authSession.update({where:{authSessionId:admin.sessionId},data:{status:'REVOKED',revokedAt:new Date()}});
  await expect(geo.capture(admin,input)).rejects.toMatchObject({response:{code:'TREE_ACCESS_DENIED'}});
 });
});
