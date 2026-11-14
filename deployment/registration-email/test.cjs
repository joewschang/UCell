const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('../../backend/packages/database/node_modules/@prisma/client');
const scope=require('./email-scope.cjs'),db=new PrismaClient();
(async()=>{
 const rollback=Error('expected rollback'),email=randomUUID()+'@example.invalid';
 try{await db.$transaction(async tx=>{
   const where={email:{equals:email.toUpperCase(),mode:'insensitive'},status:{notIn:['VOIDED','CLOSED']},...scope};
   for(const status of ['VOIDED','CLOSED','EFFECTIVE','SUSPENDED']){
     const row=await tx.person.create({data:{legalName:'註冊流程測試',email,membershipState:'NETWORK_MEMBER',status}});
     assert.equal(await tx.person.count({where:{...where,personId:row.personId}}),Number(['EFFECTIVE','SUSPENDED'].includes(status)));
   }
   throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 assert.equal(await db.person.count({where:{email}}),0);
 console.log('PASS historical, current, suspended and case-insensitive email lookups');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
