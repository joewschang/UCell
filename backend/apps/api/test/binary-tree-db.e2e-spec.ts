import {QualificationWorkflowService} from '../src/modules/qualification/qualification-workflow.service';
import {QualificationStatusService} from '../src/modules/qualification/qualification-status.service';
import {BinaryTreeReadService} from '../src/modules/binary-tree/binary-tree-read.service';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '@ucell/database';
import {BinaryTreeService,TreePrincipal} from '../src/modules/binary-tree/binary-tree.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url || !/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw new Error('TREE_TEST_REQUIRES_FRESH_ISOLATED_DATABASE');
const db=new PrismaService();
const service=new BinaryTreeService(db,new IdempotencyService(db),new OrganizationService(db));
let admin:TreePrincipal;
async function principal(role:string){
 const person=await db.person.create({data:{legalName:'SYNTHETIC TREE TEST '+randomUUID()}}),subject=randomUUID();
 await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
 await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode:role,validFrom:new Date(Date.now()-1000)}});
 const session=await db.authSession.create({data:{personId:person.personId,provider:'ENTRA',subject,roleCode:role,tokenHash:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+3600000)}});
 return {personId:person.personId,provider:'ENTRA',subject,role,sessionId:session.authSessionId};
}
describe('Binary tree atomic bootstrap database boundary',()=>{
 beforeAll(async()=>{admin=await principal('SUPER_ADMIN');});
 afterAll(async()=>db.$disconnect());
 it('creates exactly three company qualifications and seven slots; retry reuses every identity',async()=>{
  const input={treeName:'Power recovery test',reason:'Synthetic integration verification'},key=randomUUID();
  const created=await service.create(admin,input,key),again=await service.create(admin,input,key),treeId=created.value.binaryTreeId;
  expect(again.replayed).toBe(true);expect(again.value).toEqual(created.value);
  const members=await db.binaryTreeMembership.findMany({where:{binaryTreeId:treeId}});
  expect(members).toHaveLength(3);
  const positions=await db.treeCanonicalPosition.findMany({where:{binaryTreeId:treeId},orderBy:{positionNo:'asc'}});
  expect(positions).toHaveLength(7);expect(positions.filter(p=>p.occupantQualificationId)).toHaveLength(3);
  const balls=await db.qualification.findMany({where:{qualificationId:{in:members.map(m=>m.qualificationId)}}});
  for(const ball of balls){expect(ball.kind).toBe('COMPANY_BOOTSTRAP');expect(ball.currentHolderPersonId).toBeNull();expect(ball.currentCompanyPrincipalId).toBeTruthy();expect(ball.planLevelCode).toBeNull();}
  const edges=await db.sponsorRelationship.findMany({where:{sponsorQualificationId:positions[0].occupantQualificationId!},orderBy:{sponsorSequenceNo:'asc'}});
  expect(edges.map(e=>e.sponsorSequenceNo)).toEqual([1,2]);
  expect(await db.qualificationHolderHistory.count({where:{qualificationId:{in:balls.map(b=>b.qualificationId)}}})).toBe(0);
  await expect(service.create(admin,{...input,treeName:'Different request'},key)).rejects.toMatchObject({response:{code:'IDEMPOTENCY_CONFLICT'}});
  await expect(db.qualification.update({where:{qualificationId:balls[0].qualificationId},data:{planLevelCode:'LEADER'}})).rejects.toThrow();
  await expect(db.qualificationHolderHistory.create({data:{qualificationId:balls[0].qualificationId,holderPersonId:admin.personId!,effectiveFrom:new Date(),sourceType:'FORGED',sourceId:randomUUID()}})).rejects.toThrow();
  await expect(db.payableEntry.create({data:{qualificationId:balls[0].qualificationId,sourceType:'FORGED',sourceId:randomUUID(),awardType:'REFERRAL',grossAmount:1,availableAt:new Date(),ruleVersionCode:'UNBOUND'}})).rejects.toThrow();
  const outsider=await db.qualification.create({data:{currentHolderPersonId:admin.personId!,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
  await expect(db.treeCanonicalPosition.update({where:{binaryTreeId_positionNo:{binaryTreeId:treeId,positionNo:4}},data:{occupantQualificationId:outsider.qualificationId,occupiedAt:new Date()}})).rejects.toThrow();
  const outsideSponsor=await db.sponsorRelationship.create({data:{sponsorQualificationId:positions[0].occupantQualificationId!,childQualificationId:outsider.qualificationId,sponsorSequenceNo:3,effectiveFrom:new Date()}});
  await expect(db.foundingOccupationEvidence.create({data:{binaryTreeId:treeId,positionNo:4,qualificationId:outsider.qualificationId,initialPersonId:admin.personId!,companySponsorQualificationId:positions[0].occupantQualificationId!,sponsorRelationshipId:outsideSponsor.sponsorRelationshipId,actualSponsorSequenceNo:3,effectiveAt:new Date(),evidenceHash:'a'.repeat(64)}})).rejects.toThrow();
  const activated=await service.change(admin,treeId,{status:'ACTIVE',expectedVersion:1,reason:'Test activation'},randomUUID());
  expect(activated.value.topologyVersion).toBe(2);
  await expect(service.change(admin,treeId,{status:'CLOSED_TO_NEW',expectedVersion:1,reason:'Stale client'},randomUUID())).rejects.toMatchObject({response:{code:'TREE_VERSION_CONFLICT'}});
 });
 it('rolls back bootstrap when its final audit/outbox step fails and succeeds on retry',async()=>{
  const key=randomUUID(),code='T-'+randomUUID().slice(0,8).toUpperCase(),input={treeName:'Crash test',treeCode:code,reason:'Synthetic transaction interruption'};
  const fault=jest.spyOn(service as any,'audit').mockRejectedValueOnce(new Error('TEST_FINAL_WRITE_FAILURE'));
  try{await expect(service.create(admin,input,key)).rejects.toThrow('TEST_FINAL_WRITE_FAILURE');}finally{fault.mockRestore();}
  expect(await db.binaryTree.findUnique({where:{treeCode:code}})).toBeNull();
  expect(await db.idempotencyRecord.findUnique({where:{actorScope_idempotencyKey:{actorScope:'tree:create:'+admin.personId,idempotencyKey:key}}})).toBeNull();
  expect((await service.create(admin,input,key)).replayed).toBe(false);
 });
 it('concurrent duplicate bootstrap converges on a single committed tree',async()=>{
  const key=randomUUID(),input={treeName:'Concurrent bootstrap',reason:'Synthetic duplicate request'};
  const results=await Promise.all([service.create(admin,input,key),service.create(admin,input,key)]);
  expect(results[0].value).toEqual(results[1].value);
  expect(results.filter(r=>!r.replayed)).toHaveLength(1);
 });
 it('historical reads retain the original name/status and hide later state',async()=>{
  const created=await service.create(admin,{treeName:'Original name',reason:'Historical baseline'},randomUUID()),id=created.value.binaryTreeId;
  const cutoff=new Date().toISOString();
  await service.change(admin,id,{treeName:'Later name',status:'ACTIVE',expectedVersion:1,reason:'Later state'},randomUUID());
  const time={timezone:'Asia/Taipei' as const,asOf:cutoff,knowledgeCutoff:cutoff,periodStart:'2026-01-01T00:00:00.000Z',periodEnd:'2099-01-01T00:00:00.000Z'};
  const reader=new BinaryTreeReadService(db,service),old=await reader.detail(admin,id,time);
  expect(old.result).toMatchObject({treeName:'Original name',status:'DRAFT',topologyVersion:1});
  expect(old.result!.positions.filter(p=>p.qualificationId)).toHaveLength(3);
  expect(old.result!.positions.slice(0,3).every(p=>p.activeLabel==='Always Active (Company Rule)')).toBe(true);
  expect((await reader.detail(admin,id,{...time,asOf:'2026-01-01T00:00:00.000Z'})).status).toBe('UNAVAILABLE');
  await expect(db.binaryTree.update({where:{binaryTreeId:id},data:{treeName:'Unaudited name',topologyVersion:3}})).rejects.toThrow();
 });
 it('preserves member origin and placement across explicit Company ownership and retransfer',async()=>{
  const created=await service.create(admin,{treeName:'Ownership intervals',reason:'Synthetic owner history'},randomUUID()),treeId=created.value.binaryTreeId;
  await service.change(admin,treeId,{status:'ACTIVE',expectedVersion:1,reason:'Activate'},randomUUID());
  const person=await db.person.create({data:{legalName:'SYNTHETIC OWNER '+randomUUID()}}),at=new Date();
  const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
  await db.qualificationHolderHistory.create({data:{qualificationId:q.qualificationId,holderPersonId:person.personId,effectiveFrom:at,sourceType:'SYNTHETIC_TEST',sourceId:randomUUID()}});
  await service.confirmCompanySponsor(admin,treeId,{qualificationId:q.qualificationId,reason:'Confirm'},randomUUID());
  await service.place(admin,treeId,{qualificationId:q.qualificationId,binaryParentQualificationId:created.value.companyQualificationIds[1],side:'LEFT',expectedVersion:2,reason:'Place'},randomUUID());
  const workflow=new QualificationWorkflowService(db,new QualificationStatusService(db)),company=await db.companyPrincipal.findUniqueOrThrow({where:{code:'UCELL_COMPANY'}});
  const before=new Date().toISOString(),originalEdge=await db.binaryPlacement.findUniqueOrThrow({where:{childQualificationId:q.qualificationId}});
  const exit=await workflow.submit({qualificationId:q.qualificationId,workflowType:'EXIT',payload:{reviewFeePaid:true,companyPrincipalId:company.companyPrincipalId}});
  await expect(workflow.approve(exit.qualificationWorkflowId)).rejects.toMatchObject({response:{code:'TREE_ACCESS_DENIED'}});
  await workflow.approve(exit.qualificationWorkflowId,undefined,admin);
  expect(await db.qualification.findUnique({where:{qualificationId:q.qualificationId}})).toMatchObject({kind:'MEMBER_ORIGIN',planLevelCode:'STARTER',currentHolderPersonId:null,currentCompanyPrincipalId:company.companyPrincipalId});
  expect(await db.qualificationHolderHistory.count({where:{qualificationId:q.qualificationId,effectiveTo:null}})).toBe(0);
  const reader=new BinaryTreeReadService(db,service),time={timezone:'Asia/Taipei' as const,asOf:new Date().toISOString(),knowledgeCutoff:new Date().toISOString(),periodStart:'2026-01-01T00:00:00.000Z',periodEnd:'2099-01-01T00:00:00.000Z'};
  expect((await reader.detail(admin,treeId,time)).result!.positions[3]).toMatchObject({ownerType:'COMPANY',activeLabel:'Always Active (Company Rule)'});
  expect((await reader.detail(admin,treeId,{...time,asOf:before,knowledgeCutoff:before})).result!.positions[3].ownerType).toBe('MEMBER');
  const receiver=await db.person.create({data:{legalName:'SYNTHETIC RECEIVER '+randomUUID()}});
  const retransfer=await workflow.submit({qualificationId:q.qualificationId,workflowType:'COMPANY_RETRANSFER',receivingPersonId:receiver.personId,payload:{reviewFeePaid:true}});
  await workflow.approve(retransfer.qualificationWorkflowId,undefined,admin);
  expect(await db.qualification.findUnique({where:{qualificationId:q.qualificationId}})).toMatchObject({kind:'MEMBER_ORIGIN',planLevelCode:'STARTER',currentHolderPersonId:receiver.personId,currentCompanyPrincipalId:null});
  expect(await db.binaryPlacement.findUnique({where:{childQualificationId:q.qualificationId}})).toEqual(originalEdge);
  expect(await db.qualificationOwnerInterval.count({where:{qualificationId:q.qualificationId}})).toBe(3);
  await expect(workflow.submit({qualificationId:created.value.companyQualificationIds[0],workflowType:'EXIT'})).rejects.toThrow('BOOTSTRAP_QUALIFICATION_LOCKED');
 });
 it('counts deep descendants beyond twelve generations and rejects cross-tree placement',async()=>{
  const create=()=>service.create(admin,{treeName:'Deep scope test',reason:'Synthetic depth verification'},randomUUID());
  const a=(await create()).value,b=(await create()).value;
  await service.change(admin,a.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'Activate'},randomUUID());
  await service.change(admin,b.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'Activate'},randomUUID());
  let parent:string=a.companyQualificationIds[1],version=2,founder='';
  for(let depth=2;depth<=14;depth++){
   const owner=await db.person.create({data:{legalName:'SYNTHETIC DEPTH '+depth+' '+randomUUID()}}),at=new Date();
   const q=await db.qualification.create({data:{currentHolderPersonId:owner.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
   await db.qualificationHolderHistory.create({data:{qualificationId:q.qualificationId,holderPersonId:owner.personId,effectiveFrom:at,sourceType:'SYNTHETIC_TEST',sourceId:randomUUID()}});
   await service.confirmCompanySponsor(admin,a.binaryTreeId,{qualificationId:q.qualificationId,reason:'Confirm'},randomUUID());
   if(depth===2){founder=q.qualificationId;await expect(service.place(admin,a.binaryTreeId,{qualificationId:q.qualificationId,binaryParentQualificationId:b.companyQualificationIds[1],side:'LEFT',expectedVersion:version,reason:'Cross-tree attempt'},randomUUID())).rejects.toMatchObject({response:{code:'BINARY_TREE_SCOPE_MISMATCH'}});}
   const preview=await service.preview(admin,a.binaryTreeId,{qualificationId:q.qualificationId,binaryParentQualificationId:parent,side:'LEFT',expectedVersion:version});
   if(depth===2)await expect(service.place(admin,a.binaryTreeId,{qualificationId:q.qualificationId,binaryParentQualificationId:parent,side:'RIGHT',expectedVersion:version,preflightToken:preview.preflightToken,reason:'Changed selection'},randomUUID())).rejects.toMatchObject({response:{code:'PLACEMENT_PREFLIGHT_STALE'}});
   await service.place(admin,a.binaryTreeId,{qualificationId:q.qualificationId,binaryParentQualificationId:parent,side:'LEFT',expectedVersion:version++,preflightToken:preview.preflightToken,reason:'Deep placement'},randomUUID());parent=q.qualificationId;
  }
  const now=new Date().toISOString(),time={timezone:'Asia/Taipei' as const,asOf:now,knowledgeCutoff:now,periodStart:'2026-01-01T00:00:00.000Z',periodEnd:'2099-01-01T00:00:00.000Z'},reader=new BinaryTreeReadService(db,service);
  const page=await reader.nodes(admin,a.binaryTreeId,time);expect(page.total).toBe(16);expect(page.items.find(n=>n.qualificationId===parent)?.depth).toBe(14);
  const detail=await reader.detail(admin,a.binaryTreeId,time);expect(detail.result!.positions[3]).toMatchObject({qualificationId:founder,descendantBalls:12,distinctMemberPersons:12,newBallsInPeriod:12});
  await service.change(admin,a.binaryTreeId,{status:'CLOSED_TO_NEW',expectedVersion:version,reason:'Close to new placement'},randomUUID());
  const preview=await new OrganizationService(db).previewPlacement({sponsorQualificationId:a.companyQualificationIds[0],binaryParentQualificationId:parent,binarySide:'RIGHT'});expect(preview).toMatchObject({valid:false,code:'TREE_NOT_OPEN_TO_PLACEMENT'});
 },30000);
 it('denies membership operators the placement override command before any write',async()=>{
  const operator=await principal('MEMBERSHIP_OPS');
  await expect(service.place(operator,randomUUID(),{qualificationId:randomUUID(),binaryParentQualificationId:randomUUID(),side:'LEFT',expectedVersion:1,reason:'Unauthorized override'},randomUUID())).rejects.toMatchObject({response:{code:'TREE_COMMAND_ROLE_DENIED'}});
 });
 it('rechecks revoked sessions before replaying a committed command',async()=>{
  const actor=await principal('SUPER_ADMIN'),input={treeName:'Revocation test',reason:'Synthetic revocation verification'},key=randomUUID();
  await service.create(actor,input,key);
  await db.authSession.update({where:{authSessionId:actor.sessionId},data:{revokedAt:new Date()}});
  await expect(service.create(actor,input,key)).rejects.toMatchObject({response:{code:'TREE_ACCESS_DENIED'}});
 });
});
function permutations(values:number[]):number[][]{return values.length?values.flatMap((v,i)=>permutations(values.filter((_,j)=>i!==j)).map(rest=>[v,...rest])):[[]];}
describe('Founding occupation follows actual Sponsor chronology',()=>{
 beforeAll(async()=>{admin=await principal('SUPER_ADMIN');});
 afterAll(async()=>db.$disconnect());
 it.each(permutations([4,5,6,7]).map(order=>[order.join(','),order] as const))('canonical order %s never renumbers Sponsor sequence',async(_label,order)=>{
  const created=await service.create(admin,{treeName:'Founding '+order.join('-'),reason:'Synthetic permutation'},randomUUID());
  const treeId=created.value.binaryTreeId,roots=created.value.companyQualificationIds;
  await service.change(admin,treeId,{status:'ACTIVE',expectedVersion:1,reason:'Synthetic activation'},randomUUID());
  let version=2,occupied=0;
  for(let i=0;i<order.length;i++){
   const position=order[i],person=await db.person.create({data:{legalName:'SYNTHETIC FOUNDER '+randomUUID()}}),at=new Date();
   const ball=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
   await db.qualificationHolderHistory.create({data:{qualificationId:ball.qualificationId,holderPersonId:person.personId,effectiveFrom:at,sourceType:'SYNTHETIC_TEST',sourceId:randomUUID()}});
   const sponsor=await service.confirmCompanySponsor(admin,treeId,{qualificationId:ball.qualificationId,reason:'Confirm real chronology'},randomUUID());
   expect(sponsor.value.actualSponsorSequenceNo).toBe(i+3);
   const command=()=>service.place(admin,treeId,{qualificationId:ball.qualificationId,binaryParentQualificationId:position<6?roots[1]:roots[2],side:position%2===0?'LEFT':'RIGHT',expectedVersion:version,reason:'Explicit founding position'},randomUUID());
   if(i===0 && position>=6){
    await expect(command()).rejects.toMatchObject({response:{code:'BINARY_LEFT_SUBTREE_REQUIRED'}});
    expect(await db.binaryTreeMembership.findUnique({where:{qualificationId:ball.qualificationId}})).toBeNull();
    expect((await db.sponsorRelationship.findUniqueOrThrow({where:{childQualificationId:ball.qualificationId}})).sponsorSequenceNo).toBe(3);
   }else{
    await command();version++;occupied++;
    const evidence=await db.foundingOccupationEvidence.findUnique({where:{qualificationId:ball.qualificationId}});
    expect(evidence).toMatchObject({positionNo:position,actualSponsorSequenceNo:i+3,companySponsorQualificationId:roots[0]});
   }
  }
  expect(await db.foundingOccupationEvidence.count({where:{binaryTreeId:treeId}})).toBe(occupied);
  expect(await db.binaryTreeMembership.count({where:{binaryTreeId:treeId}})).toBe(3+occupied);
 },30000);
});
