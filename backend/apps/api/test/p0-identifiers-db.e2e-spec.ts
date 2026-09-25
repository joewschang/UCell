import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
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
 it('allocates per-tree sequences concurrently, replays identities, rolls back and grows beyond six digits',async()=>{
  const actor=await admin(),a=(await trees.create(actor,{treeName:'Sequence A',reason:'Sequence integration test'},randomUUID())).value,
   b=(await trees.create(actor,{treeName:'Sequence B',reason:'Sequence integration test'},randomUUID())).value;
  const person=await db.person.create({data:{legalName:'SEQUENCE HOLDER'}});
  const make=()=>db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
  const qualifications=await Promise.all(Array.from({length:16},make));
  const allocate=(tree:string,q:string)=>db.$queryRaw<Array<{ballNo:string}>>`SELECT organization.allocate_ball_no(${tree}::uuid,${q}::uuid) AS "ballNo"`;
  const numbers=(await Promise.all(qualifications.map(q=>allocate(a.binaryTreeId,q.qualificationId)))).map(rows=>rows[0].ballNo);
  expect(new Set(numbers).size).toBe(16);
  expect(numbers.sort()).toEqual(Array.from({length:16},(_,i)=>`${a.treeCode}${String(i+1).padStart(6,'0')}`));
  const original=(await db.ballNoAllocation.findUniqueOrThrow({where:{qualificationId:qualifications[0].qualificationId}})).sequenceNo;
  expect((await allocate(a.binaryTreeId,qualifications[0].qualificationId))[0].ballNo).toBe(`${a.treeCode}${original.toString().padStart(6,'0')}`);
  expect(await db.ballNoCounter.findUniqueOrThrow({where:{binaryTreeId:a.binaryTreeId}})).toMatchObject({lastSequence:16n});
  await expect(allocate(b.binaryTreeId,qualifications[0].qualificationId)).rejects.toThrow('BALL_ALLOCATION_TREE_MISMATCH');
  await expect(allocate(a.binaryTreeId,a.companyQualificationIds[0])).rejects.toThrow('ORDINARY_BALL_QUALIFICATION_REQUIRED');
  await expect(db.ballNoAllocation.delete({where:{qualificationId:qualifications[0].qualificationId}})).rejects.toThrow('BALL_ALLOCATION_IMMUTABLE');
  const rolledBack=await make();
  await expect(db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT organization.allocate_ball_no(${a.binaryTreeId}::uuid,${rolledBack.qualificationId}::uuid)`;
   throw new Error('TEST_ROLLBACK');
  })).rejects.toThrow('TEST_ROLLBACK');
  expect(await db.ballNoAllocation.findUnique({where:{qualificationId:rolledBack.qualificationId}})).toBeNull();
  expect((await allocate(a.binaryTreeId,rolledBack.qualificationId))[0].ballNo).toBe(`${a.treeCode}000017`);
  const other=await make();expect((await allocate(b.binaryTreeId,other.qualificationId))[0].ballNo).toBe(`${b.treeCode}000001`);
  await db.ballNoCounter.update({where:{binaryTreeId:b.binaryTreeId},data:{lastSequence:999999n}});
  expect((await allocate(b.binaryTreeId,(await make()).qualificationId))[0].ballNo).toBe(`${b.treeCode}1000000`);
 });
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
 it('allocates sequential Ball numbers even when topology grows past six digits',async()=>{
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
   const preview=await trees.preview(actor,tree.binaryTreeId,{qualificationId:qualification.qualificationId,binaryParentQualificationId:qualifications.get(step.parent)!,side:step.side,expectedVersion:version});
   expect(preview.expectedBallNo).toBeNull();
   const placed=await trees.place(actor,tree.binaryTreeId,{qualificationId:qualification.qualificationId,binaryParentQualificationId:qualifications.get(step.parent)!,side:step.side,expectedVersion:version++,reason:'Place P0 growth test Ball'},randomUUID());
   expect(placed.value.binaryPositionNo).toBe(step.position.toString());
   qualifications.set(step.position,qualification.qualificationId);lastBallNo=placed.value.ballNo!;
  }
  expect(lastBallNo).toBe(`${tree.treeCode}${String(path.length).padStart(6,'0')}`);
  const url=process.env.PHASE2_TEST_DATABASE_URL!;
  const result=spawnSync(process.execPath,[resolve(process.cwd(),'../../scripts/p0-identifier-reconstruction-dry-run.mjs')],{cwd:resolve(process.cwd(),'../..'),env:{...process.env,DATABASE_URL:url},encoding:'utf8'});
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('"status": "PASS"');
  // Re-run the actual upgrade SQL over existing published Balls. Everything in
  // this rehearsal rolls back, including the temporary removal of V2 tables.
  const migration=readFileSync(resolve(process.cwd(),'../../packages/database/prisma/migrations/20260925120000_ball_tree_sequence/migration.sql'),'utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
  const upgrade=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'db','execute','--stdin','--url',url],{
   cwd:resolve(process.cwd(),'../..'),encoding:'utf8',input:`BEGIN;
    CREATE TEMP TABLE before_balls AS SELECT qualification_id,ball_no FROM membership.qualification;
    DROP FUNCTION organization.allocate_ball_no(uuid,uuid);
    DROP TABLE organization.ball_no_allocation;
    DROP TABLE organization.ball_no_counter;
    DROP FUNCTION organization.prevent_ball_allocation_mutation();
    ${migration}
    DO $$ BEGIN
     IF EXISTS(SELECT 1 FROM before_balls b JOIN membership.qualification q USING(qualification_id) WHERE b.ball_no IS DISTINCT FROM q.ball_no) THEN RAISE EXCEPTION 'PUBLISHED_BALL_CHANGED'; END IF;
     IF EXISTS(SELECT 1 FROM organization.ball_no_counter c WHERE c.last_sequence<>coalesce((SELECT max(sequence_no) FROM organization.ball_no_allocation a WHERE a.binary_tree_id=c.binary_tree_id),0)) THEN RAISE EXCEPTION 'HIGH_WATER_MARK_INVALID'; END IF;
     IF EXISTS(SELECT 1 FROM organization.ball_no_allocation WHERE rule_version<>'LEGACY_POSITION_V1') THEN RAISE EXCEPTION 'LEGACY_VERSION_INVALID'; END IF;
    END $$;
    ROLLBACK;`});
  expect({status:upgrade.status,stderr:upgrade.stderr,stdout:upgrade.stdout}).toMatchObject({status:0});
 },30000);
});
