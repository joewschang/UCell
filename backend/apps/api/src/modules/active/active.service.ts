import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { randomUUID } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class ActiveService {
  constructor(private readonly prisma:PrismaService,private readonly audit:AuditService){}

  async isActiveAt(qualificationId:string,at:Date){
    const row=await this.prisma.activePeriod.findFirst({
      where:{
        qualificationId,
        activeFrom:{lte:at},
        OR:[{activeTo:null},{activeTo:{gt:at}}]
      },
      orderBy:{activeFrom:'desc'}
    });
    return !!row;
  }

  async openPeriod(
    qualificationId:string,
    input:{activeFrom:string;activeTo?:string;sourceType:string;ruleVersionCode?:string},
    requestId:string,
    actorId?:string,
  ){
    const activeFrom=new Date(input.activeFrom);
    const activeTo=input.activeTo?new Date(input.activeTo):undefined;
    const correlationId=randomUUID();

    return this.prisma.$transaction(async tx=>{
      const q=await tx.qualification.findUnique({where:{qualificationId}});
      if(!q) throw new ConflictException({code:'RESOURCE_NOT_FOUND',message:'Qualification不存在。'});

      const overlap=await tx.activePeriod.findFirst({
        where:{
          qualificationId,
          activeFrom:{lt:activeTo ?? new Date('9999-12-31T00:00:00Z')},
          OR:[{activeTo:null},{activeTo:{gt:activeFrom}}]
        }
      });
      if(overlap) throw new ConflictException({code:'ACTIVE_PERIOD_OVERLAP',message:'Active期間不可重疊。'});

      const period=await tx.activePeriod.create({
        data:{
          qualificationId,
          activeFrom,
          activeTo,
          sourceType:input.sourceType,
          ruleVersionCode:input.ruleVersionCode ?? 'R1.0B'
        }
      });

      await tx.qualification.update({
        where:{qualificationId},
        data:{activeFlag:activeTo?activeTo>new Date():true}
      });

      await this.audit.write(tx,{
        actorType:actorId?'USER':'SYSTEM',actorId,
        action:'ACTIVE_PERIOD_OPENED',
        entityType:'QUALIFICATION',entityId:qualificationId,
        afterData:period,requestId,correlationId
      });
      return period;
    });
  }
}
