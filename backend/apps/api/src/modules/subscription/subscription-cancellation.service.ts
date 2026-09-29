import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { createHash,randomUUID } from 'crypto';

@Injectable()
export class SubscriptionCancellationService {
  constructor(private readonly prisma:PrismaService){}

  async cancel(subscriptionId:string,effectiveAt:Date,reasonCode:string,refundAmount='0',input:{sourceReturnCaseId?:string;idempotencyKey?:string}={}){
    let refund:Prisma.Decimal;
    try{refund=new Prisma.Decimal(refundAmount);}catch{throw new UnprocessableEntityException({code:'SUBSCRIPTION_CANCELLATION_INVALID'});}
    if(!Number.isFinite(effectiveAt.getTime())||!reasonCode?.trim()||!refund.isFinite()||refund.lt(0))throw new UnprocessableEntityException({code:'SUBSCRIPTION_CANCELLATION_INVALID'});
    if(input.idempotencyKey!==undefined&&(typeof input.idempotencyKey!=='string'||input.idempotencyKey.length<8))throw new UnprocessableEntityException({code:'SUBSCRIPTION_CANCELLATION_KEY_INVALID'});
    // Legacy callers need no new mandatory field. Canonical request identity
    // supplies retry safety while ReturnCase remains the partial-return key.
    const idempotencyKey=input.idempotencyKey??'legacy-cancel:'+createHash('sha256').update(JSON.stringify([subscriptionId,effectiveAt.toISOString(),reasonCode,refund.toString(),input.sourceReturnCaseId??null])).digest('hex');
    const lookup=async(client:Pick<Prisma.TransactionClient,'subscriptionCancellation'>)=>{
      const keyed=await client.subscriptionCancellation.findFirst({where:{idempotencyKey}});
      const sourced=input.sourceReturnCaseId?await client.subscriptionCancellation.findFirst({where:{sourceReturnCaseId:input.sourceReturnCaseId}}):null;
      const legacy=!input.idempotencyKey&&!input.sourceReturnCaseId?await client.subscriptionCancellation.findFirst({where:{subscriptionId,effectiveAt,reasonCode,refundAmount:refund,sourceReturnCaseId:null},orderBy:{createdAt:'asc'}}):null;
      const matches=[keyed,sourced,legacy].filter((row):row is NonNullable<typeof row>=>row!==null);
      for(const row of matches)if(row.subscriptionId!==subscriptionId||row.effectiveAt.getTime()!==effectiveAt.getTime()||row.reasonCode!==reasonCode||!row.refundAmount.eq(refund)||(row.sourceReturnCaseId??null)!==(input.sourceReturnCaseId??null))throw new ConflictException({code:'SUBSCRIPTION_CANCELLATION_IDEMPOTENCY_CONFLICT'});
      if(new Set(matches.map(row=>row.subscriptionCancellationId)).size>1)throw new ConflictException({code:'SUBSCRIPTION_CANCELLATION_IDEMPOTENCY_CONFLICT'});
      return matches[0]??null;
    };
    try{return await this.prisma.$transaction(async tx=>{
      // Serialize refunds against the same subscription before reading totals
      // or schedules, including requests with different idempotency keys.
      await tx.$queryRaw`SELECT subscription_id FROM subscription.subscription WHERE subscription_id = ${subscriptionId}::uuid FOR UPDATE`;
      const existing=await lookup(tx);
      if(existing) return {
        cancellation:existing,
        cancelledFutureCount:0,
        queuedRpvReversalCount:0,
        replayed:true
      };
      const sub=await tx.subscription.findUniqueOrThrow({
        where:{subscriptionId},include:{schedules:true,plan:true}
      });
      if(sub.status==='CANCELLED')throw new ConflictException({code:'SUBSCRIPTION_ALREADY_CANCELLED'});
      let sourceReturn:any=null;
      if(input.sourceReturnCaseId){
        sourceReturn=await tx.returnCase.findUnique({where:{returnCaseId:input.sourceReturnCaseId},include:{lines:true}});
        if(!sourceReturn||sourceReturn.status!=='POSTED'||sourceReturn.orderId!==sub.orderId) throw new ConflictException({code:'SUBSCRIPTION_CANCELLATION_RETURN_SOURCE_INVALID'});
      }
      // Legacy full-return commands carried no amount.  A non-zero amount is
      // therefore required before the partial-return path is selected.
      const full=reasonCode==='FULL_RETURN'||refund.eq(0);
      if(!full&&(!input.sourceReturnCaseId||refund.lte(0)||refund.gte(sub.plan.prepaidAmount))) throw new ConflictException({code:'SUBSCRIPTION_PARTIAL_RETURN_INVALID'});
      if(sourceReturn){
        const sourceAmount=sourceReturn.lines.reduce((total:any,line:any)=>total.add(line.returnAmount),new Prisma.Decimal(0));
        if(!sourceAmount.eq(refund)) throw new ConflictException({code:'SUBSCRIPTION_CANCELLATION_REFUND_AMOUNT_MISMATCH'});
      }
      const correlationId=randomUUID();

      const fact=await tx.subscriptionCancellation.create({
        data:{
          subscriptionId,requestedAt:new Date(),effectiveAt,reasonCode,
          refundAmount:refund,sourceReturnCaseId:input.sourceReturnCaseId,idempotencyKey,correlationId,status:'POSTED'
        }
      });

      if(full) await tx.monthlyRecognitionSchedule.updateMany({
        where:{
          subscriptionId,
          dueAt:{gte:effectiveAt},
          status:{in:['SCHEDULED','DUE']}
        },
        data:{status:'CANCELLED'}
      });
      if(!full){
        const prior=await tx.subscriptionCancellation.aggregate({where:{subscriptionId,status:'POSTED'},_sum:{refundAmount:true}});
        // The aggregate already includes the fact created in this transaction.
        const remaining=sub.plan.prepaidAmount.sub(prior._sum.refundAmount??new Prisma.Decimal(0)).add(refund);
        if(remaining.lte(0)||refund.gt(remaining)) throw new ConflictException({code:'SUBSCRIPTION_RETURN_AMOUNT_EXCEEDED'});
        const rows=sub.schedules.filter(row=>['SCHEDULED','DUE'].includes(row.status)&&row.dueAt>=effectiveAt).sort((a,b)=>a.installmentNo-b.installmentNo);
        if(rows.some(row=>row.retainedEntitlementRatio==null)){
          const earlier=await tx.subscriptionCancellation.count({where:{subscriptionId,status:'POSTED',subscriptionCancellationId:{not:fact.subscriptionCancellationId},refundAmount:{gt:0},reasonCode:{not:'FULL_RETURN'}}});
          if(earlier) throw new ConflictException({code:'SUBSCRIPTION_REFUND_BASIS_MISSING'});
        }
        const futureTotal=rows.reduce((total,row)=>total.add(row.recognizedAmount),new Prisma.Decimal(0));
        const target=futureTotal.mul(remaining.sub(refund)).div(remaining).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
        const rpvTotal=rows.reduce((total,row)=>total.add(row.rpvAmount),new Prisma.Decimal(0));
        const rpvTarget=rpvTotal.mul(remaining.sub(refund)).div(remaining).toDecimalPlaces(4,Prisma.Decimal.ROUND_HALF_UP);
        let allocated=new Prisma.Decimal(0);
        let allocatedRpv=new Prisma.Decimal(0);
        for(const [index,row] of rows.entries()){
          const recognizedAmount=index===rows.length-1?target.sub(allocated):row.recognizedAmount.mul(remaining.sub(refund)).div(remaining).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
          allocated=allocated.add(recognizedAmount);
          const rpvAmount=index===rows.length-1?rpvTarget.sub(allocatedRpv):row.rpvAmount.mul(remaining.sub(refund)).div(remaining).toDecimalPlaces(4,Prisma.Decimal.ROUND_HALF_UP);
          allocatedRpv=allocatedRpv.add(rpvAmount);
          const retainedEntitlementRatio=(row.retainedEntitlementRatio??new Prisma.Decimal(1)).mul(remaining.sub(refund)).div(remaining);
          await tx.monthlyRecognitionSchedule.update({where:{recognitionId:row.recognitionId},data:{recognizedAmount,rpvAmount,retainedEntitlementRatio,...(retainedEntitlementRatio.eq(0)?{status:'CANCELLED' as const}:{})}});
        }
      }

      const recognized=await tx.monthlyRecognitionSchedule.findMany({
        where:{
          subscriptionId,
          status:'RECOGNIZED'
        }
      });

      for(const r of recognized){
        await tx.outboxEvent.create({
          data:{
            eventType:'RPV_REVERSAL_REQUIRED',
            aggregateType:'MONTHLY_RECOGNITION',
            aggregateId:r.recognitionId,
            payload:{
              subscriptionCancellationId:fact.subscriptionCancellationId,
              subscriptionId,recognitionId:r.recognitionId,
              reasonCode,ruleVersionCode:sub.ruleVersionCode
            },
            processStatus:'PENDING',availableAt:new Date(),correlationId
          }
        });
      }

      if(full) await tx.subscription.update({where:{subscriptionId},data:{status:'CANCELLED',cancelledAt:effectiveAt}});

      return {
        cancellation:fact,
        cancelledFutureCount:sub.schedules.filter(s=>s.status==='SCHEDULED' && s.dueAt>=effectiveAt).length,
        queuedRpvReversalCount:recognized.length,
        replayed:false
      };
    });}catch(error){
      // Concurrent retries race only on the append-only natural key.  Re-read
      // the committed fact; no existing cancellation or recovery event is
      // mutated to make the retry succeed.
      if((error as any)?.code!=='P2002') throw error;
      const existing=await lookup(this.prisma);
      if(!existing) throw error;
      return {cancellation:existing,cancelledFutureCount:0,queuedRpvReversalCount:0,replayed:true};
    }
  }
}
