import { ConflictException, NotFoundException } from '@nestjs/common';
import { PiiCryptoService, Prisma } from '@ucell/database';
import { createHash, randomUUID } from 'node:crypto';

type Db = Prisma.TransactionClient;
export type RenewalInput = { expectedSnapshotHash:string; contractVersionId:string; contentHash:string; confirmed:boolean };
const signature = 'SIGNED_APPLICATION_AGREEMENT';
const fail = (code='FORMAL_CONTRACT_REFRESH_REQUIRED') => new ConflictException({
  code, message: code === 'FORMAL_CONTRACT_REFRESH_REQUIRED'
    ? '合約版本已更新，請先閱讀並確認新版，再簽名送件。'
    : '申請資料或合約已更新，請重新開啟後核對。',
});
const validAt = (c: any, at: Date) => !!c && c.effectiveFrom <= at && (!c.effectiveTo || c.effectiveTo > at);
const snapshotCrypto = () => new PiiCryptoService();
const publicContract = (c: any) => c && ({id:c.contractDocumentVersionId,version:c.versionCode,title:c.title,content:c.contentText,contentHash:c.contentHash});

async function readState(tx:Db,id:string,personId?:string) {
  const application=await tx.formalMemberApplication.findFirst({
    where:{formalMemberApplicationId:id,...(personId?{personId}:{})},
    include:{snapshots:{orderBy:{version:'desc'},take:1}},
  });
  if(!application) throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
  const snapshot=application.snapshots[0];
  if(!snapshot || application.currentSnapshotHash!==snapshot.payloadHash) throw fail('FORMAL_APPLICATION_VERSION_CONFLICT');
  const payload=snapshotCrypto().decrypt<Record<string,any>>(snapshot.payloadCiphertext,snapshot.keyVersion);
  const now=new Date();
  const [bound,current]=await Promise.all([
    payload.formalContractVersionId ? tx.contractDocumentVersion.findUnique({where:{contractDocumentVersionId:payload.formalContractVersionId}}) : null,
    tx.contractDocumentVersion.findFirst({where:{contractType:'FORMAL_MEMBERSHIP',required:true,audience:{in:['FORMAL_MEMBER','ALL_MEMBERS']},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},orderBy:[{effectiveFrom:'desc'},{contractDocumentVersionId:'desc'}]}),
  ]);
  const active=!!current && current.contractDocumentVersionId===bound?.contractDocumentVersionId && validAt(bound,now);
  let permitted=true;
  if(personId && application.sourceChannel==='ADMIN_PAPER'){
    permitted=application.applicantType==='INDIVIDUAL' && !!await tx.person.findFirst({where:{personId,mobileVerifiedAt:{not:null},identityLinks:{some:{provider:'LINE',status:'ACTIVE'}}},select:{personId:true}});
    if(permitted && application.decisionReasonCode==='PAPER_CONFIRM_PENDING'){
      const [round]=await tx.$queryRaw<{viewed:boolean}[]>`SELECT viewed_at IS NOT NULL AS viewed FROM identity.paper_reconfirmation WHERE application_id=${id}::uuid AND status='OPEN'`;
      permitted=!!round?.viewed;
    }
  }
  if(personId && application.sourceChannel==='MEMBER_WEB' && application.applicantType==='LEGAL_ENTITY' && application.legalEntityId){
    permitted=!!await tx.legalEntityRepresentative.findFirst({where:{personId,legalEntityId:application.legalEntityId,roleCode:'PRIMARY_OPERATING_REPRESENTATIVE',effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},select:{personId:true}});
  }
  const view={requiresRefresh:false,canRefresh:permitted,preservedSignature:false,snapshotHash:snapshot.payloadHash,version:snapshot.version,current:publicContract(current)};
  if(active || !['DRAFT','NEEDS_MORE_INFO','SUBMITTED','UNDER_REVIEW'].includes(application.status)) {
    return {application,snapshot,payload,active,view};
  }

  // A present file was signed for this exact snapshot. Early clients omitted the audit hash:
  // their replacement workflow superseded the old signature and their upload must follow this snapshot.
  if(bound){
    const [round]=application.sourceChannel==='ADMIN_PAPER' && application.decisionReasonCode==='PAPER_CONFIRM_PENDING'
      ? await tx.$queryRaw<{proof_ids:string[]}[]>`SELECT proof_ids FROM identity.paper_reconfirmation WHERE application_id=${id}::uuid AND status='OPEN'`
      : [];
    const [proof]=await tx.$queryRaw<{signed:boolean}[]>`
      WITH chain AS (
        SELECT min(s.created_at) AS starts FROM identity.formal_member_application_snapshot s
        WHERE s.formal_member_application_id=${id}::uuid AND s.version>coalesce((
          SELECT max(prior.version) FROM identity.formal_member_application_snapshot prior
          WHERE prior.formal_member_application_id=s.formal_member_application_id AND prior.payload_hash<>${snapshot.payloadHash}),0)
      ) SELECT EXISTS (
        SELECT 1 FROM identity.formal_application_document d
        JOIN identity.formal_member_application_snapshot s ON s.formal_member_application_snapshot_id=${snapshot.formalMemberApplicationSnapshotId}::uuid
        JOIN identity.contract_document_version c ON c.contract_document_version_id=${bound.contractDocumentVersionId}::uuid
        WHERE d.formal_member_application_id=${id}::uuid AND d.document_type='SIGNED_APPLICATION_AGREEMENT' AND d.status='PRESENT'
          AND d.uploaded_at>=c.effective_from AND (c.effective_to IS NULL OR d.uploaded_at<c.effective_to)
          AND (${!round} OR d.formal_application_document_id=ANY(${round?.proof_ids??[]}::uuid[]))
          AND d.uploaded_at>=(SELECT starts FROM chain) AND NOT EXISTS (
            SELECT 1 FROM audit.audit_event a WHERE a.entity_id=d.formal_application_document_id
              AND a.action='FORMAL_KYC_DOCUMENT_UPLOADED' AND a.after_data ? 'applicationSnapshotHash'
              AND (a.after_data->>'applicationSnapshotHash') IS DISTINCT FROM s.payload_hash
          )
        UNION ALL
        SELECT 1 FROM identity.formal_paper_evidence e
        JOIN identity.contract_document_version c ON c.contract_document_version_id=${bound.contractDocumentVersionId}::uuid
        WHERE ${!round} AND e.formal_member_application_id=${id}::uuid AND e.evidence_type='SIGNED_APPLICATION_AGREEMENT'
          AND e.status='REVIEWED' AND e.reviewed_at>=(SELECT starts FROM chain) AND e.reviewed_at>=c.effective_from
          AND (c.effective_to IS NULL OR e.reviewed_at<c.effective_to)
      ) AS signed`;
    view.preservedSignature=proof.signed;
  }
  if (!view.preservedSignature) {
    view.requiresRefresh=application.status==='DRAFT' || application.status==='NEEDS_MORE_INFO';
  }
  return {application,snapshot,payload,active,view};
}

