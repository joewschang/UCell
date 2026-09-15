import { ForbiddenException,Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
@Injectable()
export class QualificationAccessService{
  constructor(private readonly prisma:PrismaService){}
  async assertHolder(personId:string,qualificationId:string,at=new Date()){
    const h=await this.prisma.qualificationHolderHistory.findFirst({where:{
      qualificationId,holderPersonId:personId,effectiveFrom:{lte:at},
      OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]
    }});
    if(!h) throw new ForbiddenException('QUALIFICATION_ACCESS_DENIED');
  }
}
