const assert=require('assert/strict'),{randomUUID}=require('crypto'),{PrismaClient}=require('/app/packages/database/node_modules/@prisma/client'),{MemberEventsService}=require('/app/apps/api/dist/modules/events/events.service'),{MemberShareLinkService}=require('/app/apps/api/dist/modules/member/member-share-link.service'),{QualificationAccessService}=require('/app/apps/api/dist/modules/auth/qualification-access.service'),{AuditService}=require('/app/apps/api/dist/common/audit/audit.service');
const db=new PrismaClient(),results={};
(async()=>{try{await db.$transaction(async tx=>{
 const wrapped=new Proxy(tx,{get:(target,prop)=>prop==='$transaction'?(fn)=>fn(tx):target[prop]});
 const actor=randomUUID(),key=()=>randomUUID(),idem={execute:async(_s,_k,_i,fn)=>({value:await fn(tx)})},events=new MemberEventsService(wrapped,idem,new AuditService()),code='QA_'+Date.now(),start=new Date(Date.now()+86400000),end=new Date(start.getTime()+3600000);
 await events.create({eventCode:code,title:'QA rollback only',eventType:'OFFLINE',startsAt:start.toISOString(),endsAt:end.toISOString(),locationReference:'QA'},actor,key(),key());
 const image=await events.uploadImage('image/png','iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6WQAAAAASUVORK5CYII=',actor,key(),key());
 await assert.rejects(()=>events.image(image.id));
 let v=await tx.memberEventVersion.findFirstOrThrow({where:{event:{eventCode:code}},orderBy:{version:'desc'}});
 await events.edit(code,{baseVersion:v.version,baseHash:v.contentHash,title:'Updated intro',description:'Updated description',media:{images:[image.id],videos:['https://youtu.be/test']}},actor,key(),key());
 await events.publish(code,'QA rollback',actor,key(),key());assert.equal((await events.image(image.id)).mime_type,'image/png');
 v=await tx.memberEventVersion.findFirstOrThrow({where:{event:{eventCode:code}},orderBy:{version:'desc'}});
 await events.edit(code,{baseVersion:v.version,baseHash:v.contentHash,title:'Next draft',description:'not live',media:{images:[],videos:[]}},actor,key(),key());
 const published=await tx.memberEventVersion.findFirstOrThrow({where:{event:{eventCode:code},status:'PUBLISHED'}});assert.equal(published.title,'Updated intro');results.eventDraftPublishAndImageAccess=true;
 const q=await tx.qualification.findFirst({where:{currentHolderPersonId:{not:null},ballNo:{not:null}},select:{qualificationId:true,currentHolderPersonId:true}});assert(q);
 const shares=new MemberShareLinkService(new QualificationAccessService(wrapped),wrapped),link=await shares.create(q.currentHolderPersonId,q.qualificationId,new Date(),undefined,{eventCode:code}),token=link.shareUrl.split('/').pop();assert.match(token,/^s_[A-Za-z0-9_-]{22}$/);const legacy=await shares.resolveToken(token);assert.equal((await shares.preview(token)).destination,'/events?event='+code);assert.equal((await shares.preview(legacy)).destination,'/events?event='+code);await shares.revoke(q.currentHolderPersonId,q.qualificationId,(await tx.referralLink.findUniqueOrThrow({where:{tokenHash:shares.hash(legacy)}})).referralLinkId);await assert.rejects(()=>shares.preview(token));results.shortAndLegacyAndRevoke=true;
 throw Error('ROLLBACK_QA_SUCCESS');
 },{timeout:30000});}catch(e){if(e.message!=='ROLLBACK_QA_SUCCESS')throw e;}console.log(JSON.stringify({...results,rolledBack:true}));})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>db.$disconnect());
