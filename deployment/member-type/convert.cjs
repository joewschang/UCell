'use strict';
const {BadRequestException,ConflictException}=require('@nestjs/common');
const {randomUUID,createHash}=require('node:crypto');
const {profile,uuid}=require('./profile.cjs');
const {registration,evidence}=require('./evidence.cjs');
const {freeze}=require('./award-owner.cjs');
const conflict=m=>{throw new ConflictException(m);};
async function renumber(tx,request,party,id,from,to){
 await tx.$executeRaw`INSERT INTO identity.member_type_number_change(change_id,party,subject,old_no,new_no) VALUES(${request}::uuid,${party},${id}::uuid,${from},${to})`;
 if(party==='INDIVIDUAL')await tx.person.update({where:{personId:id},data:{memberNo:to}});
 else await tx.legalEntity.update({where:{legalEntityId:id},data:{memberNo:to}});
}
async function moveBall(tx,q,oldType,pid,eid,at,change,no){
 const toEntity=oldType==='INDIVIDUAL',oldId=toEntity?pid:eid;
 if(q.kind!=='MEMBER_ORIGIN'||q.currentCompanyPrincipalId)conflict('此球並非一般會員球');
 await freeze(tx,q.qualificationId,oldType,oldId,no);
 const where={qualificationId:q.qualificationId,effectiveTo:null};
 const [hist,owner]=await Promise.all([tx.qualificationHolderHistory.findMany({where}),tx.qualificationOwnerInterval.findMany({where})]);
 if(hist.length!==1||(toEntity?hist[0].holderPersonId!==pid:hist[0].holderLegalEntityId!==eid)||owner.length>1||(owner.length&&((toEntity?owner[0].personId:owner[0].legalEntityId)!==oldId)))conflict('持有人歷程不一致，請先核對球號 '+q.ballNo);
 await tx.qualificationHolderHistory.update({where:{holderHistoryId:hist[0].holderHistoryId},data:{effectiveTo:at}});
 if(!owner.length)await tx.qualificationOwnerInterval.create({data:{qualificationId:q.qualificationId,ownerType:toEntity?'MEMBER':'LEGAL_ENTITY',personId:toEntity?pid:null,legalEntityId:toEntity?null:eid,effectiveFrom:hist[0].effectiveFrom,effectiveTo:at,sourceType:'HOLDER_HISTORY_IMPORT',sourceId:hist[0].holderHistoryId,evidenceHash:createHash('sha256').update(hist[0].holderHistoryId).digest('hex')}});
 if(owner.length)await tx.qualificationOwnerInterval.update({where:{ownerIntervalId:owner[0].ownerIntervalId},data:{effectiveTo:at,closedRecordedAt:at}});
 const next={qualificationId:q.qualificationId,effectiveFrom:at,sourceType:'MEMBER_TYPE_CORRECTION',sourceId:change};
 await tx.qualificationHolderHistory.create({data:{...next,holderPersonId:toEntity?null:pid,holderLegalEntityId:toEntity?eid:null}});
 await tx.qualificationOwnerInterval.create({data:{...next,ownerType:toEntity?'LEGAL_ENTITY':'MEMBER',personId:toEntity?null:pid,legalEntityId:toEntity?eid:null,evidenceHash:createHash('sha256').update(JSON.stringify([q.qualificationId,change,oldId,at])).digest('hex')}});
 const result=await tx.qualification.update({where:{qualificationId:q.qualificationId},data:{currentHolderPersonId:toEntity?null:pid,currentHolderLegalEntityId:toEntity?eid:null}});
 if(result.ballNo!==q.ballNo)conflict('球號驗證失敗');
 await tx.qualificationSetup.updateMany({where:{qualificationId:q.qualificationId},data:{ownerPersonId:toEntity?null:pid,ownerLegalEntityId:toEntity?eid:null}});
}
async function convert(db,type,id,b,actor){
 if(!uuid.test(id)||!uuid.test(b?.requestId??'')||!uuid.test(actor))throw new BadRequestException('異動資料格式錯誤');
 const toEntity=type==='INDIVIDUAL',next=toEntity?'LEGAL_ENTITY':'INDIVIDUAL';
 if(!['INDIVIDUAL','LEGAL_ENTITY'].includes(type)||b.nextType!==next)throw new BadRequestException('請選擇新的會員類型');
 const reason=String(b.reason??'').trim(),name=String(b.companyName??'').trim();
 if(!reason||reason.length>300||toEntity&&(!name||name.length>150))throw new BadRequestException('請填寫異動原因及完整公司名稱');
 const num=toEntity?registration(b.registrationNo):null,file=toEntity?evidence(b.file):null;
 const request=b.requestId;
 const fingerprint=createHash('sha256').update(JSON.stringify([type,id,next,num,name,file?.hash,b.version,reason])).digest('hex');
 return db.$transaction(async tx=>{
 await tx.$queryRawUnsafe('SELECT true FROM (SELECT pg_advisory_xact_lock(261111941)) s');
 const [previous]=await tx.$queryRaw`SELECT actor_id,request_hash,person_id,legal_entity_id FROM identity.member_type_change WHERE change_id=${request}::uuid`;
 if(previous){if(previous.actor_id!==actor||previous.request_hash!==fingerprint)conflict('異動編號已使用');return {saved:true,id:toEntity?previous.legal_entity_id:previous.person_id};}
 const p=await profile(tx,type,id);
 if(p.version!==b.version)conflict('會員資料已更新，請重新檢查');
 if(!p.personId)conflict('請先核對唯一的法人代表');
 const pid=p.personId;
 await tx.$queryRaw`SELECT person_id FROM identity.person WHERE person_id=${pid}::uuid FOR UPDATE`;
 const person=await tx.person.findUniqueOrThrow({where:{personId:pid}});
 if(!['EFFECTIVE','DRAFT'].includes(person.status)||p.memberNo==='TW8888888888')conflict('目前狀態無法更正會員類型');
 const now=new Date();
 const active=await tx.legalEntityRepresentative.findMany({where:{personId:pid,roleCode:'PRIMARY_OPERATING_REPRESENTATIVE',effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}});
 let entity=toEntity?await tx.legalEntity.findUnique({where:{registrationNo:num}}):await tx.legalEntity.findUniqueOrThrow({where:{legalEntityId:id}});
 if(toEntity&&active.length||!toEntity&&(active.length!==1||active[0].legalEntityId!==id))conflict('代表人已有其他有效法人關係，請先核對會員歸屬');
 if(!toEntity&&!['ACTIVE','DRAFT'].includes(entity.status))conflict('此法人已封存或停權');
 if(toEntity&&entity){
 const [prior]=await tx.$queryRaw`SELECT active_type FROM identity.member_type_current WHERE person_id=${pid}::uuid AND legal_entity_id=${entity.legalEntityId}::uuid`;
 if(entity.status!=='TERMINATED'||prior?.active_type!=='INDIVIDUAL')conflict('統編已對應其他法人');
 }
 if(!toEntity&&await tx.qualification.count({where:{currentHolderPersonId:pid}}))conflict('代表人另持有個人球，請先核對兩個會員身分');
 if(!toEntity&&await tx.formalMemberApplication.count({where:{personId:pid,applicantType:'INDIVIDUAL',status:'APPROVED'}})){
 const [prior]=await tx.$queryRaw`SELECT active_type FROM identity.member_type_current WHERE person_id=${pid}::uuid AND legal_entity_id=${id}::uuid`;
 if(prior?.active_type!=='LEGAL_ENTITY')conflict('代表人已有獨立核准的個人會員，請先核對');
 }
 const [spare]=await tx.$queryRawUnsafe('SELECT identity.allocate_member_no() AS no');
 if(toEntity){
 await renumber(tx,request,'INDIVIDUAL',pid,person.memberNo,spare.no);
 if(entity){await renumber(tx,request,'LEGAL_ENTITY',entity.legalEntityId,entity.memberNo,p.memberNo);entity=await tx.legalEntity.update({where:{legalEntityId:entity.legalEntityId},data:{registeredName:name,status:person.status==='EFFECTIVE'?'ACTIVE':'DRAFT',membershipState:person.membershipState}});}
 else entity=await tx.legalEntity.create({data:{memberNo:p.memberNo,registeredName:name,registrationNo:num,registrationCountryCode:'TW',status:person.status==='EFFECTIVE'?'ACTIVE':'DRAFT',membershipState:person.membershipState}});
 await tx.legalEntityRepresentative.create({data:{personId:pid,legalEntityId:entity.legalEntityId,verifiedBy:actor,verifiedAt:now,effectiveFrom:now}});
 }else{
 await renumber(tx,request,'LEGAL_ENTITY',id,entity.memberNo,spare.no);
 await tx.legalEntityRepresentative.update({where:{legalEntityRepresentativeId:active[0].legalEntityRepresentativeId},data:{effectiveTo:now}});
 await renumber(tx,request,'INDIVIDUAL',pid,person.memberNo,p.memberNo);
 await tx.person.update({where:{personId:pid},data:{membershipState:entity.membershipState,status:entity.status==='ACTIVE'?'EFFECTIVE':'DRAFT'}});
 await tx.legalEntity.update({where:{legalEntityId:id},data:{status:'TERMINATED',membershipState:null}});
 }
 const eid=entity.legalEntityId;
 const balls=await tx.qualification.findMany({where:toEntity?{currentHolderPersonId:pid}:{currentHolderLegalEntityId:eid},orderBy:{qualificationId:'asc'}});
 for(const q of balls){await tx.$queryRaw`SELECT qualification_id FROM membership.qualification WHERE qualification_id=${q.qualificationId}::uuid FOR UPDATE`;await moveBall(tx,q,type,pid,eid,now,request,p.memberNo);}
 let doc=null;
 if(file){const [saved]=await tx.$queryRaw`INSERT INTO identity.member_type_evidence(legal_entity_id,registration_no,mime,sha256,ciphertext,key_version,uploaded_by) VALUES(${eid}::uuid,${num},${file.mime},${file.hash},${file.ciphertext},${file.keyVersion},${actor}::uuid) RETURNING evidence_id AS id`;doc=saved.id;}
 await tx.$executeRaw`INSERT INTO identity.member_type_change(change_id,actor_id,request_hash,person_id,legal_entity_id,previous_type,next_type,member_no,reason,evidence_id,occurred_at) VALUES(${request}::uuid,${actor}::uuid,${fingerprint},${pid}::uuid,${eid}::uuid,${type},${next},${p.memberNo},${reason},${doc}::uuid,${now})`;
 await tx.$executeRaw`INSERT INTO identity.member_type_current(person_id,legal_entity_id,active_type,member_no,changed_at) VALUES(${pid}::uuid,${eid}::uuid,${next},${p.memberNo},${now}) ON CONFLICT(legal_entity_id) DO UPDATE SET active_type=excluded.active_type,member_no=excluded.member_no,changed_at=excluded.changed_at`;
 return {saved:true,id:toEntity?eid:pid,memberNo:p.memberNo,balls:balls.length};
 },{isolationLevel:'Serializable',timeout:60000});
}
module.exports={convert};

