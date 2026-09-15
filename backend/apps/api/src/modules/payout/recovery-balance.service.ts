import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, pending } from '@ucell/database';

@Injectable()
export class RecoveryBalanceService {
  constructor(private readonly prisma:PrismaService){}

  async apply(tx:Prisma.TransactionClient,input:{qualificationId:string;payoutLineId:string;maxAmount:Prisma.Decimal}){
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.payoutLineId},0))`;
    const line=await tx.payoutLine.findUnique({where:{payoutLineId:input.payoutLineId}});
    if(!line||line.recipientQualificationId!==input.qualificationId||!line.grossAmount.eq(input.maxAmount)||input.maxAmount.lt(0))
      pending('RECOVERY_OFFSET_INPUT_MISMATCH','Offset must use the original payout line recipient and gross amount');
    const previous=await tx.recoveryApplication.aggregate({where:{payoutLineId:input.payoutLineId},_sum:{amount:true}});
    if(previous._sum.amount!=null){
      if(previous._sum.amount.gt(input.maxAmount)) pending('RECOVERY_OFFSET_BASELINE_CORRUPT','Recorded offset exceeds original payout capacity');
      return {applied:previous._sum.amount,remaining:input.maxAmount.sub(previous._sum.amount)};
    }
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
