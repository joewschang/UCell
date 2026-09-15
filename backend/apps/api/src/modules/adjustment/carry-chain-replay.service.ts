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
            bonusAwardId:anchor.bonusAwardId,recoveryAmount:delta.abs(),status:'OPEN',
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
      const periodStart=new Date(eventAt);
      periodStart.setUTCHours(0,0,0,0);
      periodStart.setUTCDate(periodStart.getUTCDate()-periodStart.getUTCDay());
      const periodEnd=new Date(periodStart.getTime()+7*86400000);

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
      }else if(run.status==='CONVERGED' || run.status==='MAX_HORIZON'){
        return run;
      }else{
        await tx.settlementReplayRun.update({
          where:{settlementReplayRunId:run.settlementReplayRunId},data:{status:'RUNNING'}
        });
      }

      let impacted=await this.binaryAncestorsAt(tx,ret.order.qualificationId,eventAt);
      // Returned qualification itself can also have a binary award if it has children, but own purchase
      // is not in its own subtree. Therefore only ancestors are volume-impacted.
      let carryOverrides=new Map<string,CarryInput>();
      for(const qid of impacted){
        const carry=await tx.binaryCarry.findFirst({
          where:{qualificationId:qid,periodEnd,ruleVersionCode}
        });
        if(carry) carryOverrides.set(qid,{left:carry.leftCarryIn,right:carry.rightCarryIn});
      }

      let currentStart=periodStart,currentEnd=periodEnd;
      let processed=0;
      let converged=false;

      while(processed<maxWeeks && carryOverrides.size>0){
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
        currentStart=currentEnd;
        currentEnd=new Date(currentEnd.getTime()+7*86400000);

        // Keep only qualifications that actually have a finalized carry snapshot in the next period.
        const filtered=new Map<string,CarryInput>();
        for(const [qid,ci] of nextCarry){
          const next=await tx.binaryCarry.findFirst({
            where:{qualificationId:qid,periodEnd:currentEnd,ruleVersionCode}
          });
          if(next) filtered.set(qid,ci);
        }
        carryOverrides=filtered;
        if(carryOverrides.size===0) converged=true;
      }

      // Mark sibling recalculation requests for same return as processed.
      await tx.settlementRecalculationRequest.updateMany({
        where:{sourceReturnCaseId:returnCaseId,status:'PENDING'},
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
