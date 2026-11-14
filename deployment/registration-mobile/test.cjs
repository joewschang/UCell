const {PrismaClient}=require('../../backend/packages/database/node_modules/@prisma/client');
const db=new PrismaClient(),assert=require('node:assert/strict'),{randomInt}=require('node:crypto');
const scope=require('../registration-email/email-scope.cjs'),rollback=Error('rollback');
(async()=>{
 try{await db.$transaction(async tx=>{
 const mobile='09'+String(randomInt(10000000,99999999)),phones=[mobile,'+886'+mobile.slice(1)];
 const where={mobile:{in:phones},status:{notIn:['VOIDED','CLOSED']},...scope};
 const make=(status,phone)=>tx.person.create({data:{legalName:'測試',status,mobile:phone,membershipState:'NETWORK_MEMBER'}});
 const old=await make('VOIDED',mobile);
 const other=await make('VOIDED',null);
 await tx.person.update({where:{personId:other.personId},data:{mobile:phones[1]}});
 assert.equal(await tx.person.count({where}),0);
 const reserved=await tx.person.findUnique({where:{memberNo:'TW'+mobile}});
 assert.equal(reserved.personId,old.personId);
 const fresh=await make('EFFECTIVE',null);await tx.person.update({where:{personId:fresh.personId},data:{mobile}});
 assert.notEqual(fresh.memberNo,old.memberNo);
 assert.deepEqual(await tx.person.findMany({where,select:{personId:true}}),[{personId:fresh.personId}]);
 for(const [status,total] of [['SUSPENDED',1],['CLOSED',0]]){
 await tx.person.update({where:{personId:fresh.personId},data:{status}});assert.equal(await tx.person.count({where}),total);
 }
 throw rollback;
 });}catch(error){if(error!==rollback)throw error;}
 console.log('PASS multiple retired owners, alternate phone spelling, fresh number, active and suspended protection; test rolled back');
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
