import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { QualificationAccessService } from '../auth/qualification-access.service';
@Injectable()
export class MemberContextGuard implements CanActivate {
 constructor(private readonly access:QualificationAccessService){}
 async canActivate(context:ExecutionContext){
  const request=context.switchToHttp().getRequest(),path=request.url.split('?')[0];
  if(['/api/v1/member/me','/api/v1/member/qualifications','/api/v1/member/products','/api/v1/member/profile','/api/v1/member/delivery-profile','/api/v1/member/logout'].includes(path)||path.startsWith('/api/v1/member/contracts/'))return true;
  const id=['POST','PATCH'].includes(request.method)?request.body?.qualificationId:request.query?.qualificationId;
  if(typeof id!=='string'||!id)throw new UnprocessableEntityException({code:'QUALIFICATION_CONTEXT_REQUIRED'});
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new ForbiddenException({code:'QUALIFICATION_NOT_OWNED'});
  try{await this.access.assertHolder(request.user.personId,id);}catch(error){if(error instanceof ForbiddenException)throw new ForbiddenException({code:'QUALIFICATION_NOT_OWNED'});throw error;}
  return true;
 }
}
