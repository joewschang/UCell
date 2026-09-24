import { ConflictException, Injectable, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';

type Actor = { actorId?: string; actorType: 'ADMIN'|'MEMBER'|'SYSTEM'; requestId: string };
const hash = (value:string) => createHash('sha256').update(value).digest('hex');

/** Account-takeover controls. It only changes identity/session state, never member economics. */
@Injectable()
export class AccountSecurityService {
  constructor(private readonly db:PrismaService,private readonly audit:AuditService,private readonly idempotency?:IdempotencyService){}

  async readPersonSecurity(personId:string){
    const person=await this.db.person.findUnique({where:{personId},select:{personId:true,memberNo:true,securityStatus:true,securityLockedAt:true,securityLockedReason:true,identityLinks:{where:{provider:'LINE'},select:{identityLinkId:true,providerSubject:true,status:true,createdAt:true,revokedAt:true,revokeReason:true,replacedByBindingId:true}},accountRecoveryRequests:{where:{type:'LINE_REBIND'},orderBy:{createdAt:'desc'},take:20,select:{accountRecoveryRequestId:true,type:true,status:true,createdAt:true,approvedAt:true,completedAt:true,rejectedAt:true,reasonCode:true}}}});
    if(!person) throw new NotFoundException({code:'PERSON_NOT_FOUND'});
    const timeline=await this.db.auditEvent.findMany({where:{OR:[{entityType:'Person',entityId:personId},{entityType:'AccountRecoveryRequest',afterData:{path:['personId'],equals:personId}}],action:{in:['PERSON_SECURITY_LOCKED','LINE_BINDING_REVOKED','LINE_REBIND_REQUESTED','LINE_REBIND_APPROVED','LINE_REBIND_COMPLETED']}},orderBy:{occurredAt:'desc'},take:50,select:{action:true,reasonCode:true,occurredAt:true}});
    return {...person,timeline};
  }

  async lockPerson(personId:string,reasonCode:string,actor:Actor){
    if(!reasonCode?.trim()) throw new UnprocessableEntityException({code:'SECURITY_LOCK_REASON_REQUIRED'});
    return this.db.$transaction(tx=>this.lockPersonTx(tx,personId,reasonCode,actor),{isolationLevel:'Serializable'});
  }

  async lockPersonCommand(personId:string,reasonCode:string,idempotencyKey:string,actor:Actor){
    if(!idempotencyKey?.trim()) throw new UnprocessableEntityException({code:'IDEMPOTENCY_KEY_REQUIRED'});
    if(!this.idempotency) throw new Error('IDEMPOTENCY_SERVICE_REQUIRED');
    return this.idempotency.execute(`admin:person-security:lock:${actor.actorId??'system'}`,idempotencyKey,{personId,reasonCode},tx=>this.lockPersonTx(tx,personId,reasonCode,actor));
  }

  private async lockPersonTx(tx:Prisma.TransactionClient,personId:string,reasonCode:string,actor:Actor){
    if(!reasonCode?.trim()) throw new UnprocessableEntityException({code:'SECURITY_LOCK_REASON_REQUIRED'});
    const before=await tx.person.findUnique({where:{personId}});
    if(!before) throw new NotFoundException({code:'PERSON_NOT_FOUND'});
    const now=new Date();
    const person=await tx.person.update({where:{personId},data:{securityStatus:'SECURITY_LOCKED',securityLockedAt:now,securityLockedReason:reasonCode}});
    const revoked=await tx.authSession.updateMany({where:{personId,provider:'LINE',status:'ACTIVE'},data:{status:'REVOKED',revokedAt:now}});
    await this.audit.write(tx,{...actor,action:'PERSON_SECURITY_LOCKED',entityType:'Person',entityId:personId,beforeData:{securityStatus:before.securityStatus},afterData:{securityStatus:person.securityStatus,revokedSessionCount:revoked.count},reasonCode,correlationId:randomUUID()});
    return {personId,securityStatus:person.securityStatus,revokedSessionCount:revoked.count};
  }

  async revokeLineBinding(personId:string,reasonCode:string,actor:Actor){
    if(!reasonCode?.trim()) throw new UnprocessableEntityException({code:'BINDING_REVOKE_REASON_REQUIRED'});
    return this.db.$transaction(tx=>this.revokeLineBindingTx(tx,personId,reasonCode,actor),{isolationLevel:'Serializable'});
  }

  async revokeLineBindingCommand(personId:string,reasonCode:string,idempotencyKey:string,actor:Actor){
    if(!idempotencyKey?.trim()) throw new UnprocessableEntityException({code:'IDEMPOTENCY_KEY_REQUIRED'});
    if(!this.idempotency) throw new Error('IDEMPOTENCY_SERVICE_REQUIRED');
    return this.idempotency.execute(`admin:person-security:revoke-line:${actor.actorId??'system'}`,idempotencyKey,{personId,reasonCode},tx=>this.revokeLineBindingTx(tx,personId,reasonCode,actor));
  }

  private async revokeLineBindingTx(tx:Prisma.TransactionClient,personId:string,reasonCode:string,actor:Actor){
    if(!reasonCode?.trim()) throw new UnprocessableEntityException({code:'BINDING_REVOKE_REASON_REQUIRED'});
    const now=new Date();
    const changed=await tx.identityLink.updateMany({where:{personId,provider:'LINE',status:'ACTIVE'},data:{status:'REVOKED',revokedAt:now,revokeReason:reasonCode}});
    await tx.authSession.updateMany({where:{personId,provider:'LINE',status:'ACTIVE'},data:{status:'REVOKED',revokedAt:now}});
    await this.audit.write(tx,{...actor,action:'LINE_BINDING_REVOKED',entityType:'Person',entityId:personId,afterData:{revokedBindingCount:changed.count},reasonCode,correlationId:randomUUID()});
    return {personId,revokedBindingCount:changed.count};
  }

  async createLineRebindRequest(personId:string,input:{verificationEvidence:unknown;idempotencyKey:string;reasonCode?:string},actor:Actor){
    if(!input.idempotencyKey?.trim()) throw new UnprocessableEntityException({code:'IDEMPOTENCY_KEY_REQUIRED'});
    return this.db.$transaction(async tx=>{
      const person=await tx.person.findUnique({where:{personId}});
      if(!person) throw new NotFoundException({code:'PERSON_NOT_FOUND'});
      const cooldown=new Date(Date.now()-24*60*60*1000);
      const prior=await tx.accountRecoveryRequest.findFirst({where:{personId,type:'LINE_REBIND',status:'COMPLETED',completedAt:{gt:cooldown}},orderBy:{completedAt:'desc'}});
      if(prior) throw new ConflictException({code:'LINE_REBIND_COOLDOWN_ACTIVE'});
      try {
        const request=await tx.accountRecoveryRequest.create({data:{personId,type:'LINE_REBIND',requesterActorId:actor.actorId,verificationEvidence:input.verificationEvidence as Prisma.InputJsonValue,reasonCode:input.reasonCode,idempotencyKey:input.idempotencyKey}});
        await this.audit.write(tx,{...actor,action:'LINE_REBIND_REQUESTED',entityType:'AccountRecoveryRequest',entityId:request.accountRecoveryRequestId,afterData:{personId,type:request.type,status:request.status},reasonCode:input.reasonCode,correlationId:randomUUID()});
        return request;
      } catch(error) {
        if((error as {code?:string}).code==='P2002') return tx.accountRecoveryRequest.findUniqueOrThrow({where:{idempotencyKey:input.idempotencyKey}});
        throw error;
      }
    },{isolationLevel:'Serializable'});
  }

  /** The caller must deliver the returned token through an approved out-of-band channel; it is never persisted raw. */
  async approveLineRebind(requestId:string,actor:Actor){
    if(!actor.actorId) throw new UnauthorizedException({code:'RECOVERY_APPROVER_REQUIRED'});
    return this.db.$transaction(async tx=>{
      const request=await tx.accountRecoveryRequest.findUnique({where:{accountRecoveryRequestId:requestId}});
      if(!request) throw new NotFoundException({code:'RECOVERY_REQUEST_NOT_FOUND'});
      if(request.type!=='LINE_REBIND'||request.status!=='PENDING') throw new ConflictException({code:'RECOVERY_REQUEST_NOT_PENDING'});
      if(request.requesterActorId===actor.actorId) throw new UnauthorizedException({code:'RECOVERY_DUAL_CONTROL_REQUIRED'});
      const completionToken=randomBytes(32).toString('base64url');
      const now=new Date();
      const approved=await tx.accountRecoveryRequest.update({where:{accountRecoveryRequestId:requestId},data:{status:'APPROVED',approverActorId:actor.actorId,approvedAt:now,completionTokenHash:hash(completionToken),completionTokenExpiresAt:new Date(now.getTime()+30*60*1000)}});
      await this.audit.write(tx,{...actor,action:'LINE_REBIND_APPROVED',entityType:'AccountRecoveryRequest',entityId:requestId,afterData:{status:approved.status},correlationId:randomUUID()});
      return {requestId,completionToken,expiresAt:approved.completionTokenExpiresAt!};
    },{isolationLevel:'Serializable'});
  }

  async completeLineRebind(input:{requestId:string;completionToken:string;newLineSubject:string;displayName?:string;email?:string},actor:Actor){
    if(!input.newLineSubject?.trim()||!input.completionToken) throw new UnprocessableEntityException({code:'LINE_REBIND_INPUT_REQUIRED'});
    return this.db.$transaction(async tx=>{
      const request=await tx.accountRecoveryRequest.findUnique({where:{accountRecoveryRequestId:input.requestId}});
      const now=new Date();
      if(!request||request.type!=='LINE_REBIND'||request.status!=='APPROVED'||!request.completionTokenHash||!request.completionTokenExpiresAt||request.completionTokenExpiresAt<=now||request.completionTokenUsedAt||request.completionTokenHash!==hash(input.completionToken)) throw new UnauthorizedException({code:'RECOVERY_COMPLETION_TOKEN_INVALID'});
      const person=await tx.person.findUnique({where:{personId:request.personId}});
      if(!person||person.securityStatus!=='SECURITY_LOCKED') throw new ConflictException({code:'PERSON_SECURITY_LOCK_REQUIRED'});
      const occupied=await tx.identityLink.findUnique({where:{provider_providerSubject:{provider:'LINE',providerSubject:input.newLineSubject}}});
      if(occupied&&occupied.personId!==request.personId) throw new ConflictException({code:'LINE_SUBJECT_ALREADY_BOUND'});
      const oldBindings=await tx.identityLink.findMany({where:{personId:request.personId,provider:'LINE',status:'ACTIVE'}});
      await tx.identityLink.updateMany({where:{personId:request.personId,provider:'LINE',status:'ACTIVE'},data:{status:'REVOKED',revokedAt:now,revokeReason:'LINE_REBIND'}});
      const binding=occupied
        ? await tx.identityLink.update({where:{identityLinkId:occupied.identityLinkId},data:{status:'ACTIVE',revokedAt:null,revokeReason:null,email:input.email,displayName:input.displayName}})
        : await tx.identityLink.create({data:{personId:request.personId,provider:'LINE',providerSubject:input.newLineSubject,email:input.email,displayName:input.displayName,status:'ACTIVE'}});
      const replaced=oldBindings.filter(row=>row.identityLinkId!==binding.identityLinkId).map(row=>row.identityLinkId);
      if(replaced.length) await tx.identityLink.updateMany({where:{identityLinkId:{in:replaced}},data:{replacedByBindingId:binding.identityLinkId}});
      await tx.authSession.updateMany({where:{personId:request.personId,provider:'LINE',status:'ACTIVE'},data:{status:'REVOKED',revokedAt:now}});
      await tx.accountRecoveryRequest.update({where:{accountRecoveryRequestId:request.accountRecoveryRequestId},data:{status:'COMPLETED',requestedProviderSubject:input.newLineSubject,completionTokenUsedAt:now,completedAt:now}});
      await tx.person.update({where:{personId:request.personId},data:{securityStatus:'NORMAL',securityLockedAt:null,securityLockedReason:null}});
      await this.audit.write(tx,{...actor,action:'LINE_REBIND_COMPLETED',entityType:'AccountRecoveryRequest',entityId:request.accountRecoveryRequestId,afterData:{personId:request.personId,newBindingId:binding.identityLinkId},correlationId:randomUUID()});
      return {personId:request.personId,bindingId:binding.identityLinkId,status:'COMPLETED' as const};
    },{isolationLevel:'Serializable'});
  }
}
