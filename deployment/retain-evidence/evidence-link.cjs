'use strict';
const {PiiCryptoService}=require('@ucell/database');
const {createHash}=require('node:crypto');
const {UnprocessableEntityException}=require('@nestjs/common');
const {evidence}=require('../person/evidence.cjs');
async function registration(db,app){
 if(app.applicantType!=='LEGAL_ENTITY'||!app.legalEntityId||!app.legalEntityRegistrationNo)return null;
 const [proof]=await db.$queryRawUnsafe('SELECT evidence_id AS id,mime AS "mimeType",uploaded_at AS "uploadedAt" FROM identity.member_type_evidence WHERE legal_entity_id=$1::uuid AND registration_no=$2 AND NOT EXISTS(SELECT 1 FROM identity.formal_application_document d JOIN identity.formal_member_application a USING(formal_member_application_id) WHERE a.legal_entity_id=$1::uuid AND d.content_sha256=member_type_evidence.sha256 AND d.malware_scan_status=\'INFECTED\') ORDER BY uploaded_at DESC,evidence_id DESC LIMIT 1',app.legalEntityId,app.legalEntityRegistrationNo);
 return proof?{...proof,type:'CORPORATE_REGISTRATION',status:'PRESENT',fromMemberProfile:true}:null;
}
async function content(db,id){
 const [row]=await db.$queryRawUnsafe("SELECT e.mime,e.ciphertext,e.key_version,e.sha256,a.formal_member_application_id AS app FROM identity.member_type_evidence e JOIN identity.formal_member_application a ON a.legal_entity_id=e.legal_entity_id AND a.legal_entity_registration_no=e.registration_no AND a.applicant_type='LEGAL_ENTITY' WHERE e.evidence_id=$1::uuid AND NOT EXISTS(SELECT 1 FROM identity.formal_application_document d JOIN identity.formal_member_application owner USING(formal_member_application_id) WHERE owner.legal_entity_id=e.legal_entity_id AND d.content_sha256=e.sha256 AND d.malware_scan_status='INFECTED') LIMIT 1",id);
 if(!row)return null;
 const bytes=Buffer.from(new PiiCryptoService().decrypt(row.ciphertext,row.key_version),'base64');
 if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw new UnprocessableEntityException('營登文件完整性驗證失敗');
 return {bytes,mimeType:row.mime,applicationId:row.app};
}
async function saveLinked(db,app,mime,base64,actor){
 if(app.applicantType!=='LEGAL_ENTITY'||!app.legalEntityId||!app.legalEntityRegistrationNo)return;
 const file=evidence({mime,base64});
 await db.$executeRawUnsafe('INSERT INTO identity.member_type_evidence(legal_entity_id,registration_no,mime,sha256,ciphertext,key_version,uploaded_by) VALUES($1::uuid,$2,$3,$4,$5,$6,$7::uuid)',app.legalEntityId,app.legalEntityRegistrationNo,mime,file.hash,file.ciphertext,file.keyVersion,actor);
}
function history(row){
 return row?.documentType==='SIGNED_APPLICATION_AGREEMENT'&&row.status==='SUPERSEDED'&&!!row.storageObjectKey&&row.malwareScanStatus!=='INFECTED';
}
module.exports={registration,content,saveLinked,history};
