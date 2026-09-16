import { ConflictException,Injectable,UnprocessableEntityException } from '@nestjs/common';
import { Prisma,PrismaService } from '@ucell/database';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class AdminOperationsService {
  constructor(private readonly prisma:PrismaService,private readonly audit:AuditService){}

  async returns(input:{status?:string;q?:string;take?:number}={}){
    const take=Math.min(Math.max(input.take??50,1),200);
    const q=input.q?.trim();
    const rows=await this.prisma.returnCase.findMany({
      where:{
        ...(input.status?{status:input.status as any}:{}),
        ...(q?{OR:[
          {reasonCode:{contains:q,mode:'insensitive'}},
          {order:{qualification:{currentHolder:{legalName:{contains:q,mode:'insensitive'}}}}},
          {order:{qualification:{currentHolder:{mobile:{contains:q}}}}},
        ]}:{}),
      },
      include:{
        order:{include:{qualification:{include:{currentHolder:true}}}},
        lines:true,
      },
      orderBy:{createdAt:'desc'},take,
    });
    const ids=rows.map(x=>x.returnCaseId);
    const [recoveries,replays]=await Promise.all([
      ids.length?this.prisma.bonusRecoveryEvent.findMany({where:{returnCaseId:{in:ids}}}):[],
      ids.length?this.prisma.settlementReplayRun.findMany({where:{sourceReturnCaseId:{in:ids}}}):[],
    ]);
    return rows.map(r=>({
      ...r,
      returnSummary:{totalAmount:r.lines.reduce((sum,line)=>sum.add(line.returnAmount),new Prisma.Decimal(0)).toString()},
      recoverySummary:recoveries.filter(x=>x.returnCaseId===r.returnCaseId).reduce((a,x)=>({
        count:a.count+1,
        amount:a.amount.add(x.recoveryAmount),
        outstanding:a.outstanding.add(x.outstandingAmount)
      }),{count:0,amount:new Prisma.Decimal(0),outstanding:new Prisma.Decimal(0)}),
      replay:replays.find(x=>x.sourceReturnCaseId===r.returnCaseId)??null,
    }));
  }

  async returnDetail(returnCaseId:string){
    const ret=await this.prisma.returnCase.findUniqueOrThrow({
      where:{returnCaseId},
      include:{
        lines:true,
        order:{include:{
          qualification:{include:{currentHolder:true}},
          lines:true,
          paymentEvents:true,
        }}
      }
    });
    const [recoveries,replay,recalc,reversals]=await Promise.all([
      this.prisma.bonusRecoveryEvent.findMany({
        where:{returnCaseId},
        include:{
          bonusAward:{include:{recipient:{include:{currentHolder:true}}}},
          applications:{include:{payoutLine:{include:{payoutBatch:true}}}}
        },
        orderBy:{occurredAt:'asc'}
      }),
      this.prisma.settlementReplayRun.findUnique({
        where:{sourceReturnCaseId:returnCaseId},
        include:{periods:{orderBy:{periodNo:'asc'}}}
      }),
      this.prisma.settlementRecalculationRequest.findMany({
        where:{sourceReturnCaseId:returnCaseId},
        orderBy:[{periodStart:'asc'},{settlementType:'asc'}]
      }),
      this.prisma.pvLedger.findMany({
        where:{sourceType:'RETURN',sourceId:returnCaseId,eventType:'GPV_REVERSAL'},
        orderBy:{occurredAt:'asc'}
      }),
    ]);
    return {returnCase:ret,reversals,recoveries,replay,recalculationRequests:recalc};
  }

  async workflows(input:{status?:string;type?:string;q?:string;take?:number}={}){
    const take=Math.min(Math.max(input.take??50,1),200);
    const rows=await this.prisma.qualificationWorkflow.findMany({
      where:{
        ...(input.status?{status:input.status as any}:{}),
        ...(input.type?{workflowType:input.type as any}:{})
      },
      orderBy:{createdAt:'desc'},take
    });
    const qids=[...new Set(rows.map(x=>x.qualificationId))];
    const pids=[...new Set(rows.flatMap(x=>[x.applicantPersonId,x.receivingPersonId]).filter(Boolean) as string[])];
    const [qualifications,people]=await Promise.all([
      qids.length?this.prisma.qualification.findMany({
        where:{qualificationId:{in:qids}},include:{currentHolder:true}
      }):[],
      pids.length?this.prisma.person.findMany({where:{personId:{in:pids}}}):[],
    ]);
    const merged=rows.map(x=>({
      ...x,
      qualification:qualifications.find(q=>q.qualificationId===x.qualificationId)??null,
      applicant:x.applicantPersonId?people.find(p=>p.personId===x.applicantPersonId)??null:null,
      receiver:x.receivingPersonId?people.find(p=>p.personId===x.receivingPersonId)??null:null,
    }));
    if(!input.q?.trim())return merged;
    const term=input.q.toLowerCase();
    return merged.filter((x:any)=>[
      x.qualification?.currentHolder?.legalName,
      x.receiver?.legalName,
      x.applicant?.legalName,
      x.qualificationId,
    ].some(v=>String(v??'').toLowerCase().includes(term)));
  }

  async workflowDetail(id:string){
    const wf=await this.prisma.qualificationWorkflow.findUniqueOrThrow({
      where:{qualificationWorkflowId:id}
    });
    const [qualification,applicant,receiver]=await Promise.all([
      this.prisma.qualification.findUnique({
        where:{qualificationId:wf.qualificationId},
        include:{
          currentHolder:true,
          holderHistory:{orderBy:{effectiveFrom:'desc'},take:20},
          qualificationStatusHistory:{orderBy:{effectiveFrom:'desc'},take:20},
        }
      }),
      wf.applicantPersonId?this.prisma.person.findUnique({where:{personId:wf.applicantPersonId}}):null,
      wf.receivingPersonId?this.prisma.person.findUnique({where:{personId:wf.receivingPersonId}}):null,
    ]);
    return {...wf,qualification,applicant,receiver};
  }

  async recoveries(input:{status?:string;q?:string;take?:number}={}){
    const take=Math.min(Math.max(input.take??100,1),300);
    const rows=await this.prisma.bonusRecoveryEvent.findMany({
      where:{
        ...(input.status?{status:input.status as any}:{status:{in:['OPEN','OFFSETTING']}}),
        ...(input.q?.trim()?{
          bonusAward:{recipient:{currentHolder:{legalName:{contains:input.q.trim(),mode:'insensitive'}}}}
        }:{})
      },
      include:{
        bonusAward:{
          include:{recipient:{include:{currentHolder:true}}}
        },
        applications:{include:{payoutLine:{include:{payoutBatch:true}}}}
      },
      orderBy:{occurredAt:'asc'},take
    });
    const now=Date.now();
    return rows.map(x=>({
      ...x,
      agingDays:Math.max(0,Math.floor((now-x.occurredAt.getTime())/86400000))
    }));
  }

  async payoutBatches(input:{status?:string;take?:number}={}){
    return this.prisma.payoutBatch.findMany({
      where:input.status?{status:input.status as any}:undefined,
      include:{_count:{select:{lines:true,approvals:true}}},
      orderBy:{periodEnd:'desc'},
      take:Math.min(Math.max(input.take??50,1),200)
    });
  }

  async payoutBatchDetail(id:string){
    return this.prisma.payoutBatch.findUniqueOrThrow({
      where:{payoutBatchId:id},
      include:{
        approvals:{orderBy:{createdAt:'asc'}},
        lines:{
          include:{
            recipient:{include:{currentHolder:true}},
            payableEntries:true,
            recoveryApplications:{include:{recoveryEvent:true}}
          },
          orderBy:{netAmount:'desc'}
        }
      }
    });
  }

  async approvePayout(
    id:string,
    stage:'FINANCE_REVIEW'|'COMPLIANCE_REVIEW',
    actorId:string|undefined,
    actorRole:string|undefined,
    note:string|undefined,
    requestId:string,
    correlationId:string
  ){
    if(!actorId) throw new UnprocessableEntityException('Authenticated actor is required for payout approval');
    const allowed=stage==='FINANCE_REVIEW'
      ? new Set(['FINANCE','SUPER_ADMIN'])
      : new Set(['COMPLIANCE_AUDIT','SUPER_ADMIN']);
    if(!actorRole || !allowed.has(actorRole))
      throw new UnprocessableEntityException(`Role ${actorRole ?? 'UNKNOWN'} cannot approve ${stage}`);

    return this.prisma.$transaction(async tx=>{
      const batch=await tx.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:id}});
      if(batch.status!=='READY') throw new ConflictException('Only READY payout batch can be approved');

      const other=await tx.payoutApproval.findFirst({
        where:{
          payoutBatchId:id,
          stage:{not:stage},
          decision:'APPROVED'
        }
      });
      if(other?.actorId===actorId)
        throw new UnprocessableEntityException('Finance and Compliance approvals must be made by different actors');

      const approval=await tx.payoutApproval.upsert({
        where:{payoutBatchId_stage:{payoutBatchId:id,stage}},
        update:{decision:'APPROVED',actorId,note},
        create:{payoutBatchId:id,stage,decision:'APPROVED',actorId,note}
      });
      await this.audit.write(tx,{
        actorType:actorId?'USER':'SYSTEM',actorId,
        action:'PAYOUT_APPROVED',entityType:'PAYOUT_BATCH',entityId:id,
        afterData:{stage,note},requestId,correlationId
      });
      return approval;
    });
  }

  async exportPayout(
    id:string,exportReference:string,actorId:string|undefined,actorRole:string|undefined,
    requestId:string,correlationId:string
  ){
    if(!actorId || !actorRole || !['FINANCE','SUPER_ADMIN'].includes(actorRole))
      throw new UnprocessableEntityException('Finance role and authenticated actor are required to export payout');
    return this.prisma.$transaction(async tx=>{
      const batch=await tx.payoutBatch.findUniqueOrThrow({
        where:{payoutBatchId:id},include:{approvals:true}
      });
      if(batch.status!=='READY')throw new ConflictException('Only READY payout batch can be exported');
      const approved=new Set(batch.approvals.filter(x=>x.decision==='APPROVED').map(x=>x.stage));
      if(!approved.has('FINANCE_REVIEW')||!approved.has('COMPLIANCE_REVIEW'))
        throw new UnprocessableEntityException('Finance and Compliance approvals are both required');
      const updated=await tx.payoutBatch.update({
        where:{payoutBatchId:id},
        data:{status:'EXPORTED',exportedAt:new Date(),exportReference}
      });
      await this.audit.write(tx,{
        actorType:actorId?'USER':'SYSTEM',actorId,
        action:'PAYOUT_EXPORTED',entityType:'PAYOUT_BATCH',entityId:id,
        afterData:{exportReference},requestId,correlationId
      });
      return updated;
    });
  }

  async markPaid(
    id:string,input:{paymentReference:string;paymentMethod:string;paidAt?:Date},
    actorId:string|undefined,actorRole:string|undefined,requestId:string,correlationId:string
  ){
    if(!actorId || !actorRole || !['FINANCE','SUPER_ADMIN'].includes(actorRole))
      throw new UnprocessableEntityException('Finance role and authenticated actor are required to mark payout paid');
    return this.prisma.$transaction(async tx=>{
      const batch=await tx.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:id}});
      if(batch.status!=='EXPORTED')throw new ConflictException('Only EXPORTED payout batch can be marked PAID');
      const paidAt=input.paidAt??new Date();
      const updated=await tx.payoutBatch.update({
        where:{payoutBatchId:id},
        data:{
          status:'PAID',paidAt,
          paymentReference:input.paymentReference,
          paymentMethod:input.paymentMethod
        }
      });
      const paidAwardEntries=await tx.payableEntry.findMany({
        where:{payoutLine:{payoutBatchId:id},status:'ALLOCATED',sourceType:'BONUS_AWARD'},
        select:{sourceId:true}
      });
      for(const entry of paidAwardEntries){
        const alreadyPaid=await tx.bonusAwardLifecycleEvent.findFirst({
          where:{bonusAwardId:entry.sourceId,status:'PAID'},select:{lifecycleEventId:true}
        });
        if(!alreadyPaid) await tx.bonusAwardLifecycleEvent.create({
          data:{bonusAwardId:entry.sourceId,status:'PAID',occurredAt:paidAt,reasonCode:'PAYOUT_PAID'}
        });
      }
      await tx.payableEntry.updateMany({
        where:{payoutLine:{payoutBatchId:id},status:'ALLOCATED'},
        data:{status:'PAID'}
      });
      await this.audit.write(tx,{
        actorType:actorId?'USER':'SYSTEM',actorId,
        action:'PAYOUT_PAID',entityType:'PAYOUT_BATCH',entityId:id,
        afterData:{
          paymentReference:input.paymentReference,
          paymentMethod:input.paymentMethod,
          paidAt:paidAt.toISOString()
        },
        requestId,correlationId
      });
      return updated;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
