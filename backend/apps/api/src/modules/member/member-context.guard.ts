import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Optional, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@ucell/database';
import { AuditService } from '../../common/audit/audit.service';
import { QualificationAccessService } from '../auth/qualification-access.service';
@Injectable()
export class MemberContextGuard implements CanActivate {
 constructor(private readonly access:QualificationAccessService,@Optional() private readonly prisma?:PrismaService,@Optional() private readonly audit?:AuditService){}
 private async denied(request:any,code:string){
  if(!this.prisma||!this.audit)return;
  try{await this.prisma.$transaction(tx=>this.audit!.write(tx,{actorType:'USER',action:'ACCESS_DENIED',eventCode:'ACCESS_DENIED',entityType:'MemberQualificationAuthorization',afterData:{path:String(request.url??'').split('?')[0],code},reasonCode:code,result:'DENIED',severity:'WARNING',requestId:request.requestId??randomUUID(),correlationId:request.correlationId??randomUUID()}));}catch{/* audit availability must not alter BOLA denial */}
 }
 async canActivate(context:ExecutionContext){
  const request=context.switchToHttp().getRequest(),path=request.url.split('?')[0];
  if(['/api/v1/member/me','/api/v1/member/qualifications','/api/v1/member/products','/api/v1/member/profile','/api/v1/member/delivery-profile','/api/v1/member/logout','/api/v1/member/organization/tree','/api/v1/member/retail-orders'].includes(path)||path.startsWith('/api/v1/member/contracts/')||(path==='/api/v1/member/orders'&&request.method==='POST'&&request.body?.packageVersionId))return true;
  const id=['POST','PATCH'].includes(request.method)?request.body?.qualificationId:request.query?.qualificationId;
  if(typeof id!=='string'||!id){await this.denied(request,'QUALIFICATION_CONTEXT_REQUIRED');throw new UnprocessableEntityException({code:'QUALIFICATION_CONTEXT_REQUIRED'});}
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){await this.denied(request,'QUALIFICATION_NOT_OWNED');throw new ForbiddenException({code:'QUALIFICATION_NOT_OWNED'});}
  try{await this.access.assertHolder(request.user.personId,id);}catch(error){if(error instanceof ForbiddenException){await this.denied(request,'QUALIFICATION_NOT_OWNED');throw new ForbiddenException({code:'QUALIFICATION_NOT_OWNED'});}throw error;}
  return true;
 }
}
