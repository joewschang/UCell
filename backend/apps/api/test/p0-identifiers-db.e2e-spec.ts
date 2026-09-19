import {randomUUID} from 'node:crypto';
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
});
