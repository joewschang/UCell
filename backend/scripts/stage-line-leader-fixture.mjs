import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

export const personId = '51000000-0000-4000-8000-000000000001';
export const ids = [101,102,103].map(n => `51000000-0000-4000-8000-000000000${n}`);
const anchorId = '08b1bca2-a9a7-4595-a49c-3ad8c9c4d1e8';
const reference = 'STAGE-LINE-LEADER-UAT-20261001';
export function validateEnvironment(env) {
  if (env.UCELL_ENVIRONMENT !== 'STAGE' || env.UCELL_STAGE_LEADER_OPT_IN !== reference) throw new Error('STAGE_OPT_IN_REQUIRED');
  const url = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com' || url.pathname !== '/ucell_stage') throw new Error('STAGE_DATABASE_REQUIRED');
}
export async function seed(db, organization) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('STAGE-LINE-LEADER-UAT-20261001'))`;
    const person = await tx.person.findUniqueOrThrow({where:{personId}});
    if (person.memberNo !== '2609000001' || person.legalName !== 'Stage UAT Member' || person.status !== 'EFFECTIVE' || person.membershipState !== 'FORMAL_MEMBER' || person.securityStatus !== 'NORMAL') throw new Error('FIXTURE_PERSON_MISMATCH');
    const existing = await tx.qualification.findMany({where:{qualificationId:{in:ids}},include:{holderHistory:true,binaryTreeMembership:true}});
    if (existing.length) {
      if (existing.length !== 3 || existing.some(q => q.currentHolderPersonId !== personId || q.planLevelCode !== 'LEADER' || !q.ballNo || !q.binaryTreeMembership || !q.holderHistory.some(h=>h.holderPersonId===personId && h.effectiveTo===null))) throw new Error('FIXTURE_CONFLICT');
      return {replayed:true,balls:existing.map(q=>({id:q.qualificationId,ballNo:q.ballNo,plan:q.planLevelCode}))};
    }
    const anchor = await tx.qualification.findUniqueOrThrow({where:{qualificationId:anchorId},include:{binaryTreeMembership:true}});
    if (anchor.ballNo !== 'A000013' || !anchor.binaryTreeMembership) throw new Error('FIXTURE_ANCHOR_MISMATCH');
    const result=[];
    for (let i=0;i<ids.length;i++) {
      const id=ids[i], parent=i===0?anchorId:ids[0], sponsor=parent, side=i===2?'RIGHT':'LEFT', at=new Date(), correlationId=randomUUID();
      const sequence=await organization.allocateSponsorSequence(tx,sponsor);
      await organization.assertBinarySlotAvailable(tx,parent,side);
      await organization.assertFirstThirdLeftRule(tx,sponsor,sequence,parent,side);
      await tx.qualification.create({data:{qualificationId:id,currentHolderPersonId:personId,planLevelCode:'LEADER',status:'EFFECTIVE',activeFlag:false,effectiveAt:at}});
      await organization.assertNoBinaryCycle(tx,id,parent);
      await tx.qualificationPlanHistory.create({data:{qualificationId:id,planCode:'LEADER',effectiveFrom:at,sourceType:'STAGE_UAT_FIXTURE'}});
      await tx.qualificationHolderHistory.create({data:{qualificationId:id,holderPersonId:personId,effectiveFrom:at,sourceType:'STAGE_UAT_FIXTURE'}});
      await tx.sponsorRelationship.create({data:{sponsorQualificationId:sponsor,childQualificationId:id,sponsorSequenceNo:sequence,effectiveFrom:at}});
      await organization.createBinaryPlacement(tx,{parentQualificationId:parent,childQualificationId:id,side,effectiveFrom:at},{actorType:'SYSTEM',sourceType:'STAGE_UAT_FIXTURE',reason:reference,correlationId});
      const placed=await tx.qualification.findUniqueOrThrow({where:{qualificationId:id}});
      await tx.auditEvent.create({data:{actorType:'SYSTEM',action:'STAGE_UAT_LEADER_CREATED',entityType:'QUALIFICATION',entityId:id,afterData:{memberNo:person.memberNo,ballNo:placed.ballNo,plan:'LEADER',sponsorQualificationId:sponsor,parentQualificationId:parent,side,authorizationReference:reference},requestId:correlationId,correlationId}});
      result.push({id,ballNo:placed.ballNo,plan:'LEADER',side});
    }
    return {replayed:false,balls:result};
  },{isolationLevel:'Serializable',timeout:60000});
}
export async function main() {
  validateEnvironment(process.env);
  const require=createRequire('/app/apps/api/package.json');
  const {PrismaClient}=require('@prisma/client');
  const {OrganizationService}=require('/app/apps/api/dist/modules/organization/organization.service.js');
  const db=new PrismaClient();
  try { console.log('STAGE_LINE_LEADER_FIXTURE '+JSON.stringify(await seed(db,new OrganizationService(db)))); }
  finally { await db.$disconnect(); }
}
