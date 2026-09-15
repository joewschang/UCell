import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, capturedSideGpv, verifyReplayEnvelope, effectiveGpv, periodBinary, periodMatching, pending } from '@ucell/database';
export type CarryInput = { left: Prisma.Decimal; right: Prisma.Decimal };

export interface BinaryRecipientReplay {
  qualificationId:string;
  originalTheory:Prisma.Decimal;
  recomputedTheory:Prisma.Decimal;
  originalPayable:Prisma.Decimal;
  recomputedPayable:Prisma.Decimal;
  originalCarryOutLeft?:Prisma.Decimal;
  originalCarryOutRight?:Prisma.Decimal;
  recomputedCarryOutLeft?:Prisma.Decimal;
  recomputedCarryOutRight?:Prisma.Decimal;
}

export interface PeriodReplayResult {
  periodStart:Date;
  periodEnd:Date;
  originalK1:Prisma.Decimal;
  recomputedK1:Prisma.Decimal;
  originalK2?:Prisma.Decimal;
  recomputedK2?:Prisma.Decimal;
  binary:BinaryRecipientReplay[];
  matching:Array<{
    qualificationId:string;
    originalPayable:Prisma.Decimal;
    recomputedPayable:Prisma.Decimal;
  }>;
}

@Injectable()
export class SettlementReplayService {
  constructor(private readonly prisma:PrismaService){}
  async subtreeEconomicGpv(tx:Prisma.TransactionClient,root:string,side:'LEFT'|'RIGHT',start:Date,end:Date,ruleVersionCode='R1.0B'){
    return capturedSideGpv(tx,root,side,start,end,ruleVersionCode);
  }
  async replayPeriod(tx:Prisma.TransactionClient,input:{periodStart:Date;periodEnd:Date;ruleVersionCode:string;carryOverrides:Map<string,CarryInput>}):Promise<PeriodReplayResult>{
    const batch=await tx.settlementBatch.findFirst({where:{settlementType:'BINARY_K1',periodStart:input.periodStart,periodEnd:input.periodEnd,ruleVersionCode:input.ruleVersionCode,status:'FINALIZED'}});
    if(!batch) pending('HISTORICAL_SNAPSHOT_MISSING','Original finalized Binary settlement required');
    const envelope=verifyReplayEnvelope(await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'BINARY_K1',sourceId:batch.settlementBatchId}}}));
    const result=periodBinary(envelope,await effectiveGpv(tx,envelope.evidence.sources),input.carryOverrides);
    const binary=envelope.recipients.map(recipient=>{
      const carry=envelope.evidence.carryRecipients.find((item:any)=>item.qualificationId===recipient.qualificationId);
      const next=result.carryOut.get(recipient.qualificationId)!;
      return {qualificationId:recipient.qualificationId,originalTheory:new Prisma.Decimal(recipient.theory),recomputedTheory:result.k.gt(0)?result.payables.get(recipient.key)!.div(result.k):new Prisma.Decimal(0),originalPayable:new Prisma.Decimal(recipient.posted),recomputedPayable:result.payables.get(recipient.key)!,originalCarryOutLeft:new Prisma.Decimal(carry.leftCarryOut),originalCarryOutRight:new Prisma.Decimal(carry.rightCarryOut),recomputedCarryOutLeft:next.left,recomputedCarryOutRight:next.right};
    });
    const matchingBatch=await tx.settlementBatch.findFirst({where:{settlementType:'MATCHING_K2',periodStart:input.periodStart,periodEnd:input.periodEnd,ruleVersionCode:input.ruleVersionCode,status:'FINALIZED'}});
    if(!matchingBatch) return {periodStart:input.periodStart,periodEnd:input.periodEnd,originalK1:batch.kFactor,recomputedK1:result.k,binary,matching:[]};
    const matching=verifyReplayEnvelope(await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'MATCHING_K2',sourceId:matchingBatch.settlementBatchId}}}));
    const next=periodMatching(matching,result.payables,result.total);
    return {periodStart:input.periodStart,periodEnd:input.periodEnd,originalK1:batch.kFactor,recomputedK1:result.k,originalK2:matchingBatch.kFactor,recomputedK2:next.k,binary,matching:matching.recipients.map(recipient=>({qualificationId:recipient.qualificationId,originalPayable:new Prisma.Decimal(recipient.posted),recomputedPayable:next.payables.get(recipient.key)!}))};
  }
}
