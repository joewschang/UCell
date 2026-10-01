import * as assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaService,captureParameters,routeCompanyBonus} from '../packages/database/src';
import {BinaryTreeService,TreePrincipal} from '../apps/api/src/modules/binary-tree/binary-tree.service';
import {OrganizationService} from '../apps/api/src/modules/organization/organization.service';
import {IdempotencyService} from '../apps/api/src/common/idempotency/idempotency.service';
async function main(){
 const url=new URL(process.env.DATABASE_URL!);assert.ok(['localhost','127.0.0.1'].includes(url.hostname));assert.match(url.pathname,/^\/ucell_economic_upgrade_[a-f0-9]{32}$/);
 const db=new PrismaService();try{
 if(['seed','seed-current'].includes(process.argv[2])){
  const person=await db.person.create({data:{legalName:'SYNTHETIC ECONOMIC UPGRADE'}}),subject=randomUUID();
  await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode:'SUPER_ADMIN',validFrom:new Date(Date.now()-1000)}});
  const session=await db.authSession.create({data:{personId:person.personId,provider:'ENTRA',subject,roleCode:'SUPER_ADMIN',tokenHash:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+3600000)}}),p:TreePrincipal={personId:person.personId,provider:'ENTRA',subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};
  const service=new BinaryTreeService(db,new IdempotencyService(db),new OrganizationService(db));const tree=(await service.create(p,{treeName:'Synthetic upgrade',treeCode:'ECONOMIC_UPGRADE',reason:'Synthetic isolated migration preservation'},randomUUID())).value;
  await service.change(p,tree.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'Synthetic upgrade'},randomUUID());
  for(const position of [1,4]){
   const at=new Date(),snapshot=await captureParameters(db as any,at,'R1.0B');const write=()=>db.$transaction(async tx=>{const award=await tx.bonusAward.create({data:{recipientQualificationId:tree.companyQualificationIds[position-1],awardType:'REFERRAL',sourceEventId:randomUUID(),theoryAmount:123.4567,payableAmount:123.4567,activeSnapshot:true,planLevelSnapshot:'LEADER',ruleVersionCode:'R1.0B',parameterSnapshotHash:snapshot.hash,occurredAt:at,pendingUntil:at,calculationDetail:{upgradePosition:position}}});await routeCompanyBonus(tx,award,snapshot);});
   if(position===1||process.argv[2]==='seed-current')await write();else await assert.rejects(write(),/award_economic_destination_company_position_check/);
  }
  const count=process.argv[2]==='seed-current'?2:1;assert.equal(await db.awardEconomicDestination.count(),count);assert.equal(await db.reservoirBEffect.count(),count);console.log(process.argv[2]==='seed-current'?'ECONOMIC_CURRENT_FIXTURE_PASS':'ECONOMIC_UPGRADE_126_REPRODUCTION_PASS');
 }else{
  const tree=await db.binaryTree.findUniqueOrThrow({where:{treeCode:'ECONOMIC_UPGRADE'}}),slot=await db.treeCanonicalPosition.findUniqueOrThrow({where:{binaryTreeId_positionNo:{binaryTreeId:tree.binaryTreeId,positionNo:4}}});assert.ok(slot.occupantQualificationId);
  const at=new Date(),snapshot=await captureParameters(db as any,at,'R1.0B');const award=await db.$transaction(async tx=>{const row=await tx.bonusAward.create({data:{recipientQualificationId:slot.occupantQualificationId!,awardType:'REFERRAL',sourceEventId:randomUUID(),theoryAmount:123.4567,payableAmount:123.4567,activeSnapshot:true,planLevelSnapshot:'LEADER',ruleVersionCode:'R1.0B',parameterSnapshotHash:snapshot.hash,occurredAt:at,pendingUntil:at,calculationDetail:{upgradePosition:4}}});await routeCompanyBonus(tx,row,snapshot);return row;});
  const destination=await db.awardEconomicDestination.findUniqueOrThrow({where:{sourceBonusAwardId:award.bonusAwardId}});assert.equal(destination.companyPosition,4);assert.equal(destination.finalAmount.toFixed(4),'123.4567');assert.equal(await db.reservoirBEffect.count(),2);await assert.rejects(db.awardEconomicDestination.update({where:{destinationId:destination.destinationId},data:{finalAmount:1}}));console.log('ECONOMIC_UPGRADE_127_WRITE_AND_IMMUTABILITY_PASS');
 }
 }finally{await db.$disconnect();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