export async function renewalView(tx:Db,id:string,personId?:string) {
  const {view}=await readState(tx,id,personId);
  if(!view.requiresRefresh && view.current){
    const {content:_,...header}=view.current;
    return {...view,current:header};
  }
  return view;
}

export const signingRenewalView=renewalView;

export async function checkContract(tx:Db,id:string,operation:'sign'|'submit') {
  const state=await readState(tx,id);
  if(operation==='sign' ? !state.active : state.view.requiresRefresh) throw fail();
}

export async function priorUnchanged(tx:Db,app:any,next:Record<string,unknown>) {
  if (!app?.snapshots[0]) return null;
  const s=app.snapshots[0], old=snapshotCrypto().decrypt<Record<string,unknown>>(s.payloadCiphertext,s.keyVersion);
  if (old.formalContractVersionId===next.formalContractVersionId) return null;
  const value=(v:unknown)=>JSON.stringify(typeof v==='string'?v.trim()||null:v??null);
  const changed=Object.keys(next).some(key=>key!=='formalContractVersionId' && value(old[key])!==value(next[key]));
  const {view}=await readState(tx,app.formalMemberApplicationId,app.personId);
  if(changed&&view.preservedSignature&&view.canRefresh&&view.current?.id===next.formalContractVersionId
    &&await tx.consentEvidence.findFirst({where:{personId:app.personId,contractDocumentVersionId:view.current.id},select:{consentEvidenceId:true}}))return null;
  if(changed)throw fail();
  if(view.preservedSignature)return old;
  throw fail();
}

