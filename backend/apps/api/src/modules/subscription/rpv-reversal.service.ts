import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, replayRpvCancellation, pending } from '@ucell/database';

@Injectable()
export class RpvReversalService {
  constructor(private readonly prisma:PrismaService){}
  async reverseRecognition(recognitionId:string, correlationId:string){
    return this.prisma.$transaction(async tx=>{
      const schedule=await tx.monthlyRecognitionSchedule.findUnique({where:{recognitionId}});
      if(!schedule) pending('HISTORICAL_SNAPSHOT_MISSING','Original recognition schedule is missing');
      const cancellations=await tx.subscriptionCancellation.findMany({where:{subscriptionId:schedule.subscriptionId,status:'POSTED',effectiveAt:{lte:schedule.dueAt}},orderBy:{effectiveAt:'asc'}});
      if(!cancellations.length) pending('HISTORICAL_SNAPSHOT_MISSING','Explicit historical cancellation evidence is required');
      const cancellationId=cancellations[0].subscriptionCancellationId;
      return replayRpvCancellation(tx,recognitionId,cancellationId,'RPV:'+recognitionId+':'+cancellationId,correlationId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:60000});
  }
}
