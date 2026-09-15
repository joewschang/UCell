import { Injectable } from '@nestjs/common';
import { Prisma,PrismaService } from '@ucell/database';

@Injectable()
export class AdminObservabilityService {
  constructor(private readonly prisma:PrismaService){}

  async sponsorTree(rootQualificationId:string,depth=4,at=new Date()){
    const maxDepth=Math.min(Math.max(depth,1),10);
    return this.prisma.$queryRaw<Array<any>>`
      WITH RECURSIVE tree AS (
        SELECT
          q.qualification_id,
          q.qualification_no,
          q.plan_level_code,
          q.active_flag,
          p.legal_name,
          NULL::uuid AS parent_qualification_id,
          NULL::int AS sponsor_sequence_no,
          0::int AS depth,
          ARRAY[q.qualification_id]::uuid[] AS path
        FROM membership.qualification q
        JOIN identity.person p ON p.person_id=q.current_holder_person_id
        WHERE q.qualification_id=${rootQualificationId}::uuid

        UNION ALL

        SELECT
          child.qualification_id,
          child.qualification_no,
          child.plan_level_code,
          child.active_flag,
          holder.legal_name,
          sr.sponsor_qualification_id,
          sr.sponsor_sequence_no,
          tree.depth+1,
          tree.path || child.qualification_id
        FROM tree
        JOIN organization.sponsor_relationship sr
          ON sr.sponsor_qualification_id=tree.qualification_id
         AND sr.effective_from <= ${at}
         AND (sr.effective_to IS NULL OR sr.effective_to > ${at})
        JOIN membership.qualification child ON child.qualification_id=sr.child_qualification_id
        JOIN identity.person holder ON holder.person_id=child.current_holder_person_id
        WHERE tree.depth < ${maxDepth}
          AND NOT child.qualification_id=ANY(tree.path)
      )
      SELECT
        qualification_id::text,
        qualification_no::text,
        plan_level_code,
        active_flag,
        legal_name,
        parent_qualification_id::text,
        sponsor_sequence_no,
        depth
      FROM tree
      ORDER BY depth,parent_qualification_id,sponsor_sequence_no,qualification_no
    `;
  }

  async binaryTree(rootQualificationId:string,depth=5,at=new Date()){
    const maxDepth=Math.min(Math.max(depth,1),12);
    return this.prisma.$queryRaw<Array<any>>`
      WITH RECURSIVE tree AS (
        SELECT
          q.qualification_id,
          q.qualification_no,
          q.plan_level_code,
          q.active_flag,
          p.legal_name,
          NULL::uuid AS parent_qualification_id,
          NULL::organization."SideCode" AS side,
          0::int AS depth,
          ARRAY[q.qualification_id]::uuid[] AS path
        FROM membership.qualification q
        JOIN identity.person p ON p.person_id=q.current_holder_person_id
        WHERE q.qualification_id=${rootQualificationId}::uuid

        UNION ALL

        SELECT
          child.qualification_id,
          child.qualification_no,
          child.plan_level_code,
          child.active_flag,
          holder.legal_name,
          bp.parent_qualification_id,
          bp.side,
          tree.depth+1,
          tree.path || child.qualification_id
        FROM tree
        JOIN organization.binary_placement bp
          ON bp.parent_qualification_id=tree.qualification_id
         AND bp.effective_from <= ${at}
         AND (bp.effective_to IS NULL OR bp.effective_to > ${at})
        JOIN membership.qualification child ON child.qualification_id=bp.child_qualification_id
        JOIN identity.person holder ON holder.person_id=child.current_holder_person_id
        WHERE tree.depth < ${maxDepth}
          AND NOT child.qualification_id=ANY(tree.path)
      )
      SELECT
        qualification_id::text,
        qualification_no::text,
        plan_level_code,
        active_flag,
        legal_name,
        parent_qualification_id::text,
        side::text,
        depth
      FROM tree
      ORDER BY depth,parent_qualification_id,side,qualification_no
    `;
  }

