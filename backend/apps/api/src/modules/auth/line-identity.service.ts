import { Injectable,UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

@Injectable()
export class LineIdentityService{
  constructor(private readonly prisma:PrismaService){}
  async resolveVerifiedSubject(input:{lineSubject:string}){
    if(!input.lineSubject) throw new UnauthorizedException('LINE_SUBJECT_REQUIRED');
    return this.prisma.identityLink.findUnique({where:{provider_providerSubject:{provider:'LINE',providerSubject:input.lineSubject}}});
  }
}
