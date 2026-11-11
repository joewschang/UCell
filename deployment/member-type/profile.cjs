'use strict';
const {BadRequestException,ConflictException,NotFoundException}=require('@nestjs/common');
const {PiiCryptoService}=require('@ucell/database');
const {registration,evidence}=require('./evidence.cjs');
const {createHash}=require('node:crypto');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function digest(obj){return createHash('sha256').update(JSON.stringify(obj)).digest('hex');}
async function profile(db,type,id){
 if(!uuid.test(id)||!['INDIVIDUAL','LEGAL_ENTITY'].includes(type))throw new BadRequestException('會員資料格式有誤');
 const entity=type==='LEGAL_ENTITY'?await db.legalEntity.findUnique({where:{legalEntityId:id}}):null;
 if(type==='LEGAL_ENTITY'&&!entity)throw new NotFoundException('查無法人');
 const now=new Date();
 const reps=entity?await db.legalEntityRepresentative.findMany({where:{legalEntityId:id,roleCode:'PRIMARY_OPERATING_REPRESENTATIVE',effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}}):[];
 const pid=entity?(reps.length===1?reps[0].personId:null):id;
 const person=pid?await db.person.findUnique({where:{personId:pid},select:{personId:true,legalName:true,memberNo:true,status:true,identityDocumentType:true,identityDocumentNumberCiphertext:true,identityDocumentKeyVersion:true,updatedAt:true}}):null;
 if(!person&&!entity)throw new NotFoundException('查無自然人');
 const [doc]=entity?await db.$queryRaw`SELECT evidence_id AS id,uploaded_at AS at FROM identity.member_type_evidence WHERE legal_entity_id=${id}::uuid AND registration_no=${entity.registrationNo} ORDER BY uploaded_at DESC,evidence_id DESC LIMIT 1`:[];
 const personal=person?.identityDocumentNumberCiphertext&&person.identityDocumentKeyVersion?new PiiCryptoService().decrypt(person.identityDocumentNumberCiphertext,person.identityDocumentKeyVersion):null;
 const balls=await db.qualification.count({where:{kind:'MEMBER_ORIGIN',...(entity?{currentHolderLegalEntityId:id}:{currentHolderPersonId:id})}});
 return {id,type,memberNo:entity?.memberNo??person.memberNo,name:entity?.registeredName??person.legalName,personId:pid,representative:person?.legalName??null,personalIdLast4:typeof personal==='string'?personal.slice(-4):null,registrationNo:entity?.registrationNo??null,evidence:doc??null,balls,version:digest([id,entity?.updatedAt,person?.updatedAt,pid,doc?.id,balls])};
}
async function maintain(db,id,b,actor){
 if(!uuid.test(id)||!uuid.test(b?.requestId??'')||!uuid.test(actor))throw new BadRequestException('請重新開啟資料');
 const num=registration(b.registrationNo),reason=String(b.reason??'').trim();
 if(!reason||reason.length>300)throw new BadRequestException('請輸入 1 到 300 字的異動原因');
 const file=b.file?evidence(b.file):null;
 const fingerprint=digest([id,b.version,num,reason,file?.hash]);
 return db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT legal_entity_id FROM identity.legal_entity WHERE legal_entity_id=${id}::uuid FOR UPDATE`;
 const [previous]=await tx.$queryRaw`SELECT actor_id,request_hash FROM identity.member_type_change WHERE change_id=${b.requestId}::uuid`;
 if(previous){if(previous.actor_id!==actor||previous.request_hash!==fingerprint)throw new ConflictException('異動編號已使用');return {saved:true};}
 const p=await profile(tx,'LEGAL_ENTITY',id);
 if(p.version!==b.version)throw new ConflictException('會員資料已變更，請重新載入');
 if(!p.personId)throw new ConflictException('請先核對法人代表資料');
 if(!file&&(!p.evidence||num!==p.registrationNo))throw new BadRequestException('請上傳與此次統編相符的營業登記文件');
 const owner=await tx.legalEntity.findUnique({where:{registrationNo:num}});
 if(owner&&owner.legalEntityId!==id)throw new ConflictException('統編已由其他法人使用');
 let docId=p.evidence?.id;
 if(file){const [row]=await tx.$queryRaw`INSERT INTO identity.member_type_evidence(legal_entity_id,registration_no,mime,sha256,ciphertext,key_version,uploaded_by) VALUES(${id}::uuid,${num},${file.mime},${file.hash},${file.ciphertext},${file.keyVersion},${actor}::uuid) RETURNING evidence_id AS id`;docId=row.id;}
 if(num!==p.registrationNo)await tx.legalEntity.update({where:{legalEntityId:id},data:{registrationNo:num}});
 await tx.$executeRaw`INSERT INTO identity.member_type_change(change_id,actor_id,request_hash,person_id,legal_entity_id,previous_type,next_type,member_no,reason,evidence_id) VALUES(${b.requestId}::uuid,${actor}::uuid,${fingerprint},${p.personId}::uuid,${id}::uuid,'LEGAL_ENTITY','LEGAL_ENTITY',${p.memberNo},${reason},${docId}::uuid)`;
 return {saved:true};
 });
}
module.exports={profile,maintain,uuid};
async function publicMemberNo(db,personId,fallback){
 const [current]=await db.$queryRaw`SELECT member_no FROM identity.member_type_current WHERE person_id=${personId}::uuid AND active_type='LEGAL_ENTITY'`;
 return current?.member_no??fallback;
}
module.exports.publicMemberNo=publicMemberNo;
