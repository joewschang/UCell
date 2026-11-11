const {PrismaClient}=require('/app/packages/database/node_modules/@prisma/client');
const db=new PrismaClient(), assert=require('node:assert/strict'), {randomUUID}=require('node:crypto');
const dir='/app/apps/api/dist/modules/person/';
const {convert}=require(dir+'convert.cjs'),{profile}=require(dir+'profile.cjs'),{migrate}=require(dir+'migration.cjs');
const stop=new Error('ROLLBACK_TEST');
(async()=>{
 try{await db.$transaction(async tx=>{
 const scoped=new Proxy(tx,{get(t,k){return k==='$transaction'?fn=>fn(tx):t[k]}});
 await migrate(scoped);
 const [candidate]=await tx.$queryRawUnsafe("SELECT p.person_id id FROM identity.person p JOIN membership.qualification q ON q.current_holder_person_id=p.person_id WHERE p.status='EFFECTIVE' AND q.kind='MEMBER_ORIGIN' AND NOT EXISTS(SELECT 1 FROM identity.legal_entity_representative r WHERE r.person_id=p.person_id AND r.effective_to IS NULL) ORDER BY (SELECT count(*) FROM ledger.bonus_award b WHERE b.recipient_qualification_id=q.qualification_id) DESC LIMIT 1");
 assert(candidate);
 const id=candidate.id, original=await profile(tx,'INDIVIDUAL',id);
 const balls=async where=>(await tx.qualification.findMany({where,select:{qualificationId:true,ballNo:true},orderBy:{qualificationId:'asc'}}));
 const first=await balls({currentHolderPersonId:id});
 const qids=first.map(q=>q.qualificationId);
 const tree=()=>tx.binaryPlacement.findMany({where:{childQualificationId:{in:qids}},orderBy:{childQualificationId:'asc'}});
 const originalTree=await tree();
 const award=await tx.bonusAward.findFirst({where:{recipientQualificationId:{in:qids}}});
 const file={mime:'application/pdf',base64:Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n').toString('base64')};
 const b={requestId:randomUUID(),nextType:'LEGAL_ENTITY',version:original.version,reason:'rollback verification',companyName:'回滾測試公司',registrationNo:'00000019',file};
 await assert.rejects(()=>convert(scoped,'INDIVIDUAL',id,{...b,file:null},id));
 const r=await convert(scoped,'INDIVIDUAL',id,b,id);assert.equal((await convert(scoped,'INDIVIDUAL',id,b,id)).id,r.id);
 const company=await profile(tx,'LEGAL_ENTITY',r.id);
 assert.equal(company.memberNo,original.memberNo);assert.equal(company.registrationNo,b.registrationNo);assert.equal(company.personalIdLast4,original.personalIdLast4);assert(company.evidence);
 assert.deepEqual(await balls({currentHolderLegalEntityId:r.id}),first);
 assert.deepEqual(await tree(),originalTree);
 if(award){
 const qid=award.recipientQualificationId;
 const entries=[{qualificationId:qid,sourceType:'BONUS_AWARD',sourceId:award.bonusAwardId},{qualificationId:qid,sourceType:'BONUS_AWARD',sourceId:randomUUID()}];
 const lib=require(dir+'award-owner.cjs');
 const groups=[...await lib.entryGroups(tx,entries)];
 assert.equal(groups.length,2);assert.equal(groups[0].historic.id,id);assert.equal(groups[0].historic.no,original.memberNo);
 const recipient=await tx.qualification.findUnique({where:{qualificationId:qid},include:{currentHolder:true,currentHolderLegalEntity:true}});
 const old=await lib.lineOwner(tx,{payoutLineId:randomUUID(),recipient,payableEntries:entries.slice(0,1)});
 const fresh=await lib.lineOwner(tx,{payoutLineId:randomUUID(),recipient,payableEntries:entries.slice(1)});
 assert.equal(old.person.personId,id);assert.equal(fresh.entity.legalEntityId,r.id);
 }else throw Error('No award fixture; verify with a synthetic award');
 const back=await convert(scoped,'LEGAL_ENTITY',r.id,{requestId:randomUUID(),nextType:'INDIVIDUAL',version:company.version,reason:'reverse rollback verification'},id);
 assert.equal(back.id,id);assert.deepEqual(await balls({currentHolderPersonId:id}),first);
 assert.equal((await profile(tx,'INDIVIDUAL',id)).memberNo,original.memberNo);
 console.log('TYPE_TEST roundtrip passed');throw stop;
 },{isolationLevel:'Serializable',timeout:90000})}catch(e){if(e!==stop)throw e}
})().catch(e=>{console.error('TYPE_TEST '+String(e.message).replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,'[id]').slice(-1800));process.exitCode=1}).finally(()=>db.$disconnect());
