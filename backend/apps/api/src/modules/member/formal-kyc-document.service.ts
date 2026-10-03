import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {FormalKycStorageService} from './formal-kyc-storage.service';
import {validKycImage} from './kyc-image-validation';

const REQUIRED_WEB=['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'] as const;
const ALLOWED_MIME=new Set(['image/jpeg','image/png']);
const MAX_BYTES=10*1024*1024;

@Injectable()
export class FormalKycDocumentService{
  constructor(private readonly db:PrismaService,private readonly storage:FormalKycStorageService,private readonly audit:AuditService){}

  async listOwn(personId:string,applicationId:string){
    const app=await this.db.formalMemberApplication.findFirst({where:{formalMemberApplicationId:applicationId,personId}});
    if(!app)throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
    const rows=await this.db.formalApplicationDocument.findMany({where:{formalMemberApplicationId:applicationId,status:{not:'SUPERSEDED'}},orderBy:{createdAt:'desc'}});
    return {applicationId,required:app.sourceChannel==='MEMBER_WEB'&&app.applicantType==='INDIVIDUAL'?[...REQUIRED_WEB]:[],documents:rows.map(r=>({id:r.formalApplicationDocumentId,type:r.documentType,status:r.status,scanStatus:r.malwareScanStatus,mimeType:r.mimeType,sizeBytes:r.sizeBytes,uploadedAt:r.uploadedAt?.toISOString()??null}))};
  }

