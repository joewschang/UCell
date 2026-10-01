import {randomUUID} from 'node:crypto';
import {PrismaService,captureParameters,accountingMonth,routeCompanyFinal} from '@ucell/database';
import {BinaryTreeService,TreePrincipal} from '../src/modules/binary-tree/binary-tree.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {UnifiedPayableService} from '../src/modules/payout/unified-payable.service';
import {maturedPayableSourceSql} from '../src/modules/settlement-jobs/matured-payable-source-query';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('MATURED_PAYABLE_COMPANY_RPV_REAL_DB',()=>{
 let db:PrismaService;beforeAll(()=>{db=new PrismaService();});afterAll(()=>db?.$disconnect());
 it('excludes a real routed Company RPV award while retaining the ordinary source and payout separation',async()=>{
 const treeService=new BinaryTreeService(db,new IdempotencyService(db),new OrganizationService(db));
 const person=await db.person.create({data:{legalName:'SYNTHETIC COMPANY GOLDEN'}}),subject=randomUUID();
 await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
 await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode:'SUPER_ADMIN',validFrom:new Date(Date.now()-1000)}});
 const session=await db.authSession.create({data:{personId:person.personId,provider:'ENTRA',subject,roleCode:'SUPER_ADMIN',tokenHash:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+3600000)}});
 const p:TreePrincipal={personId:person.personId,provider:'ENTRA',subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};
 const start=new Date();
 const tree=(await treeService.create(p,{treeName:'RPV Company Queue Golden',reason:'Synthetic Golden'},randomUUID())).value;
 await treeService.change(p,tree.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'Synthetic Golden'},randomUUID());

 const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}}),at=new Date(),snapshot=await captureParameters(db as any,at,'R1.0B');
 const plan=await db.subscriptionPlan.create({data:{planCode:randomUUID(),displayName:'Synthetic RPV queue',durationMonths:1,prepaidAmount:100,productBoxQty:1,monthlyRecognizedAmount:100,monthlyRpv:1}});
 const subscription=await db.subscription.create({data:{qualificationId:q.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,status:'ACTIVE',startMonth:at,endMonth:at,ruleVersionCode:'R1.0B'}});
 const recognition=await db.monthlyRecognitionSchedule.create({data:{subscriptionId:subscription.subscriptionId,installmentNo:1,recognitionMonth:at,dueAt:at,recognizedAt:at,status:'RECOGNIZED',recognizedAmount:100,rpvAmount:1,ruleVersionCode:'R1.0B'}});
 const make=(recipientQualificationId:string)=>({recognitionId:recognition.recognitionId,sourceQualificationId:q.qualificationId,recipientQualificationId,binaryGeneration:1,effectiveDirectCountSnapshot:1,unlockedDepthSnapshot:5,activeSnapshot:true,theoryAmount:30,payableAmount:30,ruleVersionCode:'R1.0B',parameterSnapshotHash:snapshot.hash,occurredAt:at});
 const ordinary=await db.rpvUplineAwardEvent.create({data:make(q.qualificationId)});
 const company=await db.$transaction(async tx=>{const award=await tx.rpvUplineAwardEvent.create({data:make(tree.companyQualificationIds[3])});const period=await accountingMonth(tx,snapshot,at);expect(await routeCompanyFinal(tx,{sourceRpvAwardId:award.rpvAwardEventId,qualificationId:award.recipientQualificationId,awardType:'RPV',amount:award.payableAmount,at,periodStart:period.start,periodEnd:period.end},snapshot)).toBe(true);return award;});
 const destination=await db.awardEconomicDestination.findUniqueOrThrow({where:{sourceRpvAwardId:company.rpvAwardEventId},include:{effects:true}});expect(destination).toMatchObject({companyPosition:4,destination:'RESERVOIR_B'});expect(destination.finalAmount.toFixed(4)).toBe('30.0000');expect(destination.effects).toHaveLength(1);
 const cutoff=new Date(Date.now()+86400000),asOf=new Date();const rows=await db.$queryRaw<Array<{source_id:string;source_type:string}>>`${maturedPayableSourceSql(cutoff,asOf)}`;expect(rows).toEqual([{source_type:'RPV_UPLINE_AWARD',source_id:ordinary.rpvAwardEventId,qualification_id:q.qualificationId,award_type:'RPV',amount:expect.anything(),matures_at:at,rule_version_code:'R1.0B',created_at:ordinary.createdAt}]);
 await new UnifiedPayableService(db,{} as any).materialize(cutoff,'R1.0B');expect(await db.payableEntry.count({where:{sourceType:'RPV_UPLINE_AWARD',sourceId:company.rpvAwardEventId}})).toBe(0);expect(await db.payableEntry.count({where:{sourceType:'RPV_UPLINE_AWARD',sourceId:ordinary.rpvAwardEventId}})).toBe(1);
 },30000);
});