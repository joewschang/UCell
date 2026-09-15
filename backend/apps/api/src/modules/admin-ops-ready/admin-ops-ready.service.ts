import { BadRequestException,Injectable,UnprocessableEntityException } from '@nestjs/common';
import { Prisma,PrismaService } from '@ucell/database';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class AdminOpsReadyService{
  constructor(private readonly prisma:PrismaService,private readonly audit:AuditService){}

  async registerAttachment(input:{
    entityType:string;entityId:string;documentType:string;
    originalFileName:string;mimeType:string;sizeBytes:string|number;
    sha256:string;storageProvider:string;objectKey:string;
    supersedesId?:string;metadataJson?:any;
  },actorId:string|undefined,requestId:string,correlationId:string){
    if(!/^[0-9a-f]{64}$/i.test(input.sha256))
      throw new UnprocessableEntityException('sha256 must be 64 hex characters');

    return this.prisma.$transaction(async tx=>{
      let versionNo=1;
      if(input.supersedesId){
        const old=await tx.documentAttachment.findUniqueOrThrow({
          where:{documentAttachmentId:input.supersedesId}
        });
        if(old.entityType!==input.entityType||old.entityId!==input.entityId||old.documentType!==input.documentType)
          throw new UnprocessableEntityException('superseded document scope mismatch');
        versionNo=old.versionNo+1;
        await tx.documentAttachment.update({
          where:{documentAttachmentId:old.documentAttachmentId},
          data:{status:'SUPERSEDED'}
        });
      }else{
        const latest=await tx.documentAttachment.findFirst({
          where:{entityType:input.entityType,entityId:input.entityId,documentType:input.documentType},
          orderBy:{versionNo:'desc'}
        });
        if(latest) versionNo=latest.versionNo+1;
      }

      const doc=await tx.documentAttachment.create({
        data:{
          entityType:input.entityType,entityId:input.entityId,documentType:input.documentType,
          originalFileName:input.originalFileName,mimeType:input.mimeType,
          sizeBytes:BigInt(input.sizeBytes),sha256:input.sha256.toLowerCase(),
          storageProvider:input.storageProvider,objectKey:input.objectKey,
          versionNo,uploadedBy:actorId,supersedesId:input.supersedesId,
          metadataJson:input.metadataJson??{}
        }
      });
      await this.audit.write(tx,{
        actorType:actorId?'USER':'SYSTEM',actorId,
        action:'DOCUMENT_REGISTERED',entityType:input.entityType,entityId:input.entityId,
        afterData:{
          documentAttachmentId:doc.documentAttachmentId,
          documentType:doc.documentType,versionNo:doc.versionNo,
          sha256:doc.sha256,storageProvider:doc.storageProvider,objectKey:doc.objectKey
        },
        requestId,correlationId
      });
      return doc;
    });
  }

  async attachments(entityType:string,entityId:string){
    return this.prisma.documentAttachment.findMany({
      where:{entityType,entityId},
      orderBy:[{documentType:'asc'},{versionNo:'desc'}]
    });
  }

  async auditEvents(input:{
    entityType?:string;entityId?:string;action?:string;actorId?:string;
    correlationId?:string;from?:Date;to?:Date;take?:number;
  }={}){
    return this.prisma.auditEvent.findMany({
      where:{
        ...(input.entityType?{entityType:input.entityType}:{}),
        ...(input.entityId?{entityId:input.entityId}:{}),
        ...(input.action?{action:{contains:input.action,mode:'insensitive'}}:{}),
        ...(input.actorId?{actorId:input.actorId}:{}),
        ...(input.correlationId?{correlationId:input.correlationId}:{}),
        ...((input.from||input.to)?{occurredAt:{
          ...(input.from?{gte:input.from}:{}),...(input.to?{lte:input.to}:{})
        }}:{})
      },
      orderBy:{occurredAt:'desc'},
      take:Math.min(Math.max(input.take??100,1),500)
    });
  }

  async operationsReport(from:Date,to:Date){
    if(!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from>to)
      throw new BadRequestException('REPORT_PERIOD_INVALID: valid from/to dates in chronological order are required');
    const [persons,qualifications,applications,orders,returns,awards,payouts,recoveries]=await Promise.all([
      this.prisma.person.count({where:{createdAt:{gte:from,lte:to}}}),
      this.prisma.qualification.count({where:{createdAt:{gte:from,lte:to}}}),
      this.prisma.membershipApplication.groupBy({
        by:['status'],where:{createdAt:{gte:from,lte:to}},_count:true
      }),
      this.prisma.order.aggregate({
        where:{createdAt:{gte:from,lte:to}},
        _count:true,_sum:{netAmount:true}
      }),
      this.prisma.returnLine.aggregate({
        where:{returnCase:{occurredAt:{gte:from,lte:to}}},
        _sum:{returnAmount:true,gpvReversalAmount:true},_count:true
      }),
      this.prisma.bonusAward.groupBy({
        by:['awardType'],where:{occurredAt:{gte:from,lte:to}},
        _count:true,_sum:{theoryAmount:true,payableAmount:true}
      }),
      this.prisma.payoutBatch.aggregate({
        where:{periodEnd:{gte:from,lte:to}},
        _count:true,_sum:{totalGross:true,totalRecovery:true,totalNet:true}
      }),
      this.prisma.bonusRecoveryEvent.aggregate({
        where:{occurredAt:{gte:from,lte:to}},
        _count:true,_sum:{recoveryAmount:true,recoveredAmount:true,outstandingAmount:true}
      }),
    ]);
    return {
      from,to,generatedAt:new Date(),
      persons,qualifications,applications,
      orders:{count:orders._count,netAmount:orders._sum.netAmount??new Prisma.Decimal(0)},
      returns:{
        lineCount:returns._count,
        returnAmount:returns._sum.returnAmount??new Prisma.Decimal(0),
        gpvReversal:returns._sum.gpvReversalAmount??new Prisma.Decimal(0)
      },
      awards,payouts,recoveries
    };
  }

  async integrityAlerts(){
    const alerts:Array<any>=[];

    const recoveryMismatch=await this.prisma.$queryRaw<Array<any>>`
      SELECT bonus_recovery_event_id::text AS id,
             recovery_amount::text,recovered_amount::text,outstanding_amount::text
      FROM ledger.bonus_recovery_event
      WHERE abs(recovery_amount-(recovered_amount+outstanding_amount)) > 0.0001
      LIMIT 100
    `;
    recoveryMismatch.forEach(x=>alerts.push({
      severity:'CRITICAL',code:'RECOVERY_BALANCE_MISMATCH',
      entityType:'BONUS_RECOVERY_EVENT',entityId:x.id,detail:x
    }));

    const payoutMismatch=await this.prisma.$queryRaw<Array<any>>`
      SELECT payout_line_id::text AS id,gross_amount::text,recovery_offset::text,net_amount::text
      FROM ledger.payout_line
      WHERE abs(net_amount-(gross_amount-recovery_offset)) > 0.0001
      LIMIT 100
    `;
    payoutMismatch.forEach(x=>alerts.push({
      severity:'CRITICAL',code:'PAYOUT_NET_MISMATCH',
      entityType:'PAYOUT_LINE',entityId:x.id,detail:x
    }));

    const activeMismatch=await this.prisma.$queryRaw<Array<any>>`
      SELECT q.qualification_id::text AS id,q.active_flag
      FROM membership.qualification q
      WHERE q.active_flag=true
        AND NOT EXISTS(
          SELECT 1 FROM membership.active_period ap
          WHERE ap.qualification_id=q.qualification_id
            AND ap.active_from<=now()
            AND (ap.active_to IS NULL OR ap.active_to>now())
        )
      LIMIT 100
    `;
    activeMismatch.forEach(x=>alerts.push({
      severity:'HIGH',code:'ACTIVE_FLAG_WITHOUT_PERIOD',
      entityType:'QUALIFICATION',entityId:x.id,detail:x
    }));

    const planMismatch=await this.prisma.$queryRaw<Array<any>>`
      SELECT q.qualification_id::text AS id,q.plan_level_code,h.plan_code
      FROM membership.qualification q
      LEFT JOIN LATERAL (
        SELECT plan_code FROM membership.qualification_plan_history ph
        WHERE ph.qualification_id=q.qualification_id
          AND ph.effective_from<=now()
          AND (ph.effective_to IS NULL OR ph.effective_to>now())
        ORDER BY ph.effective_from DESC LIMIT 1
      ) h ON true
      WHERE h.plan_code IS NOT NULL AND h.plan_code<>q.plan_level_code
      LIMIT 100
    `;
    planMismatch.forEach(x=>alerts.push({
      severity:'HIGH',code:'CURRENT_PLAN_HISTORY_MISMATCH',
      entityType:'QUALIFICATION',entityId:x.id,detail:x
    }));

    const effectiveAppMissingQ=await this.prisma.membershipApplication.findMany({
      where:{status:'EFFECTIVE',createdQualificationId:null},
      select:{applicationId:true},take:100
    });
    effectiveAppMissingQ.forEach(x=>alerts.push({
      severity:'CRITICAL',code:'EFFECTIVE_APPLICATION_WITHOUT_QUALIFICATION',
      entityType:'MEMBERSHIP_APPLICATION',entityId:x.applicationId
    }));

    const paidWithoutGpv=await this.prisma.$queryRaw<Array<any>>`
      SELECT o.order_id::text AS id,o.paid_at
      FROM commerce."order" o
      WHERE o.status IN ('PAID','FULFILLED','PARTIAL_RETURN','RETURNED')
        AND o.paid_at < now()-interval '10 minutes'
        AND NOT EXISTS(
          SELECT 1 FROM ledger.pv_ledger p
          WHERE p.source_type='ORDER'
            AND p.source_id=o.order_id
            AND p.event_type='GPV_CREATED'
        )
      LIMIT 100
    `;
    paidWithoutGpv.forEach(x=>alerts.push({
      severity:'HIGH',code:'PAID_ORDER_WITHOUT_GPV',
      entityType:'ORDER',entityId:x.id,detail:x
    }));

    return {
      generatedAt:new Date(),
      counts:{
        critical:alerts.filter(x=>x.severity==='CRITICAL').length,
        high:alerts.filter(x=>x.severity==='HIGH').length,
        total:alerts.length
      },
      alerts
    };
  }

  async exportDataset(dataset:'QUALIFICATIONS'|'ORDERS'|'PAYOUTS',take=5000){
    const limit=Math.min(Math.max(take,1),10000);
    let headers:string[]=[];let rows:any[][]=[];

    if(dataset==='QUALIFICATIONS'){
      const data=await this.prisma.qualification.findMany({
        include:{currentHolder:true},orderBy:{createdAt:'desc'},take:limit
      });
      headers=['qualificationId','qualificationNo','holder','plan','status','activeFlag','effectiveAt'];
      rows=data.map(x=>[
        x.qualificationId,String(x.qualificationNo),x.currentHolder.legalName,
        x.planLevelCode,x.status,String(x.activeFlag),x.effectiveAt?.toISOString()??''
      ]);
    }else if(dataset==='ORDERS'){
      const data=await this.prisma.order.findMany({
        include:{qualification:{include:{currentHolder:true}}},
        orderBy:{createdAt:'desc'},take:limit
      });
      headers=['orderId','orderNo','holder','qualificationId','purpose','status','netAmount','paidAt','createdAt'];
      rows=data.map(x=>[
        x.orderId,String(x.orderNo),x.qualification.currentHolder.legalName,x.qualificationId,
        x.purpose,x.status,x.netAmount.toString(),x.paidAt?.toISOString()??'',x.createdAt.toISOString()
      ]);
    }else{
      const data=await this.prisma.payoutBatch.findMany({
        orderBy:{periodEnd:'desc'},take:limit
      });
      headers=['payoutBatchId','periodStart','periodEnd','status','gross','recovery','net','exportReference','paymentReference'];
      rows=data.map(x=>[
        x.payoutBatchId,x.periodStart.toISOString(),x.periodEnd.toISOString(),x.status,
        x.totalGross.toString(),x.totalRecovery.toString(),x.totalNet.toString(),
        x.exportReference??'',x.paymentReference??''
      ]);
    }

    const esc=(v:any)=>`"${String(v??'').replaceAll('"','""')}"`;
    const csv='\uFEFF'+[headers,...rows].map(r=>r.map(esc).join(',')).join('\r\n');
    return {
      filename:`ucell_${dataset.toLowerCase()}_${new Date().toISOString().slice(0,10)}.csv`,
      contentType:'text/csv;charset=utf-8',
      content:csv,rowCount:rows.length
    };
  }
}
