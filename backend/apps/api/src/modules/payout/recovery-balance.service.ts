import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';

@Injectable()
export class RecoveryBalanceService {
  constructor(private readonly prisma:PrismaService){}

  async apply(tx:Prisma.TransactionClient,input:{qualificationId:string;payoutLineId:string;maxAmount:Prisma.Decimal}){
    let remaining=input.maxAmount;
    let applied=new Prisma.Decimal(0);
    const rows=await tx.bonusRecoveryEvent.findMany({
      where:{status:{in:['OPEN','OFFSETTING']},outstandingAmount:{gt:0},bonusAward:{recipientQualificationId:input.qualificationId}},
      orderBy:[{occurredAt:'asc'},{createdAt:'asc'}]
    });
    for(const r of rows){
      if(remaining.lte(0)) break;
      const use=Prisma.Decimal.min(remaining,r.outstandingAmount);
      await tx.recoveryApplication.create({data:{payoutLineId:input.payoutLineId,bonusRecoveryEventId:r.bonusRecoveryEventId,amount:use}});
      const recovered=r.recoveredAmount.add(use);
      const outstanding=r.outstandingAmount.sub(use);
      await tx.bonusRecoveryEvent.update({
        where:{bonusRecoveryEventId:r.bonusRecoveryEventId},
        data:{recoveredAmount:recovered,outstandingAmount:outstanding,status:outstanding.eq(0)?'RECOVERED':'OFFSETTING'}
      });
      applied=applied.add(use); remaining=remaining.sub(use);
    }
    return {applied,remaining};
  }
}
