import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';

@Injectable()
export class QualificationStatusService {
  constructor(private readonly prisma:PrismaService){}

  async isEffectiveAt(
    qualificationId:string,
    at:Date,
    tx?:Prisma.TransactionClient,
  ){
    const db=tx ?? this.prisma;
    return !!await db.qualificationStatusHistory.findFirst({
      where:{
        qualificationId,
        status:'EFFECTIVE',
        effectiveFrom:{lte:at},
        OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]
      }
    });
  }

  async transition(
    tx:Prisma.TransactionClient,
    qualificationId:string,
    status:'EFFECTIVE'|'SUSPENDED'|'EXITED'|'TRANSFERRED'|'VOIDED'|'CLOSED',
    effectiveAt:Date,
    sourceType:string,
    sourceId?:string,
  ){
    const current=await tx.qualificationStatusHistory.findFirst({
      where:{qualificationId,effectiveTo:null},
      orderBy:{effectiveFrom:'desc'}
    });
    if(current){
      await tx.qualificationStatusHistory.update({
        where:{qualificationStatusHistoryId:current.qualificationStatusHistoryId},
        data:{effectiveTo:effectiveAt}
      });
    }
    return tx.qualificationStatusHistory.create({
      data:{qualificationId,status,effectiveFrom:effectiveAt,sourceType,sourceId}
    });
  }
}