  async upload(personId:string,applicationId:string,type:string,mimeType:string,contentBase64:string,requestId:string){
    if(!REQUIRED_WEB.includes(type as any))throw new UnprocessableEntityException({code:'FORMAL_KYC_DOCUMENT_TYPE_NOT_ALLOWED'});
    if(!ALLOWED_MIME.has(mimeType))throw new BadRequestException({code:'FORMAL_KYC_DOCUMENT_MIME_NOT_ALLOWED'});
    if(typeof contentBase64!=='string'||contentBase64.length>4*Math.ceil(MAX_BYTES/3))throw new BadRequestException({code:'FORMAL_KYC_DOCUMENT_SIZE_INVALID'});
    if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64))throw new BadRequestException({code:'FORMAL_KYC_DOCUMENT_ENCODING_INVALID'});
    const bytes=Buffer.from(contentBase64,'base64');
    if(bytes.toString('base64')!==contentBase64)throw new BadRequestException({code:'FORMAL_KYC_DOCUMENT_ENCODING_INVALID'});
    if(!bytes.length||bytes.length>MAX_BYTES)throw new BadRequestException({code:'FORMAL_KYC_DOCUMENT_SIZE_INVALID'});
    if(!validKycImage(bytes,mimeType))throw new BadRequestException({code:'FORMAL_KYC_DOCUMENT_CONTENT_INVALID'});
    const app=await this.db.formalMemberApplication.findFirst({where:{formalMemberApplicationId:applicationId,personId}});
    if(!app)throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
    if(app.sourceChannel!=='MEMBER_WEB'||app.applicantType!=='INDIVIDUAL')throw new ForbiddenException({code:'FORMAL_KYC_WEB_UPLOAD_NOT_ALLOWED'});
    if(!['DRAFT','NEEDS_MORE_INFO'].includes(app.status))throw new ForbiddenException({code:'FORMAL_APPLICATION_LOCKED'});

    const objectKey='formal/'+applicationId+'/'+type+'/'+randomUUID();
    const sha=createHash('sha256').update(bytes).digest('hex');
    await this.storage.put(objectKey,bytes,mimeType);
    const now=new Date();
    let row;
    try{row=await this.db.$transaction(async tx=>{
      const current=await tx.formalMemberApplication.findFirst({where:{formalMemberApplicationId:applicationId,personId}});
      if(!current||!['DRAFT','NEEDS_MORE_INFO'].includes(current.status))throw new ForbiddenException({code:'FORMAL_APPLICATION_LOCKED'});
      await tx.formalApplicationDocument.updateMany({where:{formalMemberApplicationId:applicationId,documentType:type as any,status:'PRESENT'},data:{status:'SUPERSEDED'}});
      const created=await tx.formalApplicationDocument.create({data:{formalMemberApplicationId:applicationId,documentType:type as any,status:'PRESENT',storageObjectKey:objectKey,contentSha256:sha,mimeType,sizeBytes:bytes.length,malwareScanStatus:'PENDING',uploadedByPersonId:personId,uploadedAt:now}});
      await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'FORMAL_KYC_DOCUMENT_UPLOADED',entityType:'FormalApplicationDocument',entityId:created.formalApplicationDocumentId,afterData:{applicationId,documentType:type,mimeType,sizeBytes:bytes.length,contentSha256:sha},requestId,correlationId:randomUUID()});
      return created;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}catch(error){
      if((error as any).code==='P2034')throw new ConflictException({code:'RETRYABLE_CONFLICT'});
      throw error;
    }
    return {id:row.formalApplicationDocumentId,type:row.documentType,status:row.status,scanStatus:row.malwareScanStatus,mimeType:row.mimeType,sizeBytes:row.sizeBytes,uploadedAt:row.uploadedAt?.toISOString()??null};
  }

  async adminList(applicationId:string){
    const app=await this.db.formalMemberApplication.findUnique({where:{formalMemberApplicationId:applicationId}});
    if(!app)throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
    const rows=await this.db.formalApplicationDocument.findMany({where:{formalMemberApplicationId:applicationId},orderBy:{createdAt:'desc'}});
    return rows.map(r=>({id:r.formalApplicationDocumentId,type:r.documentType,status:r.status,scanStatus:r.malwareScanStatus,mimeType:r.mimeType,sizeBytes:r.sizeBytes,uploadedAt:r.uploadedAt?.toISOString()??null,reviewedAt:r.reviewedAt?.toISOString()??null}));
  }

  async adminContent(documentId:string,actorId:string,requestId:string){
    if(!actorId)throw new ForbiddenException({code:'ADMIN_PERSON_ID_REQUIRED'});
    const row=await this.db.formalApplicationDocument.findUnique({where:{formalApplicationDocumentId:documentId}});
    if(!row||!row.storageObjectKey||row.status==='SUPERSEDED')throw new NotFoundException({code:'FORMAL_KYC_DOCUMENT_NOT_FOUND'});
    if(row.status!=='PRESENT'||row.malwareScanStatus!=='CLEAN')throw new UnprocessableEntityException({code:'FORMAL_KYC_SCAN_CLEAN_REQUIRED'});
    const blob=await this.storage.get(row.storageObjectKey);
    if(!row.mimeType||blob.bytes.length!==row.sizeBytes||createHash('sha256').update(blob.bytes).digest('hex')!==row.contentSha256||!validKycImage(blob.bytes,row.mimeType))throw new UnprocessableEntityException({code:'FORMAL_KYC_DOCUMENT_INTEGRITY_FAILED'});
    await this.db.$transaction(tx=>this.audit.write(tx,{actorType:'ADMIN',actorId,action:'FORMAL_KYC_DOCUMENT_VIEWED',entityType:'FormalApplicationDocument',entityId:documentId,afterData:{applicationId:row.formalMemberApplicationId,documentType:row.documentType},requestId,correlationId:randomUUID()}));
    return {bytes:blob.bytes,mimeType:row.mimeType};
  }

  async recordScan(documentId:string,status:'CLEAN'|'INFECTED'|'FAILED',actorId:string,requestId:string){
    if(!actorId)throw new ForbiddenException({code:'ADMIN_PERSON_ID_REQUIRED'});
    const row=await this.db.formalApplicationDocument.findUnique({where:{formalApplicationDocumentId:documentId}});
    if(!row||row.status!=='PRESENT')throw new NotFoundException({code:'FORMAL_KYC_DOCUMENT_NOT_FOUND'});
    const updated=await this.db.formalApplicationDocument.update({where:{formalApplicationDocumentId:documentId},data:{malwareScanStatus:status,status:status==='INFECTED'?'REJECTED':'PRESENT',reviewedBy:actorId,reviewedAt:new Date()}});
    await this.db.$transaction(tx=>this.audit.write(tx,{actorType:'ADMIN',actorId,action:'FORMAL_KYC_DOCUMENT_SCAN_RECORDED',entityType:'FormalApplicationDocument',entityId:documentId,afterData:{scanStatus:status},requestId,correlationId:randomUUID()}));
    return {id:updated.formalApplicationDocumentId,status:updated.status,scanStatus:updated.malwareScanStatus};
  }
}
