import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {BinaryTreeService,TreePrincipal} from '../../src/modules/binary-tree/binary-tree.service';
import {OrganizationService} from '../../src/modules/organization/organization.service';
import {IdempotencyService} from '../../src/common/idempotency/idempotency.service';
export async function createEffectiveMemberSponsorFixture(db:PrismaClient){
 const actorPerson=await db.person.create({data:{legalName:`Sponsor admin ${randomUUID()}`,status:'EFFECTIVE'}}),subject=randomUUID();
 await db.identityLink.create({data:{personId:actorPerson.personId,provider:'ENTRA',providerSubject:subject}});await db.adminAccessGrant.create({data:{personId:actorPerson.personId,provider:'ENTRA',providerSubject:subject,roleCode:'SUPER_ADMIN',validFrom:new Date(Date.now()-1000)}});const session=await db.authSession.create({data:{personId:actorPerson.personId,provider:'ENTRA',subject,roleCode:'SUPER_ADMIN',tokenHash:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+3600000)}});
 const actor:TreePrincipal={personId:actorPerson.personId,provider:'ENTRA',subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};const trees=new BinaryTreeService(db as any,new IdempotencyService(db as any),new OrganizationService(db as any));
 const tree=(await trees.create(actor,{treeName:`Sponsor fixture ${randomUUID()}`,reason:'isolated sponsor fixture'},randomUUID())).value;await trees.change(actor,tree.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'activate fixture'},randomUUID());
 const holder=await db.person.create({data:{legalName:`Sponsor holder ${randomUUID()}`,status:'EFFECTIVE'}}),at=new Date();const qualification=await db.qualification.create({data:{currentHolderPersonId:holder.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});await db.qualificationHolderHistory.create({data:{qualificationId:qualification.qualificationId,holderPersonId:holder.personId,effectiveFrom:at,sourceType:'FIXTURE'}});
 await trees.confirmCompanySponsor(actor,tree.binaryTreeId,{qualificationId:qualification.qualificationId,reason:'fixture sponsor'},randomUUID());const placed=(await trees.place(actor,tree.binaryTreeId,{qualificationId:qualification.qualificationId,binaryParentQualificationId:tree.companyQualificationIds[1],side:'LEFT',expectedVersion:2,reason:'fixture member ball'},randomUUID())).value;
 return {tree,holder,qualification:{...qualification,ballNo:placed.ballNo},actor};
}



