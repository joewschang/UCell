import { pending, verifySnapshot } from '../rules/parameter-snapshot';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { SettlementReplayService, CarryInput, PeriodReplayResult } from './settlement-replay.service';

function d0(){ return new Prisma.Decimal(0); }
function changed(a:Prisma.Decimal,b:Prisma.Decimal){ return !a.eq(b); }

@Injectable()
export class CarryChainReplayService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly replay:SettlementReplayService
  ){}

  async binaryAncestorsAt(
    tx:Prisma.TransactionClient,qualificationId:string,at:Date
  ):Promise<string[]>{
    const rows=await tx.$queryRaw<Array<{qualification_id:string}>>`
      WITH RECURSIVE up AS (
        SELECT bp.parent_qualification_id AS qualification_id
        FROM organization.binary_placement bp
        WHERE bp.child_qualification_id=${qualificationId}::uuid
          AND bp.effective_from <= ${at}
          AND (bp.effective_to IS NULL OR bp.effective_to > ${at})
        UNION ALL
        SELECT bp.parent_qualification_id
        FROM organization.binary_placement bp
        JOIN up ON bp.child_qualification_id=up.qualification_id
        WHERE bp.effective_from <= ${at}
          AND (bp.effective_to IS NULL OR bp.effective_to > ${at})
      )
      SELECT DISTINCT qualification_id::text FROM up
    `;
    return rows.map(r=>r.qualification_id);
  }

  private async postDeltas(
    tx:Prisma.TransactionClient,
    replayPeriodId:string,
    result:PeriodReplayResult,
    ruleVersionCode:string
  ){
    const aggregate=new Map<string,{type:'BINARY'|'MATCHING';qid:string;original:Prisma.Decimal;recomputed:Prisma.Decimal}>();

    for(const x of result.binary){
      if(x.originalPayable.eq(x.recomputedPayable)) continue;
      aggregate.set(`BINARY:${x.qualificationId}`,{
        type:'BINARY',qid:x.qualificationId,original:x.originalPayable,recomputed:x.recomputedPayable
      });
    }
    // Multiple matching source awards can map to same recipient; aggregate recipient delta.
    for(const x of result.matching){
      const key=`MATCHING:${x.qualificationId}`;
      const old=aggregate.get(key);
      if(old){
        old.original=old.original.add(x.originalPayable);
        old.recomputed=old.recomputed.add(x.recomputedPayable);
      }else{
        aggregate.set(key,{type:'MATCHING',qid:x.qualificationId,original:x.originalPayable,recomputed:x.recomputedPayable});
      }
    }

    for(const row of aggregate.values()){
      const delta=row.recomputed.sub(row.original);
      if(delta.eq(0)) continue;
      if(delta.gt(0)){
        const award=await tx.bonusAward.create({
          data:{
            awardType:row.type,
            recipientQualificationId:row.qid,
            sourceEventId:replayPeriodId,
            theoryAmount:delta,kFactor:new Prisma.Decimal(1),payableAmount:delta,
            activeSnapshot:true,ruleVersionCode,
            occurredAt:new Date(),pendingUntil:new Date(),
            calculationDetail:{
              subtype:'CARRY_CHAIN_SETTLEMENT_ADJUSTMENT',
              replayPeriodId,
              originalPayable:row.original.toString(),
              recomputedPayable:row.recomputed.toString()
            }
          }
        });
        await tx.bonusAwardLifecycleEvent.create({
          data:{bonusAwardId:award.bonusAwardId,status:'EFFECTIVE',occurredAt:new Date(),reasonCode:'CARRY_CHAIN_ADJUSTMENT'}
        });
      }else{
        const anchor=await tx.bonusAward.create({
          data:{
            awardType:row.type,recipientQualificationId:row.qid,sourceEventId:replayPeriodId,
            theoryAmount:d0(),kFactor:new Prisma.Decimal(1),payableAmount:d0(),
            activeSnapshot:true,ruleVersionCode,occurredAt:new Date(),pendingUntil:new Date(),
            calculationDetail:{subtype:'CARRY_CHAIN_NEGATIVE_ADJUSTMENT_ANCHOR',replayPeriodId}
          }
        });
        await tx.bonusRecoveryEvent.create({
          data:{
            bonusAwardId:anchor.bonusAwardId,recoveryAmount:delta.abs(),outstandingAmount:delta.abs(),status:'OPEN',
            reasonCode:'CARRY_CHAIN_ADJUSTMENT',occurredAt:new Date()
          }
        });
      }
    }
  }

  async runForReturn(returnCaseId:string,maxWeeks=26,ruleVersionCode='R1.0B'){
    return this.prisma.$transaction(async tx=>{
      const ret=await tx.returnCase.findUnique({
        where:{returnCaseId},include:{order:true,lines:true}
      });
      if(!ret || ret.status!=='POSTED') throw new Error('POSTED return required');

      // Economic starting period is derived from original GPV events, not refund posting date.
      const originals=await tx.pvLedger.findMany({
        where:{
          sourceType:'ORDER',sourceId:ret.orderId,pvType:'GPV',eventType:'GPV_CREATED'
        },
        orderBy:{occurredAt:'asc'}
      });
      if(originals.length===0) return {skipped:'NO_ORIGINAL_GPV'};

      const eventAt=originals[0].occurredAt;
      if(!Number.isInteger(maxWeeks)||maxWeeks<1||maxWeeks>260) pending('INVALID_REPLAY_HORIZON','Replay horizon must be integer 1..260');
      const historical=await tx.settlementBatch.findFirst({where:{settlementType:'BINARY_K1',status:'FINALIZED',ruleVersionCode,periodStart:{lte:eventAt},periodEnd:{gt:eventAt}}});
      if(!historical) pending('HISTORICAL_SETTLEMENT_MISSING','No finalized historical period contains original sale; no weekday assumed');
      verifySnapshot(historical.parameterSnapshot);
      const periodStart=historical.periodStart,periodEnd=historical.periodEnd;
      const k0=await tx.settlementBatch.findFirst({where:{settlementType:'REFERRAL_K0',status:'FINALIZED',periodStart:{lte:eventAt},periodEnd:{gt:eventAt},ruleVersionCode}});
      if(k0) pending('K0_REPLAY_IMPLEMENTATION_PENDING','K0 dependency replay is not implemented; block before posting K1/K2 deltas');

      const priorRun=await tx.settlementReplayRun.findFirst({where:{sourceReturnCaseId:{not:returnCaseId},initialPeriodEnd:periodEnd}});
      if(priorRun) pending('REPLAY_EFFECTIVE_BASELINE_PENDING','Another return already replayed this period; reconcile prior append-only deltas before posting again');
      let run=await tx.settlementReplayRun.findUnique({where:{sourceReturnCaseId:returnCaseId}});
      if(!run){
        run=await tx.settlementReplayRun.create({
          data:{
            sourceReturnCaseId:returnCaseId,initialPeriodStart:periodStart,initialPeriodEnd:periodEnd,
            ruleVersionCode,status:'RUNNING',maxWeeks,
            calculationSnapshot:{
              rule:'R1.0B-FROZEN',
              method:'PERIOD_WIDE_K1_K2_WITH_CARRY_CHAIN',
              economicAttribution:'ORIGINAL_EVENT_PERIOD_PLUS_LINKED_REVERSALS'
            }
          }
        });
      }else if(run.status==='CONVERGED'){
        return run;
      }else{
        pending('REPLAY_CONTINUATION_PENDING','Incomplete run requires reviewed continuation; no double-post');

      }

      let impacted=await this.binaryAncestorsAt(tx,ret.order.qualificationId,eventAt);
      // Returned qualification itself can also have a binary award if it has children, but own purchase
      // is not in its own subtree. Therefore only ancestors are volume-impacted.
      let carryOverrides=new Map<string,CarryInput>();
      for(const qid of impacted){
        const carry=await tx.binaryCarry.findFirst({
          where:{qualificationId:qid,periodEnd,ruleVersionCode}
        });
        if(!carry) pending('HISTORICAL_CARRY_MISSING','Ancestor missing original carry snapshot');
        carryOverrides.set(qid,{left:carry.leftCarryIn,right:carry.rightCarryIn});
      }

      let currentStart=periodStart,currentEnd=periodEnd;
      let processed=0;
      let converged=false;

      while(processed<maxWeeks && (processed===0 || carryOverrides.size>0)){
        const existingPeriod=await tx.settlementReplayPeriod.findUnique({
          where:{
            settlementReplayRunId_periodEnd:{
              settlementReplayRunId:run.settlementReplayRunId,periodEnd:currentEnd
            }
          }
        });
        if(existingPeriod){
          // Resume safety: stop rather than double-post immutable deltas.
          break;
        }

        const result=await this.replay.replayPeriod(tx,{
          periodStart:currentStart,periodEnd:currentEnd,ruleVersionCode,carryOverrides
        });

        const nextCarry=new Map<string,CarryInput>();
        const carrySnapshot:any={};
        for(const x of result.binary){
          if(x.recomputedCarryOutLeft===undefined || x.recomputedCarryOutRight===undefined) continue;
          const ol=x.originalCarryOutLeft!, or=x.originalCarryOutRight!;
          const nl=x.recomputedCarryOutLeft, nr=x.recomputedCarryOutRight;
          carrySnapshot[x.qualificationId]={
            original:{left:ol.toString(),right:or.toString()},
            recomputed:{left:nl.toString(),right:nr.toString()},
            delta:{left:nl.sub(ol).toString(),right:nr.sub(or).toString()}
          };
          if(changed(ol,nl) || changed(or,nr)){
            nextCarry.set(x.qualificationId,{left:nl,right:nr});
          }
        }

        const awardDeltaSnapshot={
          binary:result.binary.filter(x=>!x.originalPayable.eq(x.recomputedPayable)).map(x=>({
            qualificationId:x.qualificationId,
            original:x.originalPayable.toString(),recomputed:x.recomputedPayable.toString(),
            delta:x.recomputedPayable.sub(x.originalPayable).toString()
          })),
          matching:result.matching.filter(x=>!x.originalPayable.eq(x.recomputedPayable)).map(x=>({
            qualificationId:x.qualificationId,
            original:x.originalPayable.toString(),recomputed:x.recomputedPayable.toString(),
            delta:x.recomputedPayable.sub(x.originalPayable).toString()
          }))
        };

        const periodRow=await tx.settlementReplayPeriod.create({
          data:{
            settlementReplayRunId:run.settlementReplayRunId,periodNo:processed+1,
            periodStart:currentStart,periodEnd:currentEnd,
            originalK1:result.originalK1,recomputedK1:result.recomputedK1,
            originalK2:result.originalK2,recomputedK2:result.recomputedK2,
            impactedQualifications:Array.from(carryOverrides.keys()),
            carryDeltaSnapshot:carrySnapshot,
            awardDeltaSnapshot
          }
        });

        await this.postDeltas(tx,periodRow.settlementReplayPeriodId,result,ruleVersionCode);
        processed++;

        if(nextCarry.size===0){
          converged=true;
          break;
        }

        // Advance exactly one historical Binary period; only qualifications whose carry differs propagate.
        const nextPeriod=await tx.settlementBatch.findFirst({where:{settlementType:'BINARY_K1',status:'FINALIZED',ruleVersionCode,periodStart:currentEnd},orderBy:{periodEnd:'asc'}});
        if(!nextPeriod) pending('CARRY_CONTINUATION_PENDING','Carry not converged; contiguous finalized historical period missing');
        verifySnapshot(nextPeriod.parameterSnapshot);
        currentStart=nextPeriod.periodStart;currentEnd=nextPeriod.periodEnd;

        // Keep only qualifications that actually have a finalized carry snapshot in the next period.
        const filtered=new Map<string,CarryInput>();
        for(const [qid,ci] of nextCarry){
          const next=await tx.binaryCarry.findFirst({
            where:{qualificationId:qid,periodEnd:currentEnd,ruleVersionCode}
          });
          if(!next) pending('HISTORICAL_CARRY_MISSING','Affected qualification missing next historical carry');
          filtered.set(qid,ci);
        }
        carryOverrides=filtered;
        if(carryOverrides.size===0) converged=true;
      }

      if(!converged && carryOverrides.size>0) pending('REPLAY_HORIZON_EXHAUSTED','Carry unresolved; rollback rather than mark complete');
      // Mark only replayed dependencies.
      await tx.settlementRecalculationRequest.updateMany({
        where:{sourceReturnCaseId:returnCaseId,status:'PENDING',settlementType:{in:['BINARY_K1','MATCHING_K2']}},
        data:{status:'PROCESSED',processedAt:new Date()}
      });

      return tx.settlementReplayRun.update({
        where:{settlementReplayRunId:run.settlementReplayRunId},
        data:{
          processedWeeks:{increment:processed},
          status:converged?'CONVERGED':'MAX_HORIZON',
          convergedAt:converged?new Date():undefined
        }
      });
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:60000});
  }
}
