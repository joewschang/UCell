import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';

@Injectable()
export class BonusQueryService {
  constructor(private readonly prisma:PrismaService){}

  async isActiveAt(tx:Prisma.TransactionClient,qualificationId:string,at:Date){
    return !!await tx.activePeriod.findFirst({
      where:{
        qualificationId,
        activeFrom:{lte:at},
        OR:[{activeTo:null},{activeTo:{gt:at}}]
      }
    });
  }

  async effectiveDirectCountAt(tx:Prisma.TransactionClient,sponsorQualificationId:string,at:Date){
    const rows=await tx.$queryRaw<Array<{count:string}>>`
      SELECT COUNT(*)::text AS count
      FROM organization.sponsor_relationship sr
      WHERE sr.sponsor_qualification_id=${sponsorQualificationId}::uuid
        AND sr.effective_from <= ${at}
        AND (sr.effective_to IS NULL OR sr.effective_to > ${at})
        AND EXISTS (
          SELECT 1
          FROM membership.qualification_status_history qsh
          WHERE qsh.qualification_id=sr.child_qualification_id
            AND qsh.status='EFFECTIVE'::membership."QualificationLifecycleStatus"
            AND qsh.effective_from <= ${at}
            AND (qsh.effective_to IS NULL OR qsh.effective_to > ${at})
        )
    `;
    return Number(rows[0]?.count ?? '0');
  }

  async sponsorAncestors(tx:Prisma.TransactionClient,qualificationId:string,at:Date,maxGeneration:number){
    return tx.$queryRaw<Array<{qualification_id:string;generation:number}>>`
      WITH RECURSIVE up AS (
        SELECT sr.sponsor_qualification_id AS qualification_id,1 AS generation
        FROM organization.sponsor_relationship sr
        WHERE sr.child_qualification_id=${qualificationId}::uuid
          AND sr.effective_from <= ${at}
          AND (sr.effective_to IS NULL OR sr.effective_to > ${at})
        UNION ALL
        SELECT sr.sponsor_qualification_id,up.generation+1
        FROM organization.sponsor_relationship sr
        JOIN up ON sr.child_qualification_id=up.qualification_id
        WHERE up.generation < ${maxGeneration}
          AND sr.effective_from <= ${at}
          AND (sr.effective_to IS NULL OR sr.effective_to > ${at})
      )
      SELECT qualification_id::text,generation FROM up ORDER BY generation
    `;
  }

  async qualificationPlanAt(tx:Prisma.TransactionClient,qualificationId:string,at:Date){
    const historical=await tx.qualificationPlanHistory.findFirst({
      where:{
        qualificationId,
        effectiveFrom:{lte:at},
        OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]
      },
      orderBy:{effectiveFrom:'desc'}
    });
    if(historical) return historical.planCode;

    throw new UnprocessableEntityException({code:'HISTORICAL_SNAPSHOT_MISSING',message:'Historical qualification plan is required; current plan cannot substitute.',qualificationId,effectiveAt:at.toISOString()});
  }

  async isQualificationEffectiveAt(tx:Prisma.TransactionClient,qualificationId:string,at:Date){
    return !!await tx.qualificationStatusHistory.findFirst({
      where:{
        qualificationId,status:'EFFECTIVE',
        effectiveFrom:{lte:at},
        OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]
      }
    });
  }

  async totalGpv(tx:Prisma.TransactionClient,start:Date,end:Date){
    const x=await tx.pvLedger.aggregate({
      where:{pvType:'GPV',occurredAt:{gte:start,lt:end}},
      _sum:{amount:true}
    });
    return x._sum.amount ?? new Prisma.Decimal(0);
  }

  pendingUntil(occurredAt:Date,pendingDays:number){
    return new Date(occurredAt.getTime()+pendingDays*86400000);
  }
}
