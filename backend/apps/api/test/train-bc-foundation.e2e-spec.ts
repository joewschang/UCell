import {randomUUID} from 'node:crypto';
import {PrismaService,Prisma,captureParameters,bindCompanyLeaderProfile,resolveLeaderProfile,replayHash} from '@ucell/database';
import {BinaryTreeService,TreePrincipal} from '../src/modules/binary-tree/binary-tree.service';
import {BinaryTreeReadService} from '../src/modules/binary-tree/binary-tree-read.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw Error('ISOLATED_DATABASE_REQUIRED');
const db=new PrismaService(),organization=new OrganizationService(db),commands=new BinaryTreeService(db,new IdempotencyService(db),organization),reader=new BinaryTreeReadService(db,commands);
let p:TreePrincipal;
beforeAll(async()=>{
 const person=await db.person.create({data:{legalName:'SYNTHETIC CLOSURE '+randomUUID()}}),subject=randomUUID();
 await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
 await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode:'SUPER_ADMIN',validFrom:new Date(Date.now()-1000)}});
 const session=await db.authSession.create({data:{personId:person.personId,provider:'ENTRA',subject,roleCode:'SUPER_ADMIN',tokenHash:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+3600000)}});
 p={personId:person.personId,provider:'ENTRA',subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};
});
afterAll(()=>db.$disconnect());
const create=async()=> (await commands.create(p,{treeName:'Closure '+randomUUID(),reason:'Synthetic test'},randomUUID())).value;
const time=()=>{const now=new Date().toISOString();return {timezone:'Asia/Taipei' as const,asOf:now,knowledgeCutoff:now,periodStart:'2026-01-01T00:00:00.000Z',periodEnd:'2099-01-01T00:00:00.000Z'}};
it('binds all three bootstrap Balls in independent trees to exact LEADER evidence, with no Global rank grants',async()=>{
 for(let t=0;t<2;t++){
  const tree=await create(),snapshot=await captureParameters(db as unknown as Prisma.TransactionClient,new Date(),'R1.0B');
  for(let i=0;i<3;i++){
   const binding=await db.$transaction(tx=>bindCompanyLeaderProfile(tx,tree.companyQualificationIds[i],snapshot));
   expect(binding).toMatchObject({planCode:'LEADER',binaryTreeId:tree.binaryTreeId,companyPosition:i+1,snapshotHash:snapshot.hash});
   const again=await db.$transaction(tx=>bindCompanyLeaderProfile(tx,tree.companyQualificationIds[i],snapshot));expect(again.bindingId).toBe(binding.bindingId);
   expect(await db.qualificationGlobalRankHistory.count({where:{qualificationId:tree.companyQualificationIds[i]}})).toBe(0);
   await expect(db.companyBootstrapProfileBinding.update({where:{bindingId:binding.bindingId},data:{planCode:'STARTER'}})).rejects.toThrow();
  }
 }
},30000);
it('rejects missing, ambiguous and corrupt snapshots; old sealed profile does not consult new parameters',async()=>{
 const snapshot=await captureParameters(db as unknown as Prisma.TransactionClient,new Date(),'R1.0B'),before=resolveLeaderProfile(snapshot);
 const seal=(parameters:typeof snapshot.parameters)=>{const {hash,...body}=snapshot;const value={...body,parameters};return {...value,hash:replayHash(value)};};
 expect(()=>resolveLeaderProfile(seal(snapshot.parameters.filter(r=>r.code!=='binary.weekly.cap'||r.scope!=='LEADER')))).toThrow();
 const row=snapshot.parameters.find(r=>r.code==='binary.weekly.cap'&&r.scope==='LEADER')!;
 expect(()=>resolveLeaderProfile(seal([...snapshot.parameters,{...row,id:randomUUID()}]))).toThrow();
 expect(()=>resolveLeaderProfile({...snapshot,hash:'0'.repeat(64)})).toThrow();
 const changed=seal(snapshot.parameters.map(r=>r===row?{...r,id:randomUUID(),value:'1234567'}:r));
 expect(resolveLeaderProfile(changed).snapshotHash).not.toBe(before.snapshotHash);
 expect(resolveLeaderProfile(snapshot)).toEqual(before);
});
it('cannot bind a member-origin Ball to Company LEADER even when Company owns it',async()=>{
 const tree=await create(),company=await db.companyPrincipal.findUniqueOrThrow({where:{code:'UCELL_COMPANY'}}),qid=randomUUID(),at=new Date();
 await db.$transaction(async tx=>{
  await tx.qualification.create({data:{qualificationId:qid,kind:'MEMBER_ORIGIN',currentCompanyPrincipalId:company.companyPrincipalId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
  await tx.qualificationPlanHistory.create({data:{qualificationId:qid,planCode:'STARTER',effectiveFrom:at,sourceType:'SYNTHETIC'}});
  await tx.qualificationStatusHistory.create({data:{qualificationId:qid,status:'EFFECTIVE',effectiveFrom:at,sourceType:'SYNTHETIC'}});
  await tx.qualificationOwnerInterval.create({data:{qualificationId:qid,ownerType:'COMPANY',companyPrincipalId:company.companyPrincipalId,effectiveFrom:at,sourceType:'SYNTHETIC',sourceId:tree.binaryTreeId,evidenceHash:'a'.repeat(64)}});
 });
 const snapshot=await captureParameters(db as unknown as Prisma.TransactionClient,new Date(),'R1.0B');
 await expect(db.$transaction(tx=>bindCompanyLeaderProfile(tx,qid,snapshot))).rejects.toMatchObject({response:{code:'COMPANY_PROFILE_KIND_MISMATCH'}});
 expect((await db.qualification.findUniqueOrThrow({where:{qualificationId:qid}})).planLevelCode).toBe('STARTER');
});
it('pins page one through a placement that writes early but commits late; rejects changed context and missing tokens',async()=>{
 const tree=await create();await commands.change(p,tree.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'Synthetic'},randomUUID());
 const owner=await db.person.create({data:{legalName:'SYNTHETIC SNAPSHOT OWNER'}}),ids:string[]=[];
 let parent:string=tree.companyQualificationIds[1];
 for(let i=0;i<101;i++){
  const q=await db.qualification.create({data:{currentHolderPersonId:owner.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
  await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:q.effectiveAt!,sourceType:'SYNTHETIC'}});
  await db.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:q.effectiveAt!,sourceType:'SYNTHETIC'}});
  await db.qualificationHolderHistory.create({data:{qualificationId:q.qualificationId,holderPersonId:owner.personId,effectiveFrom:new Date(),sourceType:'SYNTHETIC',sourceId:randomUUID()}});
  await commands.confirmCompanySponsor(p,tree.binaryTreeId,{qualificationId:q.qualificationId,reason:'Synthetic'},randomUUID());
  // Keep a meaningful 50-level skew while adding the remaining rows as right
  // branches. Binary heap positions are intentionally stored as PostgreSQL
  // bigint, so an artificial 101-level all-left path would exceed the domain.
  const placementParent=i<50?parent:ids[i-50],side=i<50?'LEFT' as const:'RIGHT' as const;
  await commands.place(p,tree.binaryTreeId,{qualificationId:q.qualificationId,binaryParentQualificationId:placementParent,side,expectedVersion:i+2,reason:'Synthetic'},randomUUID());
  ids.push(q.qualificationId);if(i<50)parent=q.qualificationId;
 }
 // Deep paths retain canonical ancestors plus self, rather than quadratic all-ancestor closure.
 const ancestryRows=await db.binaryTreeAncestry.count({where:{binaryTreeId:tree.binaryTreeId}});
 expect(ancestryRows).toBeLessThanOrEqual(5+101*4);
 expect(await db.binaryTreeAncestry.findUnique({where:{binaryTreeId_ancestorQualificationId_descendantQualificationId:{binaryTreeId:tree.binaryTreeId,ancestorQualificationId:tree.companyQualificationIds[0],descendantQualificationId:parent}}})).toMatchObject({depth:51,firstSide:'LEFT'});
 const late=await db.qualification.create({data:{currentHolderPersonId:owner.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
 await db.qualificationPlanHistory.create({data:{qualificationId:late.qualificationId,planCode:'STARTER',effectiveFrom:late.effectiveAt!,sourceType:'SYNTHETIC'}});
  await db.qualificationStatusHistory.create({data:{qualificationId:late.qualificationId,status:'EFFECTIVE',effectiveFrom:late.effectiveAt!,sourceType:'SYNTHETIC'}});
  await db.qualificationHolderHistory.create({data:{qualificationId:late.qualificationId,holderPersonId:owner.personId,effectiveFrom:new Date(),sourceType:'SYNTHETIC',sourceId:randomUUID()}});
 await commands.confirmCompanySponsor(p,tree.binaryTreeId,{qualificationId:late.qualificationId,reason:'Synthetic'},randomUUID());
 let written!:()=>void,release!:()=>void;const ready=new Promise<void>(r=>written=r),hold=new Promise<void>(r=>release=r);
 const writer=db.$transaction(async tx=>{
  await organization.createBinaryPlacement(tx,{parentQualificationId:parent,childQualificationId:late.qualificationId,side:'LEFT',effectiveFrom:new Date()},{sourceType:'SYNTHETIC',actorId:p.personId,reason:'Delayed commit',correlationId:randomUUID()});
  written();await hold;
 },{timeout:30000});
 let first:Awaited<ReturnType<typeof reader.nodes>>,context:ReturnType<typeof time>;
 try{await Promise.race([ready,writer]);context=time();first=await reader.nodes(p,tree.binaryTreeId,context);}
 finally{release();await writer;}
 expect(first!.items).toHaveLength(100);expect(first!.total).toBe(104);expect(first!.nextCursor).toBeTruthy();
 const second=await reader.nodes(p,tree.binaryTreeId,context!,first!.nextCursor!,first!.snapshotToken!);
 const all=[...first!.items,...second.items].map(row=>row.qualificationId);
 expect(new Set(all).size).toBe(104);expect(all).not.toContain(late.qualificationId);expect(second.total).toBe(104);
 expect((await reader.nodes(p,tree.binaryTreeId,context!)).total).toBe(105);
 await expect(reader.nodes(p,tree.binaryTreeId,context!,first!.nextCursor!)).rejects.toMatchObject({response:{code:'TREE_SNAPSHOT_REQUIRED'}});
 await expect(reader.nodes(p,tree.binaryTreeId,{...context!,periodStart:'2026-02-01T00:00:00.000Z'},first!.nextCursor!,first!.snapshotToken!)).rejects.toMatchObject({response:{code:'TREE_SNAPSHOT_CONTEXT_CHANGED'}});
 const detail=await reader.detail(p,tree.binaryTreeId,time());
 expect(detail.result!.positions.find(r=>r.positionNo===4)!.activeLabel).toBe('UNKNOWN');
 const other=await create();await expect(reader.nodes(p,other.binaryTreeId,context!,undefined,first!.snapshotToken!)).rejects.toMatchObject({response:{code:'TREE_SNAPSHOT_CONTEXT_CHANGED'}});
},120000);

it('database exclusion rejects overlapping concurrent ownership while adjacent intervals remain valid',async()=>{
 const person=await db.person.create({data:{legalName:'SYNTHETIC OWNER CONCURRENCY'}});
 const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE'}});
 const base={qualificationId:q.qualificationId,ownerType:'MEMBER' as const,personId:person.personId,sourceType:'SYNTHETIC_CONCURRENCY',evidenceHash:'a'.repeat(64)};
 let entered!:()=>void,release!:()=>void;
 const ready=new Promise<void>(resolve=>entered=resolve),hold=new Promise<void>(resolve=>release=resolve);
 const first=db.$transaction(async tx=>{
  await tx.qualificationOwnerInterval.create({data:{...base,sourceId:randomUUID(),effectiveFrom:new Date('2040-01-01'),effectiveTo:new Date('2040-02-01'),closedRecordedAt:new Date()}});
  entered();await hold;
 },{isolationLevel:'RepeatableRead',timeout:15000});
 await Promise.race([ready,first]);
 let secondEntered!:()=>void;const secondReady=new Promise<void>(resolve=>secondEntered=resolve);
 const second=db.$transaction(async tx=>{await tx.$queryRaw`SELECT txid_current_snapshot()::text`;secondEntered();return tx.qualificationOwnerInterval.create({data:{...base,sourceId:randomUUID(),effectiveFrom:new Date('2040-01-15')}});},{isolationLevel:'RepeatableRead',timeout:15000});
 const settled=second.then(()=>({accepted:true,error:null}),error=>({accepted:false,error}));
 await Promise.race([secondReady,settled]);release();await first;
 const rejected=await settled;expect(rejected.accepted).toBe(false);
 expect(String(rejected.error)).toContain('owner_interval_no_overlap');
 await db.qualificationOwnerInterval.create({data:{...base,sourceId:randomUUID(),effectiveFrom:new Date('2040-02-01')}});
 expect(await db.qualificationOwnerInterval.count({where:{qualificationId:q.qualificationId}})).toBe(2);
});

it('does not publish founding statistics from contradictory canonical ancestry',async()=>{
 const tree=await create();
 await db.binaryTreeAncestry.create({data:{binaryTreeId:tree.binaryTreeId,ancestorQualificationId:tree.companyQualificationIds[2],descendantQualificationId:tree.companyQualificationIds[1],depth:1,firstSide:'LEFT',effectiveFrom:new Date()}});
 const {projectPeriodFacts}=await import('../src/modules/analytics/period-projection-sources');
 const context=time();
 const projected=await db.$transaction(tx=>projectPeriodFacts(tx,{metrics:['founding.statistics'],time:context,dimensions:['binaryTreeId'],groupBy:['binaryTreeId'],filters:{binaryTreeId:tree.binaryTreeId},limit:100}));
 expect(projected).toMatchObject({status:'STALE',rows:[],manifest:{unavailableReason:'CANONICAL_ANCESTRY_EVIDENCE_INCOMPLETE'}});
 expect(await reader.detail(p,tree.binaryTreeId,context)).toMatchObject({status:'UNAVAILABLE',result:null,explainCode:'CANONICAL_ANCESTRY_EVIDENCE_INCOMPLETE'});
});
it('counts every first achieved rank in the period, without losing an earlier same-period promotion',async()=>{
 const tree=await create();await commands.change(p,tree.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'Synthetic rank'},randomUUID());
 const at=new Date(),qid=randomUUID();
 await db.qualification.create({data:{qualificationId:qid,currentHolderPersonId:p.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
 await db.qualificationPlanHistory.create({data:{qualificationId:qid,planCode:'STARTER',effectiveFrom:at,sourceType:'SYNTHETIC'}});
 await db.qualificationStatusHistory.create({data:{qualificationId:qid,status:'EFFECTIVE',effectiveFrom:at,sourceType:'SYNTHETIC'}});
 await db.qualificationHolderHistory.create({data:{qualificationId:qid,holderPersonId:p.personId!,effectiveFrom:at,sourceType:'SYNTHETIC',sourceId:randomUUID()}});
 await commands.confirmCompanySponsor(p,tree.binaryTreeId,{qualificationId:qid,reason:'Synthetic rank'},randomUUID());
 await commands.place(p,tree.binaryTreeId,{qualificationId:qid,binaryParentQualificationId:tree.companyQualificationIds[1],side:'LEFT',expectedVersion:2,reason:'Synthetic rank'},randomUUID());
 const achievedAt=new Date();
 for(const rankCode of ['NEW_STAR','EXCELLENCE'] as const)await db.qualificationGlobalRankHistory.create({data:{qualificationId:qid,rankCode,achievedAt,sourcePeriodEnd:achievedAt,ruleVersionCode:'R1.0B'}});
 await db.qualificationGlobalRankHistory.create({data:{qualificationId:tree.companyQualificationIds[0],rankCode:'NEW_STAR',achievedAt,sourcePeriodEnd:achievedAt,ruleVersionCode:'R1.0B'}});
 const {projectPeriodFacts}=await import('../src/modules/analytics/period-projection-sources');
 const result=await db.$transaction(tx=>projectPeriodFacts(tx,{metrics:['rank.new_achievements'],time:time(),filters:{binaryTreeId:tree.binaryTreeId},dimensions:['binaryTreeId'],groupBy:['binaryTreeId'],limit:100}));
 expect(result.status).toBe('CURRENT');
 expect(result.rows.find(r=>r.key==='NEW_STAR')!.measures.newAchievements).toBe('1');
 expect(result.rows.find(r=>r.key==='EXCELLENCE')!.measures.newAchievements).toBe('1');
 const closedAt=new Date();await db.qualificationStatusHistory.updateMany({where:{qualificationId:qid,effectiveTo:null},data:{effectiveTo:closedAt}});
 await db.qualificationStatusHistory.create({data:{qualificationId:qid,status:'CLOSED',effectiveFrom:closedAt,sourceType:'SYNTHETIC'}});
 for(const metric of ['active.rate','rank.distribution','bonus.distribution']){
  const closed=await db.$transaction(tx=>projectPeriodFacts(tx,{metrics:[metric],time:time(),filters:{binaryTreeId:tree.binaryTreeId},dimensions:['binaryTreeId'],groupBy:['binaryTreeId'],limit:100}));
  expect(closed.status).toBe('CURRENT');expect(closed.manifest[metric==='bonus.distribution'?'populationCount':'eligibleCount']).toBe('0');
 }

});
