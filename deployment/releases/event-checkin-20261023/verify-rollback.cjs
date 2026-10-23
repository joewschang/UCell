const assert=require('assert/strict'),{randomUUID}=require('crypto'),{PrismaClient}=require('/app/packages/database/node_modules/@prisma/client'),{MemberEventsService}=require('/app/apps/api/dist/modules/events/events.service'),{AuditService}=require('/app/apps/api/dist/common/audit/audit.service');
const db=new PrismaClient(),results={};
(async()=>{try{await db.$transaction(async tx=>{
 const wrapped=new Proxy(tx,{get:(target,prop)=>prop==='$transaction'?(fn)=>fn(tx):target[prop]}),actor=randomUUID(),key=()=>randomUUID(),idem={execute:async(_s,_k,_i,fn)=>({value:await fn(tx)})},events=new MemberEventsService(wrapped,idem,new AuditService()),code='QA_CHECKIN_'+Date.now(),start=new Date(Date.now()+86400000),end=new Date(start.getTime()+3600000);
 const people=await tx.person.findMany({where:{status:{not:'CLOSED'},membershipState:{in:['NETWORK_MEMBER','FORMAL_PENDING','FORMAL_MEMBER']}},select:{personId:true,memberNo:true},take:2});assert.equal(people.length,2,'Need two eligible existing members for rollback-only QA');
 await events.create({eventCode:code,title:'QA rollback only',eventType:'OFFLINE',startsAt:start.toISOString(),endsAt:end.toISOString(),locationReference:'QA',capacity:2},actor,key(),key());await events.publish(code,'QA rollback only',actor,key(),key());
 const first=await events.register(people[0].personId,code,key(),key());assert.match(first.checkInToken,/^[A-Za-z0-9_-]{43}$/);
 await assert.rejects(()=>events.checkIn(first.checkInToken,actor,key(),key(),'WRONG_EVENT'),/EVENT_CHECKIN_WRONG_EVENT/);
 await assert.rejects(()=>events.checkIn(first.checkInToken,actor,key(),key(),code),/EVENT_CHECKIN_OUTSIDE_WINDOW/);
 events.now=()=>new Date(start.getTime()+1000);
 const qr=await events.checkIn(first.checkInToken,actor,key(),key(),code);assert.equal(qr.memberNo,people[0].memberNo);assert.equal(qr.replayed,false);assert.equal((await events.checkIn(first.checkInToken,actor,key(),key(),code)).replayed,true);results.qrAndDuplicate=true;
 const candidate=await events.checkInCandidate(code,people[1].memberNo);assert.equal(candidate.registrationStatus,'NOT_REGISTERED');assert.equal(candidate.eligible,true);
 const manual=await events.checkInMember(code,people[1].memberNo,true,'QA rollback only',actor,key(),key());assert.equal(manual.addedRegistration,true);assert.equal(manual.status,'CHECKED_IN');assert.equal((await events.checkInMember(code,people[1].memberNo,false,undefined,actor,key(),key())).replayed,true);results.manualAndRosterDuplicate=true;
 const rows=await tx.memberEventRegistration.findMany({where:{event:{eventCode:code}},include:{participationEvidence:true}});assert.equal(rows.length,2);for(const row of rows){assert.equal(row.status,'CHECKED_IN');assert.equal(row.participationEvidence.filter(e=>e.eventType==='EVENT_REGISTERED').length,1);assert.equal(row.participationEvidence.filter(e=>e.eventType==='EVENT_CHECKED_IN').length,1);}results.immutableEvidence=true;
 assert.equal((await events.memberDetail(people[0].personId,code)).status,'CHECKED_IN');assert.equal((await events.adminRegistrations(code)).registrations.length,2);
 throw Error('ROLLBACK_QA_SUCCESS');
 },{timeout:30000});}catch(e){if(e.message!=='ROLLBACK_QA_SUCCESS')throw e;}console.log(JSON.stringify({...results,rolledBack:true}));})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>db.$disconnect());
