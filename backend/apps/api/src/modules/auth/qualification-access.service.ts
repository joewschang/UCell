import { ForbiddenException,Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

@Injectable()
export class QualificationAccessService{
  constructor(private readonly prisma:PrismaService){}
  async assertHolder(personId:string,qualificationId:string,at=new Date()){
    const h=await this.prisma.qualificationHolderHistory.findFirst({where:{
      qualificationId,effectiveFrom:{lte:at},
      OR:[
        {holderPersonId:personId},
        {holderLegalEntity:{
          representatives:{some:{
            personId,
            roleCode:'PRIMARY_OPERATING_REPRESENTATIVE',
            effectiveFrom:{lte:at},
            OR:[{effectiveTo:null},{effectiveTo:{gt:at}}],
          }}
        }}
      ],
      AND:[{OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]}]
    },select:{holderPersonId:true,holderLegalEntityId:true}});
    if(!h) throw new ForbiddenException('QUALIFICATION_ACCESS_DENIED');
    return {ownerType:h.holderLegalEntityId?'LEGAL_ENTITY' as const:'PERSON' as const,personId:h.holderPersonId,legalEntityId:h.holderLegalEntityId};
  }
}
