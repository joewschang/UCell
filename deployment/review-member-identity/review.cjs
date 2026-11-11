'use strict';
const {createHash}=require('node:crypto');
const {PiiCryptoService}=require('@ucell/database');
const {ConflictException}=require('@nestjs/common');
const pending=['DRAFT','NEEDS_MORE_INFO','SUBMITTED','UNDER_REVIEW'];
async function company(db,pid){
 const [row]=await db.$queryRaw`SELECT e.legal_entity_id AS id,e.registered_name AS name,e.registration_no AS number,e.registered_address AS address,e.registration_country_code AS country FROM identity.member_type_current c JOIN identity.legal_entity e USING(legal_entity_id) WHERE c.person_id=${pid}::uuid AND c.active_type='LEGAL_ENTITY'`;
 return row;
}
function corporatePayload(payload,entity){
 return {...payload,applicantType:'LEGAL_ENTITY',legalEntityName:entity.name,legalEntityRegistrationNo:entity.number,legalEntityRegisteredAddress:entity.address??payload.legalEntityRegisteredAddress??'',legalEntityRegistrationCountryCode:entity.country,
 representativeLegalName:payload.representativeLegalName||payload.legalName,representativeNationalityCode:payload.representativeNationalityCode||payload.nationalityCode,representativeIdentityDocumentType:payload.representativeIdentityDocumentType||payload.identityDocumentType,representativeIdentityDocumentNumber:payload.representativeIdentityDocumentNumber||payload.identityDocumentNumber};
}
function individualPayload(payload){
 const result={...payload,applicantType:'INDIVIDUAL',legalName:payload.representativeLegalName||payload.legalName,nationalityCode:payload.representativeNationalityCode||payload.nationalityCode,identityDocumentType:payload.representativeIdentityDocumentType||payload.identityDocumentType,identityDocumentNumber:payload.representativeIdentityDocumentNumber||payload.identityDocumentNumber};
 for(const key of Object.keys(result))if(key.startsWith('legalEntity')||key.startsWith('representative'))delete result[key];
 return result;
}
async function sync(db,pid,eid,type){
 const entity=type==='LEGAL_ENTITY'?await company(db,pid):null;
 if(type==='LEGAL_ENTITY'&&entity?.id!==eid)throw new ConflictException('法人關聯已異動，請重新讀取');
 const apps=await db.formalMemberApplication.findMany({where:{personId:pid,status:{in:pending},OR:[{legalEntityId:null},{legalEntityId:eid}]},include:{snapshots:{orderBy:{version:'desc'},take:1}}});
 const pii=new PiiCryptoService();
 for(const app of apps){
  if(!entity&&!app.legalEntityId)continue;
  const snap=app.snapshots[0];
  if(!snap)throw new ConflictException('申請缺少資料版本，請核對申請紀錄');
  const original=pii.decrypt(snap.payloadCiphertext,snap.keyVersion);
  if(app.applicantType===type&&(!entity||(app.legalEntityId===eid&&original.legalEntityName===entity.name&&original.legalEntityRegistrationNo===entity.number)))continue;
  const payload=entity?corporatePayload(original,entity):individualPayload(original);
  const hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex'),enc=pii.encrypt(payload);
  const id=app.formalMemberApplicationId;
  await db.formalMemberApplicationSnapshot.create({data:{formalMemberApplicationId:id,version:snap.version+1,payloadHash:hash,payloadCiphertext:enc.ciphertext,keyVersion:enc.keyVersion}});
  await db.formalApplicationDocument.updateMany({where:{formalMemberApplicationId:id,documentType:'SIGNED_APPLICATION_AGREEMENT',status:'PRESENT'},data:{status:'SUPERSEDED'}});
  if(app.sourceChannel==='ADMIN_PAPER')await db.formalPaperEvidence.updateMany({where:{formalMemberApplicationId:id},data:{status:'PENDING',reviewedBy:null,reviewedAt:null,note:'會員身分異動，請依新版本核對。'}});
  const changed=await db.formalMemberApplication.updateMany({where:{formalMemberApplicationId:id,currentSnapshotHash:app.currentSnapshotHash,status:app.status},data:{applicantType:type,legalEntityId:entity?.id??null,legalEntityRegistrationNo:entity?.number??null,currentSnapshotHash:hash,...(['SUBMITTED','UNDER_REVIEW'].includes(app.status)?{status:'NEEDS_MORE_INFO',decisionReasonCode:'會員身分已更正，請重新核對並簽署新版合約。'}:{})}});
  if(changed.count!==1)throw new ConflictException('申請資料已更新，請重新整理');
 }
}
async function migrate(tx){
 await tx.$queryRawUnsafe('SELECT true FROM (SELECT pg_advisory_xact_lock(261111961)) l');
 const [row]=await tx.$queryRawUnsafe("SELECT to_regclass('identity.formal_review_identity_release') IS NOT NULL AS ready");
 if(row.ready)return;
 await tx.$executeRawUnsafe('ALTER TABLE identity.formal_member_application DROP CONSTRAINT formal_application_source_rule');
 await tx.$executeRawUnsafe("ALTER TABLE identity.formal_member_application ADD CONSTRAINT formal_application_source_rule CHECK (applicant_type='INDIVIDUAL' OR source_channel='ADMIN_PAPER' OR (source_channel='MEMBER_WEB' AND legal_entity_id IS NOT NULL AND legal_entity_registration_no IS NOT NULL))");
 await tx.$executeRawUnsafe(`CREATE FUNCTION identity.check_web_review_entity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.applicant_type='LEGAL_ENTITY' AND NEW.source_channel='MEMBER_WEB' AND NOT EXISTS(SELECT 1 FROM identity.member_type_current c JOIN identity.legal_entity e USING(legal_entity_id) WHERE c.active_type='LEGAL_ENTITY' AND c.person_id=NEW.person_id AND c.legal_entity_id=NEW.legal_entity_id AND e.registration_no=NEW.legal_entity_registration_no) THEN RAISE EXCEPTION 'WEB_REVIEW_CORRECTION_REQUIRED'; END IF; RETURN NEW; END $$`);
 await tx.$executeRawUnsafe('CREATE TRIGGER web_review_entity_check BEFORE INSERT OR UPDATE OF applicant_type,person_id,legal_entity_id,legal_entity_registration_no,source_channel ON identity.formal_member_application FOR EACH ROW EXECUTE FUNCTION identity.check_web_review_entity()');
 const changes=await tx.$queryRawUnsafe("SELECT * FROM identity.member_type_current ORDER BY changed_at DESC");
 for(const c of changes)await sync(tx,c.person_id,c.legal_entity_id,c.active_type);
 await tx.$executeRawUnsafe('CREATE TABLE identity.formal_review_identity_release (installed_at timestamptz DEFAULT now())');
}
module.exports={sync,company,corporatePayload,migrate};
