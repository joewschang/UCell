import { Injectable,UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

@Injectable()
export class LineIdentityService{
  constructor(private readonly prisma:PrismaService){}
  async resolveVerifiedSubject(input:{lineSubject:string}){
    if(!input.lineSubject) throw new UnauthorizedException('LINE_SUBJECT_REQUIRED');
    return this.prisma.identityLink.findFirst({where:{provider:'LINE',providerSubject:input.lineSubject,status:'ACTIVE'}});
  }
}
