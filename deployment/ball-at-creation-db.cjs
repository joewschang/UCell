// Run inside the API container. Default: validate in a rollback-only transaction.
const fs=require('fs'),assert=require('assert/strict'),{randomUUID,createHash}=require('crypto');
const {PrismaClient}=require('/app/packages/database/node_modules/@prisma/client');
const db=new PrismaClient(),sql=fs.readFileSync(process.argv[2],'utf8');
const apply=process.argv.includes('--apply'),migration='20261023020000_ball_number_before_placement';
async function rejected(tx,statement,fragment){
 await tx.$executeRawUnsafe('SAVEPOINT invalid_ball');let failed=false;
 try{await statement();}catch(e){failed=true;assert(String(e.meta?.message||e.message).includes(fragment));}
 await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_ball');
 assert(failed,fragment+' must reject');
}
(async()=>{
 let result;
 try{await db.$transaction(async tx=>{
  await tx.$executeRawUnsafe(sql);
  const member=await tx.person.findUniqueOrThrow({where:{memberNo:'2610000010'},select:{personId:true,membershipState:true}});
  assert.equal(member.membershipState,'FORMAL_MEMBER');
  const candidates=await tx.qualification.findMany({where:{currentHolderPersonId:member.personId,kind:'MEMBER_ORIGIN',status:'DRAFT'}});
  assert.equal(candidates.length,1);const q=candidates[0];
  assert.equal(await tx.binaryTreeMembership.findUnique({where:{qualificationId:q.qualificationId}}),null);
  const setup=await tx.qualificationSetup.findUniqueOrThrow({where:{qualificationId:q.qualificationId}});
  assert(['PLACEMENT_PENDING','PLACEMENT_OVERDUE'].includes(setup.setupStatus));
  const sponsor=await tx.qualification.findUniqueOrThrow({where:{qualificationId:setup.finalSponsorQualificationId}});
  assert.equal(sponsor.ballNo,'AX000001');
  const membership=await tx.binaryTreeMembership.findUniqueOrThrow({where:{qualificationId:sponsor.qualificationId}});
  const tree=await tx.binaryTree.findUniqueOrThrow({where:{binaryTreeId:membership.binaryTreeId}});
  assert.equal(tree.treeCode,'A');assert.equal(tree.status,'ACTIVE');
  const prior=q.ballNo;
  if(!apply&&!prior)await rejected(tx,()=>tx.qualification.update({where:{qualificationId:q.qualificationId},data:{ballNo:'A999999'}}),'BALL_ALLOCATION_REQUIRED');
  const allocate=()=>tx.$queryRaw`SELECT organization.allocate_ball_no(${tree.binaryTreeId}::uuid,${q.qualificationId}::uuid) AS "ballNo"`;
  const [{ballNo}]=await allocate();
  if(prior)assert.equal(prior,ballNo);
  await tx.qualification.update({where:{qualificationId:q.qualificationId},data:{ballNo}});
  assert.equal((await allocate())[0].ballNo,ballNo);
  if(!apply){
   await rejected(tx,()=>tx.qualification.update({where:{qualificationId:q.qualificationId},data:{ballNo:'A999999'}}),'BALL_NO_IMMUTABLE');
   await rejected(tx,()=>tx.qualification.update({where:{qualificationId:q.qualificationId},data:{ballNo:null}}),'BALL_NO_IMMUTABLE');
  }
  const after=await tx.qualification.findUniqueOrThrow({where:{qualificationId:q.qualificationId}});
  assert.equal(after.status,'DRAFT');assert.equal(after.effectiveAt,null);
  assert.equal(await tx.binaryPlacement.findUnique({where:{childQualificationId:q.qualificationId}}),null);
  assert.equal(await tx.binaryTreeMembership.findUnique({where:{qualificationId:q.qualificationId}}),null);
  if(apply){
   const checksum=createHash('sha256').update(sql).digest('hex');
   const existing=await tx.$queryRaw`SELECT checksum FROM public._prisma_migrations WHERE migration_name=${migration} AND finished_at IS NOT NULL`;
   if(existing.length)assert.equal(existing[0].checksum,checksum);
   else await tx.$executeRaw`INSERT INTO public._prisma_migrations(id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES(${randomUUID()},${checksum},now(),${migration},now(),1)`;
   if(!prior){const correlationId=randomUUID();await tx.auditEvent.create({data:{actorType:'SYSTEM',action:'QUALIFICATION_BALL_NUMBER_ALLOCATED_BEFORE_PLACEMENT',entityType:'Qualification',entityId:q.qualificationId,beforeData:{ballNo:null},afterData:{ballNo,memberNo:'2610000010',treeCode:'A',setupStatus:setup.setupStatus,placed:false,authorization:'User requested ball number allocation at creation before placement'},requestId:correlationId,correlationId}});}
  }
  result={applied:apply,memberNo:'2610000010',ballNo,status:after.status,setupStatus:setup.setupStatus,placed:false,idempotent:true};
  if(!apply)throw Error('ROLLBACK_VALIDATION');
 },{isolationLevel:'Serializable',timeout:20000});}catch(e){if(e.message!=='ROLLBACK_VALIDATION')throw e;}
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(()=>db.$disconnect());