export async function amendmentNeedsSignature(tx:Db,id:string,oldHash:string,newHash:string) {
  return oldHash!==newHash && !(await readState(tx,id)).active;
}

export async function renewContract(tx:Db,id:string,personId:string|undefined,actor:string,body:RenewalInput,requestId:string) {
  await tx.$queryRaw`SELECT formal_member_application_id FROM identity.formal_member_application WHERE formal_member_application_id=${id}::uuid FOR UPDATE`;
  const state=await readState(tx,id,personId), {application,snapshot,payload,view}=state;
  if(!view.canRefresh)throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
  if(!body.confirmed || !view.current || body.contractVersionId!==view.current.id || body.contentHash!==view.current.contentHash) throw fail('FORMAL_CONTRACT_VERSION_CONFLICT');
  if(state.active){
    // Only the preceding renewal of this same snapshot can replay with the old expectation.
    if(view.snapshotHash===body.expectedSnapshotHash) return view;
    const prior=await tx.auditEvent.findFirst({where:{action:'FORMAL_APPLICATION_CONTRACT_RENEWED',entityId:id,
      beforeData:{path:['payloadHash'],equals:body.expectedSnapshotHash},afterData:{path:['payloadHash'],equals:view.snapshotHash}},select:{auditEventId:true}});
    if(prior)return view;
    throw fail('FORMAL_APPLICATION_VERSION_CONFLICT');
  }
  if(!view.requiresRefresh || view.snapshotHash!==body.expectedSnapshotHash) throw fail('FORMAL_APPLICATION_VERSION_CONFLICT');
  const next={...payload,formalContractVersionId:view.current.id};
  const hash=createHash('sha256').update(JSON.stringify(next)).digest('hex'),encrypted=snapshotCrypto().encrypt(next),version=snapshot.version+1;
  await tx.formalMemberApplicationSnapshot.create({data:{formalMemberApplicationId:id,version,payloadHash:hash,payloadCiphertext:encrypted.ciphertext,keyVersion:encrypted.keyVersion}});
  await tx.formalMemberApplication.update({where:{formalMemberApplicationId:id},data:{currentSnapshotHash:hash}});
  await tx.formalApplicationDocument.updateMany({where:{formalMemberApplicationId:id,documentType:signature,status:'PRESENT'},data:{status:'SUPERSEDED'}});
  if(application.sourceChannel==='ADMIN_PAPER'){
    await tx.formalPaperEvidence.updateMany({where:{formalMemberApplicationId:id,evidenceType:signature},data:{status:'PENDING',reviewedAt:null,reviewedBy:null}});
    // New round binds a new snapshot, keeping the original round and its signature evidence.
    await tx.$executeRaw`WITH previous AS(
      UPDATE identity.paper_reconfirmation SET status='REPLACED' WHERE application_id=${id}::uuid AND status='OPEN'
      RETURNING *
    ) INSERT INTO identity.paper_reconfirmation
      (application_id,opened_by,snapshot_hash,snapshot_version,contract_id,note,changes,documents,status,proof_ids)
      SELECT application_id,opened_by,${hash},${version},${view.current.id}::uuid,note,changes,documents,'OPEN',
        ARRAY(SELECT d.formal_application_document_id FROM identity.formal_application_document d
          WHERE d.formal_application_document_id=ANY(previous.proof_ids) AND d.status='PRESENT' AND d.document_type<>'SIGNED_APPLICATION_AGREEMENT')
      FROM previous`;
  }
  await tx.auditEvent.create({data:{actorType:personId?'MEMBER':'ADMIN',actorId:actor,action:'FORMAL_APPLICATION_CONTRACT_RENEWED',
    entityType:'FormalMemberApplication',entityId:id,requestId,correlationId:randomUUID(),
    beforeData:{payloadHash:snapshot.payloadHash,version:snapshot.version,contractVersionId:payload.formalContractVersionId??null},
    afterData:{payloadHash:hash,version,contractVersionId:view.current.id,contentHash:view.current.contentHash}}});
  return {...view,snapshotHash:hash,version,requiresRefresh:false,preservedSignature:false};
}
