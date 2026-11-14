const {randomUUID}=require('node:crypto'),assert=require('node:assert/strict');
const {PrismaClient}=require('../../backend/packages/database/node_modules/@prisma/client'),db=new PrismaClient();
async function split(tx,dry){
 const now=new Date();
 const people=await tx.person.findMany({where:{membershipState:{not:null},adminAccessGrants:{some:{status:{in:['ACTIVE','SUSPENDED']}}}},include:{adminAccessGrants:{where:{status:{in:['ACTIVE','SUSPENDED']}}}}});
 for(const p of people){
  const count=()=>tx.qualification.count({where:{currentHolderPersonId:p.personId}});
  const balls=await count();
  const staff=await tx.person.create({data:{legalName:p.legalName,preferredName:p.preferredName,email:p.email,status:'EFFECTIVE'}});
  for(const g of p.adminAccessGrants){
   assert(['ADMIN_LOCAL','ENTRA'].includes(g.provider));
   const scope={provider:g.provider,providerSubject:g.providerSubject};
   const link=await tx.identityLink.findUnique({where:{provider_providerSubject:scope}});
   if(link&&link.personId!==staff.personId){
    assert.equal(link.personId,p.personId);
    await tx.identityLink.update({where:{identityLinkId:link.identityLinkId},data:{personId:staff.personId}});
   }
   await tx.adminAccessGrant.update({where:{adminAccessGrantId:g.adminAccessGrantId},data:{status:'REVOKED',validTo:now}});
   const fresh=await tx.adminAccessGrant.create({data:{...scope,personId:staff.personId,roleCode:g.roleCode,status:g.status,validFrom:g.validFrom,validTo:g.validTo}});
   await tx.authSession.updateMany({where:{...{provider:g.provider,subject:g.providerSubject},personId:p.personId,roleCode:{not:null},status:'ACTIVE'},data:{status:'REVOKED',revokedAt:now}});
   const trace=randomUUID();
   await tx.auditEvent.create({data:{actorType:'SYSTEM',action:'ADMIN_GRANT_SEPARATED',eventCode:'ADMIN_GRANT_SEPARATED',entityType:'AdminAccessGrant',entityId:fresh.adminAccessGrantId,requestId:trace,correlationId:trace,traceId:trace,environment:'production',beforeData:{grantId:g.adminAccessGrantId,personId:p.personId},afterData:{personId:staff.personId}}});
   assert.equal((await tx.adminAccessGrant.findUniqueOrThrow({where:{adminAccessGrantId:fresh.adminAccessGrantId}})).roleCode,g.roleCode);
  }
  assert.equal(await count(),balls);
  assert.equal(staff.membershipState,null);
  assert.equal((await tx.person.findUniqueOrThrow({where:{personId:p.personId}})).memberNo,p.memberNo);
  console.log(dry?'trial':'apply',{grants:p.adminAccessGrants.length,balls});
 }
 return people.length;
}
(async()=>{const rollback=Error('trial');try{await db.$transaction(async tx=>{await split(tx,true);throw rollback},{isolationLevel:'Serializable'})}catch(e){if(e!==rollback)throw e;}
await db.$transaction(tx=>split(tx,false),{isolationLevel:'Serializable'});
assert.equal(await db.person.count({where:{membershipState:{not:null},adminAccessGrants:{some:{status:{in:['ACTIVE','SUSPENDED']}}}}}),0);
console.log('Verified separate staff principals');})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
