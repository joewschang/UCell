import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { CarryChainReplayService } from './carry-chain-replay.service';

@Injectable()
export class SettlementAdjustmentService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly replay:CarryChainReplayService
  ){}

  async prepare(requestId:string){
    return this.prisma.$transaction(async tx=>{
      const req=await tx.settlementRecalculationRequest.findUnique({
        where:{settlementRecalculationRequestId:requestId}
      });
      if(!req) throw new UnprocessableEntityException('Recalculation request not found');

      const existing=await tx.settlementAdjustmentBatch.findUnique({
        where:{sourceRecalculationRequestId:requestId}
      });
      if(existing) return existing;

      return tx.settlementAdjustmentBatch.create({
        data:{
          sourceRecalculationRequestId:requestId,
          settlementType:req.settlementType,
          periodStart:req.periodStart,periodEnd:req.periodEnd,
          status:'DRAFT',
          calculationSnapshot:{
            rule:'R1.0B-FROZEN',
            method:'DETERMINISTIC_REPLAY',
            invariant:'NO_HISTORICAL_SETTLEMENT_MUTATION'
          }
        }
      });
    });
  }

  async calculateAndPost(requestId:string,ruleVersionCode='R1.0B'){
    const request=await this.prisma.settlementRecalculationRequest.findUniqueOrThrow({where:{settlementRecalculationRequestId:requestId}});
    if(!request.sourceReturnCaseId) throw new UnprocessableEntityException({code:'REPLAY_SOURCE_PENDING',message:'Source return required for dependency-wide replay'});
    // Return-scoped atomic replay replaces obsolete single-recipient posting.
    // Return replay run/period evidence; never fabricate a POSTED adjustment batch.
    return this.replay.runForReturn(request.sourceReturnCaseId,26,ruleVersionCode);
  }
}
