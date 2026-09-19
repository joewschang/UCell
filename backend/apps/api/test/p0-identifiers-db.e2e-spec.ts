import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {PrismaService} from '@ucell/database';
import {BinaryTreeService,TreePrincipal} from '../src/modules/binary-tree/binary-tree.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url || !/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw new Error('P0_IDENTIFIER_TEST_REQUIRES_FRESH_ISOLATED_DATABASE');
const db=new PrismaService();
const trees=new BinaryTreeService(db,new IdempotencyService(db),new OrganizationService(db));
async function admin():Promise<TreePrincipal>{
 const person=await db.person.create({data:{legalName:'P0 IDENTIFIER ADMIN '+randomUUID()}}),subject=randomUUID();
 await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
 await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode:'SUPER_ADMIN',validFrom:new Date(Date.now()-1000)}});
 const session=await db.authSession.create({data:{personId:person.personId,provider:'ENTRA',subject,roleCode:'SUPER_ADMIN',tokenHash:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+3600000)}});
 return {personId:person.personId,provider:'ENTRA',subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};
}

describe('P0 identifier database boundary',()=>{
 afterAll(async()=>db.$disconnect());
 it('allocates globally unique Taipei YYMM member numbers under concurrent Person creation',async()=>{
  const persons=await Promise.all(Array.from({length:32},(_,index)=>db.person.create({data:{legalName:`P0 CONCURRENT ${index} ${randomUUID()}`}})));
  const memberNos=persons.map(person=>person.memberNo);
  expect(new Set(memberNos).size).toBe(persons.length);
  expect(memberNos.every(memberNo=>/^\d{10}$/.test(memberNo))).toBe(true);
  expect(memberNos.every(memberNo=>memberNo.slice(4)!=='000000')).toBe(true);
  await expect(db.person.update({where:{personId:persons[0].personId},data:{memberNo:'0000000001'}})).rejects.toThrow('MEMBER_NO_IMMUTABLE');
  await expect(db.person.create({data:{legalName:'P0 DUPLICATE',memberNo:memberNos[0]}})).rejects.toThrow();
 });
 it('rejects an assigned Ball number without an authoritative binary position',async()=>{
  const person=await db.person.create({data:{legalName:'P0 BALL BOUNDARY '+randomUUID()}});
  await expect(db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date(),ballNo:'A000001'}})).rejects.toThrow('BALL_NO_REQUIRES_BINARY_POSITION');
 });
 it('resolves public Member and Ball identifiers with unique and tree-scoped fail-closed semantics',async()=>{
  const actor=await admin(),tree=(await trees.create(actor,{treeName:'P0 public identifiers',reason:'P0 database verification'},randomUUID())).value;
  const person=await db.person.create({data:{legalName:'P0 IDENTIFIER HOLDER '+randomUUID()}});
  const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
  expect(await trees.resolveUnplacedMemberQualification(actor,person.memberNo)).toBe(q.qualificationId);
  expect(await trees.resolveTreeBall(actor,tree.binaryTreeId,tree.companyBallNos[1])).toBe(tree.companyQualificationIds[1]);
  await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'ELITE',status:'EFFECTIVE',effectiveAt:new Date()}});
  await expect(trees.resolveUnplacedMemberQualification(actor,person.memberNo)).rejects.toMatchObject({response:{code:'MEMBER_NO_QUALIFICATION_AMBIGUOUS'}});
 });
 it('keeps the reconstruction dry run correct when a Ball ordinal grows past six digits',async()=>{
  const actor=await admin(),tree=(await trees.create(actor,{treeName:'P0 natural Ball Number growth',reason:'Verify dry-run natural ordinal growth'},randomUUID())).value;
  await trees.change(actor,tree.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'Activate P0 growth verification'},randomUUID());
  const path=[
   {position:4n,parent:2n,side:'LEFT' as const},
   {position:7n,parent:3n,side:'RIGHT' as const},
   {position:15n,parent:7n,side:'RIGHT' as const},
   {position:30n,parent:15n,side:'LEFT' as const},
   {position:61n,parent:30n,side:'RIGHT' as const},
   {position:122n,parent:61n,side:'LEFT' as const},
   {position:244n,parent:122n,side:'LEFT' as const},
   {position:488n,parent:244n,side:'LEFT' as const},
   {position:976n,parent:488n,side:'LEFT' as const},
   {position:1953n,parent:976n,side:'RIGHT' as const},
   {position:3906n,parent:1953n,side:'LEFT' as const},
   {position:7812n,parent:3906n,side:'LEFT' as const},
   {position:15625n,parent:7812n,side:'RIGHT' as const},
   {position:31250n,parent:15625n,side:'LEFT' as const},
   {position:62500n,parent:31250n,side:'LEFT' as const},
   {position:125000n,parent:62500n,side:'LEFT' as const},
   {position:250000n,parent:125000n,side:'LEFT' as const},
   {position:500001n,parent:250000n,side:'RIGHT' as const},
   {position:1000003n,parent:500001n,side:'RIGHT' as const},
  ];
  const qualifications=new Map<bigint,string>([[1n,tree.companyQualificationIds[0]],[2n,tree.companyQualificationIds[1]],[3n,tree.companyQualificationIds[2]]]);
  let version=2,lastBallNo='';
  for(const step of path){
   const at=new Date(),person=await db.person.create({data:{legalName:`P0 GROWTH ${step.position} ${randomUUID()}`}});
   const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
   await db.qualificationHolderHistory.create({data:{qualificationId:qualification.qualificationId,holderPersonId:person.personId,effectiveFrom:at,sourceType:'P0_GROWTH_TEST',sourceId:randomUUID()}});
   await trees.confirmCompanySponsor(actor,tree.binaryTreeId,{qualificationId:qualification.qualificationId,reason:'Confirm P0 growth test sponsor'},randomUUID());
   const placed=await trees.place(actor,tree.binaryTreeId,{qualificationId:qualification.qualificationId,binaryParentQualificationId:qualifications.get(step.parent)!,side:step.side,expectedVersion:version++,reason:'Place P0 growth test Ball'},randomUUID());
   expect(placed.value.binaryPositionNo).toBe(step.position.toString());
   qualifications.set(step.position,qualification.qualificationId);lastBallNo=placed.value.ballNo!;
  }
  expect(lastBallNo).toBe(`${tree.treeCode}1000000`);
  const url=process.env.PHASE2_TEST_DATABASE_URL!;
  const result=spawnSync(process.execPath,[resolve(process.cwd(),'../../scripts/p0-identifier-reconstruction-dry-run.mjs')],{cwd:resolve(process.cwd(),'../..'),env:{...process.env,DATABASE_URL:url},encoding:'utf8'});
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('"status": "PASS"');
 },30000);
});
