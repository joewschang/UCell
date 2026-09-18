import {effectiveSponsorDirectCount} from '@ucell/database';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, sealRpvEvent, companyAlwaysActiveAt, captureParameters } from '@ucell/database';
import { randomUUID } from 'crypto';
import { ActiveService } from '../active/active.service';

@Injectable()
export class RpvService {
  constructor(private readonly prisma:PrismaService,private readonly active:ActiveService){}

  unlockedDepth(effectiveDirectCount:number){
    if(effectiveDirectCount<=0) return 5;
    if(effectiveDirectCount===1) return 8;
    return 12;
  }

  async effectiveDirectCountAt(tx:Prisma.TransactionClient,sponsorQualificationId:string,at:Date){return effectiveSponsorDirectCount(tx,sponsorQualificationId,at);}

  async recognize(recognitionId:string){
    const correlationId=randomUUID();
    return this.prisma.$transaction(async tx=>{
      const schedule=await tx.monthlyRecognitionSchedule.findUnique({
        where:{recognitionId},
        include:{subscription:true}
      });
      if(!schedule) return {skipped:'NOT_FOUND'};
      if(!['SCHEDULED','DUE'].includes(schedule.status)) return {skipped:'ALREADY_RECOGNIZED'};

      const now=new Date();
      if(schedule.dueAt>now) return {skipped:'NOT_DUE'};

      const pvEvent=await tx.pvLedger.create({
        data:{
          qualificationId:schedule.subscription.qualificationId,
          pvType:'RPV',
          amount:schedule.rpvAmount,
          sourceType:'MONTHLY_RECOGNITION',
          sourceId:schedule.subscriptionId,
          sourceLineId:schedule.recognitionId,
          eventType:'RPV_CREATED',
          ruleVersionCode:schedule.ruleVersionCode,
          parameterSnapshotHash:schedule.parameterSnapshotHash,
          occurredAt:schedule.dueAt,
          correlationId
        }
      });

      // Binary ancestors, no compression/skipping.
      const ancestors=await tx.$queryRaw<Array<{qualification_id:string;generation:number}>>`
        WITH RECURSIVE up AS (
          SELECT bp.parent_qualification_id AS qualification_id, 1 AS generation
          FROM organization.binary_placement bp
          WHERE bp.child_qualification_id = ${schedule.subscription.qualificationId}::uuid
            AND bp.effective_from <= ${schedule.dueAt}
            AND (bp.effective_to IS NULL OR bp.effective_to > ${schedule.dueAt})
          UNION ALL
          SELECT bp.parent_qualification_id, up.generation + 1
          FROM organization.binary_placement bp
          JOIN up ON bp.child_qualification_id = up.qualification_id
          WHERE up.generation < 12
            AND bp.effective_from <= ${schedule.dueAt}
            AND (bp.effective_to IS NULL OR bp.effective_to > ${schedule.dueAt})
        )
        SELECT qualification_id::text, generation FROM up ORDER BY generation
      `;

      for(const a of ancestors){
        const directCount=await this.effectiveDirectCountAt(tx,a.qualification_id,schedule.dueAt);
        const depth=this.unlockedDepth(directCount);

        // Active First at recognition event time.
        const activeRow=await tx.activePeriod.findFirst({
          where:{
            qualificationId:a.qualification_id,
            activeFrom:{lte:schedule.dueAt},
            OR:[{activeTo:null},{activeTo:{gt:schedule.dueAt}}]
          }
        });
        const company=await companyAlwaysActiveAt(tx,a.qualification_id,schedule.dueAt);
        const active=company||!!activeRow;
        const companySnapshot=company?await captureParameters(tx,schedule.dueAt,schedule.ruleVersionCode):null;
        const eligible=a.generation<=depth && active;
        const theory=new Prisma.Decimal('100.00');
        const payable=eligible?theory:new Prisma.Decimal('0.00');

        await tx.rpvUplineAwardEvent.upsert({
          where:{
            recognitionId_recipientQualificationId_binaryGeneration:{
              recognitionId:schedule.recognitionId,
              recipientQualificationId:a.qualification_id,
              binaryGeneration:a.generation
            }
          },
          update:{},
          create:{
            recognitionId:schedule.recognitionId,
            sourceQualificationId:schedule.subscription.qualificationId,
            recipientQualificationId:a.qualification_id,
            binaryGeneration:a.generation,
            effectiveDirectCountSnapshot:directCount,
            unlockedDepthSnapshot:depth,
            activeSnapshot:active,
            theoryAmount:theory,
            payableAmount:payable,
            ruleVersionCode:schedule.ruleVersionCode,
            parameterSnapshotHash:companySnapshot?.hash??schedule.parameterSnapshotHash,
            occurredAt:schedule.dueAt
          }
        });
      }

      await sealRpvEvent(tx,pvEvent,schedule);
      await tx.monthlyRecognitionSchedule.update({
        where:{recognitionId},
        data:{status:'RECOGNIZED',recognizedAt:now,pvLedgerEventId:pvEvent.eventId}
      });

      return {
        recognitionId,
        pvLedgerEventId:pvEvent.eventId,
        ancestorCount:ancestors.length
      };
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async listAwards(recognitionId:string){
    return this.prisma.rpvUplineAwardEvent.findMany({
      where:{recognitionId},
      orderBy:{binaryGeneration:'asc'}
    });
  }
}