  async qualificationOperations(qualificationId:string){
    const [qualification,pv,awards,carry]=await Promise.all([
      this.prisma.qualification.findUniqueOrThrow({
        where:{qualificationId},
        include:{
          currentHolder:true,
          activePeriods:{orderBy:{activeFrom:'desc'},take:50},
          qualificationStatusHistory:{orderBy:{effectiveFrom:'desc'},take:50},
          sponsorRelation:{include:{sponsor:{include:{currentHolder:true}}}},
          binaryPlacement:{include:{parent:{include:{currentHolder:true}}}},
        }
      }),
      this.prisma.pvLedger.findMany({
        where:{qualificationId},orderBy:{occurredAt:'desc'},take:200
      }),
      this.prisma.bonusAward.findMany({
        where:{recipientQualificationId:qualificationId},
        include:{
          lifecycleEvents:{orderBy:{occurredAt:'asc'}},
          recoveryEvents:true,
          settlementBatch:true,
          sourceQualification:{include:{currentHolder:true}},
        },
        orderBy:{occurredAt:'desc'},take:200
      }),
      this.prisma.binaryCarry.findMany({
        where:{qualificationId},orderBy:{periodEnd:'desc'},take:52
      }),
    ]);

    const balances=await this.prisma.pvLedger.groupBy({
      by:['pvType'],where:{qualificationId},_sum:{amount:true}
    });

    return {qualification,pv,balances,awards,carry};
  }

  async awardDetail(bonusAwardId:string){
    return this.prisma.bonusAward.findUniqueOrThrow({
      where:{bonusAwardId},
      include:{
        recipient:{include:{currentHolder:true}},
        sourceQualification:{include:{currentHolder:true}},
        sourceAward:true,
        derivedAwards:true,
        settlementBatch:true,
        lifecycleEvents:{orderBy:{occurredAt:'asc'}},
        recoveryEvents:{include:{applications:true}},
        payableEntries:true,
      }
    });
  }

  async settlementHistory(input:{
    settlementType?:'REFERRAL_K0'|'BINARY_K1'|'MATCHING_K2';
    take?:number;
  }={}){
    return this.prisma.settlementBatch.findMany({
      where:input.settlementType?{settlementType:input.settlementType}:undefined,
      include:{
        _count:{select:{awards:true}},
      },
      orderBy:{periodEnd:'desc'},
      take:Math.min(Math.max(input.take??50,1),200)
    });
  }

  async poolHistory(take=24){
    const limit=Math.min(Math.max(take,1),60);
    const [global,welfare]=await Promise.all([
      this.prisma.globalPoolSettlement.findMany({
        include:{_count:{select:{awards:true}}},
        orderBy:{periodEnd:'desc'},take:limit
      }),
      this.prisma.welfarePoolAccrual.findMany({
        orderBy:{periodEnd:'desc'},take:limit
      })
    ]);
    return {global,welfare};
  }

  async compensationSummary(){
    const latestSettlements=await this.prisma.settlementBatch.findMany({
      where:{status:'FINALIZED'},
      orderBy:{periodEnd:'desc'},take:12
    });
    const latestGlobal=await this.prisma.globalPoolSettlement.findFirst({
      orderBy:{periodEnd:'desc'}
    });
    const latestWelfare=await this.prisma.welfarePoolAccrual.findFirst({
      orderBy:{periodEnd:'desc'}
    });

    const pendingAwards=await this.prisma.bonusAward.count({
      where:{lifecycleEvents:{some:{status:'PENDING_45D'}}}
    });
    const effectiveAwards=await this.prisma.bonusAward.count({
      where:{lifecycleEvents:{some:{status:'EFFECTIVE'}}}
    });
    const openRecoveries=await this.prisma.bonusRecoveryEvent.aggregate({
      where:{status:{in:['OPEN','OFFSETTING']}},
      _sum:{outstandingAmount:true},
      _count:true
    });

    return {
      generatedAt:new Date(),
      latestSettlements,
      latestGlobal,
      latestWelfare,
      awards:{pending45d:pendingAwards,effective:effectiveAwards},
      recoveries:{
        openCount:openRecoveries._count,
        outstanding:openRecoveries._sum.outstandingAmount ?? new Prisma.Decimal(0)
      }
    };
  }
}
