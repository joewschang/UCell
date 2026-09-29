import { ConflictException,Injectable,UnprocessableEntityException } from '@nestjs/common';
import { Prisma,PrismaService } from '@ucell/database';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { createHash } from 'node:crypto';
import { companyReservoirCandidates } from './company-reservoir-invariants';
import { orderEconomicEvidence } from './order-economic-evidence';
import {createFinanceReviewArtifact,readFinanceReviewArtifact} from './payout-review-artifact';

@Injectable()
export class AdminOperationsService {
  constructor(private readonly prisma:PrismaService,private readonly audit:AuditService,private readonly idempotency?:IdempotencyService){}

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
        exportArtifacts:{select:{revision:true,formatVersion:true,contentHash:true,exportReference:true,generatedAt:true},orderBy:{revision:'desc'}},
        paymentResults:{select:{payoutLineId:true,resultStatus:true,paidAmount:true,paymentReference:true,reasonCode:true,occurredAt:true},orderBy:{createdAt:'asc'}},
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

  async economicLineageByOrderNo(orderNo:string){
    if(!/^\d+$/.test(orderNo)) throw new UnprocessableEntityException('INVALID_ORDER_NO');
    return this.prisma.$transaction(async tx=>{
    const order=await tx.order.findUnique({where:{orderNo:BigInt(orderNo)},include:{lines:true,paymentEvents:true,returns:{include:{lines:true}},fulfillments:{include:{sourceAllocations:{include:{serialAllocations:{include:{serializedUnit:true}}}},erpHandoffs:true}}}});
    if(!order) throw new ConflictException('ORDER_NOT_FOUND');
    return {
      economicEvidence:await orderEconomicEvidence(tx,order.orderId,order.returns.map(row=>row.returnCaseId)),
      order:{orderNo:order.orderNo.toString(),purpose:order.purpose,status:order.status,confirmedAt:order.confirmedAt?.toISOString()??null,paidAt:order.paidAt?.toISOString()??null,ruleVersionCode:order.ruleVersionCode,parameterSnapshotHash:order.parameterSnapshotHash??null},
      lines:order.lines.map(line=>({sku:line.skuSnapshot,quantity:line.quantity.toString(),amount:line.lineAmount.toString(),offering:line.commercialOfferingSnapshot??null,purpose:line.linePurpose??null,ruleSnapshot:line.ruleProfileSnapshot})),
      payments:order.paymentEvents.map(event=>({eventType:event.eventType,paymentMethod:event.paymentMethod,amount:event.amount.toString(),occurredAt:event.occurredAt.toISOString()})),
      fulfillments:order.fulfillments.map(f=>({fulfillmentKey:f.fulfillmentKey,status:f.status,sourceAllocations:f.sourceAllocations.map(a=>({sku:a.skuSnapshot,quantity:a.allocatedQuantity.toString(),serialNos:a.serialAllocations.map(s=>s.serializedUnit.serialNo).sort()})),erpHandoff:f.erpHandoffs[0]?{formatVersion:f.erpHandoffs[0].formatVersion,payloadHash:f.erpHandoffs[0].payloadHash,requestedAt:f.erpHandoffs[0].requestedAt.toISOString()}:null})),
      returns:order.returns.map(ret=>({status:ret.status,reasonCode:ret.reasonCode,occurredAt:ret.occurredAt.toISOString(),lines:ret.lines.map(line=>({quantity:line.quantity.toString(),amount:line.returnAmount.toString()}))})),
    };
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }

  async member360(memberNo:string){
    if(!/^\d{10}$/.test(memberNo)) throw new UnprocessableEntityException('INVALID_MEMBER_NO');
    const person=await this.prisma.person.findUnique({where:{memberNo},select:{personId:true,memberNo:true,legalName:true,preferredName:true,status:true,membershipState:true,securityStatus:true,createdAt:true}});
    if(!person) throw new ConflictException('MEMBER_NOT_FOUND');
    const qualifications=await this.prisma.qualification.findMany({where:{currentHolderPersonId:person.personId},include:{sponsorRelation:{include:{sponsor:{select:{ballNo:true}}}},binaryPlacement:{include:{parent:{select:{ballNo:true}}}},subscriptions:{orderBy:{createdAt:'desc'},take:10}}});
    const qualificationIds=qualifications.map(q=>q.qualificationId);
    const ballNos=qualifications.map(q=>q.ballNo).filter((value):value is string=>Boolean(value));
    const [lineLinks,orders,payables,awards,tasks,exceptions,timeline]=await Promise.all([
      this.prisma.identityLink.findMany({where:{personId:person.personId},select:{provider:true,status:true,createdAt:true,revokedAt:true}}),
      this.prisma.order.findMany({where:{OR:[{purchaserPersonId:person.personId},{qualificationId:{in:qualificationIds}}]},select:{orderNo:true,purpose:true,status:true,grossAmount:true,netAmount:true,confirmedAt:true,paidAt:true,fulfillments:{select:{fulfillmentKey:true,status:true}}},orderBy:{createdAt:'desc'},take:50}),
      qualificationIds.length?this.prisma.payableEntry.findMany({where:{qualificationId:{in:qualificationIds}},select:{status:true,grossAmount:true,availableAt:true,payoutLine:{select:{payoutBatch:{select:{status:true,periodEnd:true}}}}},orderBy:{createdAt:'desc'},take:50}):[],
      qualificationIds.length?this.prisma.bonusAward.findMany({where:{recipientQualificationId:{in:qualificationIds}},select:{awardType:true,theoryAmount:true,payableAmount:true,occurredAt:true},orderBy:{occurredAt:'desc'},take:50}):[],
      this.prisma.operationalTask.findMany({where:{sourceId:{in:[memberNo,...ballNos]}},select:{taskCode:true,priority:true,status:true,summary:true,dueAt:true,createdAt:true,completedAt:true},orderBy:{createdAt:'desc'},take:50}),
      this.prisma.operationalException.findMany({where:{sourceId:{in:[memberNo,...ballNos]}},select:{exceptionCode:true,severity:true,status:true,summary:true,createdAt:true,resolvedAt:true},orderBy:{createdAt:'desc'},take:50}),
      this.prisma.auditEvent.findMany({where:{entityId:{in:[person.personId,...qualificationIds]}},select:{action: true,eventCode:true,entityType:true,result:true,occurredAt:true},orderBy:{occurredAt:'desc'},take:100}),
    ]);
    return {member:{memberNo:person.memberNo,legalName:person.legalName,preferredName:person.preferredName,status:person.status,membershipState:person.membershipState,securityStatus:person.securityStatus,createdAt:person.createdAt.toISOString()},lineLinks:lineLinks.map(link=>({provider:link.provider,status:link.status,createdAt:link.createdAt.toISOString(),revokedAt:link.revokedAt?.toISOString()??null})),qualifications:qualifications.map(q=>({qualificationNo:q.qualificationNo.toString(),ballNo:q.ballNo,planLevelCode:q.planLevelCode,status:q.status,active:q.activeFlag,effectiveAt:q.effectiveAt?.toISOString()??null,sponsorBallNo:q.sponsorRelation?.sponsor.ballNo??null,binaryParentBallNo:q.binaryPlacement?.parent.ballNo??null,binarySide:q.binaryPlacement?.side??null,subscriptions:q.subscriptions.map(s=>({status:s.status,startMonth:s.startMonth.toISOString(),endMonth:s.endMonth.toISOString(),activatedAt:s.activatedAt?.toISOString()??null,cancelledAt:s.cancelledAt?.toISOString()??null}))})),orders:orders.map(order=>({orderNo:order.orderNo.toString(),purpose:order.purpose,status:order.status,grossAmount:order.grossAmount.toString(),netAmount:order.netAmount.toString(),confirmedAt:order.confirmedAt?.toISOString()??null,paidAt:order.paidAt?.toISOString()??null,fulfillments:order.fulfillments})),payables:payables.map(row=>({status:row.status,grossAmount:row.grossAmount.toString(),availableAt:row.availableAt.toISOString(),payoutStatus:row.payoutLine?.payoutBatch.status??null,payoutPeriodEnd:row.payoutLine?.payoutBatch.periodEnd.toISOString()??null})),awards:awards.map(row=>({awardType:row.awardType,theoryAmount:row.theoryAmount.toString(),payableAmount:row.payableAmount.toString(),occurredAt:row.occurredAt.toISOString()})),tasks,exceptions,timeline:timeline.map(event=>({action:event.action,eventCode:event.eventCode,entityType:event.entityType,result:event.result,occurredAt:event.occurredAt.toISOString()}))};
  }

  /**
   * A deterministic, rebuildable read projection. It stores no parallel
   * business state: every entry is derived from immutable audit or bounded
   * operational authorities at read time.
   */
  async memberActivityTimeline(memberNo:string,input:{take?:number}={}){
    if(!/^\d{10}$/.test(memberNo)) throw new UnprocessableEntityException('INVALID_MEMBER_NO');
    const take=Math.min(Math.max(input.take??100,1),200);
    const person=await this.prisma.person.findUnique({where:{memberNo},select:{personId:true}});
    if(!person) throw new ConflictException('MEMBER_NOT_FOUND');
    const qualifications=await this.prisma.qualification.findMany({where:{currentHolderPersonId:person.personId},select:{qualificationId:true,qualificationNo:true,ballNo:true}});
    const qualificationIds=qualifications.map(row=>row.qualificationId);
    const qualificationReference=new Map(qualifications.map(row=>[row.qualificationId,{qualificationNo:row.qualificationNo.toString(),ballNo:row.ballNo??null}]));
    const sourceIds=[memberNo,...qualifications.map(row=>row.ballNo).filter((value):value is string=>Boolean(value))];
    const [audits,tasks,exceptions]=await Promise.all([
      this.prisma.auditEvent.findMany({where:{entityId:{in:[person.personId,...qualificationIds]}},select:{action:true,eventCode:true,entityId:true,result:true,occurredAt:true,beforeHash:true,afterHash:true},orderBy:{occurredAt:'desc'},take}),
      this.prisma.operationalTask.findMany({where:{sourceId:{in:sourceIds}},select:{taskCode:true,priority:true,status:true,createdAt:true,updatedAt:true,evidenceHash:true},orderBy:{updatedAt:'desc'},take}),
      this.prisma.operationalException.findMany({where:{sourceId:{in:sourceIds}},select:{exceptionCode:true,severity:true,status:true,createdAt:true,updatedAt:true,evidenceHash:true},orderBy:{updatedAt:'desc'},take}),
    ]);
    const entries=[
      ...audits.map(event=>({source:'AUDIT_EVENT',eventType:event.action,eventCode:event.eventCode||event.action,sourceReference:event.entityId===person.personId?{memberNo}:qualificationReference.get(event.entityId??'')??{memberNo},result:event.result,occurredAt:event.occurredAt.toISOString(),evidence:{beforeHash:event.beforeHash??null,afterHash:event.afterHash??null}})),
      ...tasks.map(task=>({source:'OPERATIONAL_TASK',eventType:`TASK_${task.status}`,eventCode:task.taskCode,sourceReference:{memberNo},result:task.status,occurredAt:task.updatedAt.toISOString(),evidence:{evidenceHash:task.evidenceHash??null,priority:task.priority,createdAt:task.createdAt.toISOString()}})),
      ...exceptions.map(exception=>({source:'OPERATIONAL_EXCEPTION',eventType:`EXCEPTION_${exception.status}`,eventCode:exception.exceptionCode,sourceReference:{memberNo},result:exception.status,occurredAt:exception.updatedAt.toISOString(),evidence:{evidenceHash:exception.evidenceHash??null,severity:exception.severity,createdAt:exception.createdAt.toISOString()}})),
    ];
    return entries.sort((left,right)=>right.occurredAt.localeCompare(left.occurredAt)||left.source.localeCompare(right.source)||left.eventCode.localeCompare(right.eventCode)).slice(0,take);
  }

  async invariantCandidates(input:{take?:number}={}){
    const requested=Number.isFinite(input.take)?input.take??100:100;
    const take=Math.min(Math.max(requested,1),200);
    const [batches,payables,overdueRecognitions,allocations,companyCandidates]=await Promise.all([
      this.prisma.payoutBatch.findMany({include:{lines:{select:{netAmount:true}}},orderBy:{periodEnd:'desc'},take}),
      this.prisma.payableEntry.findMany({where:{sourceType:'BONUS_AWARD'},include:{qualification:{select:{qualificationNo:true}}},orderBy:{createdAt:'desc'},take}),
      this.prisma.monthlyRecognitionSchedule.findMany({
        where:{status:{in:['SCHEDULED','DUE']},dueAt:{lt:new Date()}},
        include:{subscription:{include:{qualification:{select:{qualificationNo:true}}}}},
        orderBy:{dueAt:'asc'},take,
      }),
      this.prisma.fulfillmentSourceAllocation.findMany({
        include:{orderLine:true,fulfillment:{include:{order:{select:{orderNo:true}},erpHandoffs:{select:{fulfillmentErpHandoffId:true}}}},serialAllocations:{include:{serializedUnit:{include:{batch:{select:{productId:true}}}}}}},
        orderBy:[{createdAt:'desc'},{fulfillmentSourceAllocationId:'asc'}],take,
      }),
      this.prisma.$transaction(tx=>companyReservoirCandidates(tx,take),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead}),
    ]);
    const awardIds=payables.map(row=>row.sourceId);
    const awards=awardIds.length?await this.prisma.bonusAward.findMany({where:{bonusAwardId:{in:awardIds}},select:{bonusAwardId:true}}):[];
    const knownAwards=new Set(awards.map(row=>row.bonusAwardId));
    const payoutCandidates=batches.flatMap(batch=>{
      const lineNet=batch.lines.reduce((sum,line)=>sum.add(line.netAmount),new Prisma.Decimal(0));
      if(lineNet.equals(batch.totalNet)) return [];
      const reference=`PAYOUT:${batch.periodStart.toISOString().slice(0,10)}:${batch.periodEnd.toISOString().slice(0,10)}`;
      const detail={declaredTotalNet:batch.totalNet.toString(),lineNetTotal:lineNet.toString(),status:batch.status};
      return [{code:'PAYOUT_BATCH_TOTAL_MISMATCH',severity:'CRITICAL',sourceType:'PAYOUT_BATCH',reference,evidenceHash:createHash('sha256').update(JSON.stringify({reference,...detail})).digest('hex'),detail}];
    });
    const payableCandidates=payables.filter(row=>!knownAwards.has(row.sourceId)).map(row=>{
      const reference=`QUALIFICATION:${row.qualification.qualificationNo.toString()}:PAYABLE_AWARD`;
      const detail={sourceType:row.sourceType,awardType:row.awardType,status:row.status,grossAmount:row.grossAmount.toString()};
      return {code:'PAYABLE_AWARD_SOURCE_MISSING',severity:'CRITICAL',sourceType:'PAYABLE_ENTRY',reference,evidenceHash:createHash('sha256').update(JSON.stringify({reference,...detail})).digest('hex'),detail};
    });
    const recognitionCandidates=overdueRecognitions.map(row=>{
      const dueDate=row.dueAt.toISOString();
      const reference=`QUALIFICATION:${row.subscription.qualification.qualificationNo.toString()}:RECOGNITION:${dueDate.slice(0,10)}`;
      const detail={status:row.status,dueAt:dueDate,recognitionMonth:row.recognitionMonth.toISOString(),installmentNo:row.installmentNo,ruleVersionCode:row.ruleVersionCode};
      return {code:'OVERDUE_RECOGNITION',severity:'HIGH',sourceType:'MONTHLY_RECOGNITION',reference,evidenceHash:createHash('sha256').update(JSON.stringify({reference,...detail})).digest('hex'),detail};
    });
    const fulfillmentCandidates=allocations.flatMap(row=>{
      const reference=`ORDER:${row.fulfillment.order.orderNo}:FULFILLMENT:${row.fulfillment.fulfillmentKey}:SKU:${row.skuSnapshot}`;
      const candidates:Array<{code:string;severity:string;sourceType:string;reference:string;evidenceHash:string;detail:Record<string,unknown>}>=[];
      const add=(code:string,detail:Record<string,unknown>)=>candidates.push({code,severity:'CRITICAL',sourceType:'FULFILLMENT_SOURCE_ALLOCATION',reference,
        evidenceHash:createHash('sha256').update(JSON.stringify({code,source:row.fulfillmentSourceAllocationId,reference,...detail})).digest('hex'),detail});
      if(row.orderLine.orderId!==row.fulfillment.orderId||row.skuSnapshot!==row.orderLine.skuSnapshot)
        add('FULFILLMENT_SOURCE_MISMATCH',{orderMatches:row.orderLine.orderId===row.fulfillment.orderId,skuMatches:row.skuSnapshot===row.orderLine.skuSnapshot});
      const mismatches=row.serialAllocations.filter(serial=>serial.fulfillmentId!==row.fulfillmentId||serial.serializedUnit.batch.productId!==row.orderLine.productId);
      if(mismatches.length) add('FULFILLMENT_SERIAL_SOURCE_MISMATCH',{mismatchedSerialCount:mismatches.length,serialCount:row.serialAllocations.length});
      const serialCount=new Prisma.Decimal(row.serialAllocations.length);
      if(serialCount.gt(row.allocatedQuantity)) add('FULFILLMENT_SERIAL_QUANTITY_EXCEEDED',{allocatedQuantity:row.allocatedQuantity.toString(),serialCount:row.serialAllocations.length});
      // In-progress scanning is expected to be incomplete. A durable ERP
      // handoff, however, certifies that the exact physical quantity was bound.
      if(row.fulfillment.erpHandoffs.length&&!serialCount.eq(row.allocatedQuantity))
        add('FULFILLMENT_HANDOFF_SERIAL_QUANTITY_MISMATCH',{allocatedQuantity:row.allocatedQuantity.toString(),serialCount:row.serialAllocations.length});
      return candidates;
    });
    return [...payoutCandidates,...payableCandidates,...recognitionCandidates,...fulfillmentCandidates,...companyCandidates].sort((left,right)=>left.code.localeCompare(right.code)||left.reference.localeCompare(right.reference)||left.evidenceHash.localeCompare(right.evidenceHash));
  }

  async operationalExceptions(input:{status?:string;take?:number}={}){
    const allowed=['OPEN','ACKNOWLEDGED','INVESTIGATING','RESOLVED'];
    if(input.status&&!allowed.includes(input.status)) throw new UnprocessableEntityException('INVALID_OPERATIONAL_EXCEPTION_STATUS');
    const requested=Number.isFinite(input.take)?input.take??100:100;
    return this.prisma.operationalException.findMany({where:input.status?{status:input.status as any}:undefined,orderBy:[{createdAt:'desc'}],take:Math.min(Math.max(requested,1),200)});
  }

  async transitionOperationalException(id:string,status:'ACKNOWLEDGED'|'INVESTIGATING'|'RESOLVED',actorId:string|undefined,note:string|undefined,requestId:string,correlationId:string){
    if(!actorId) throw new UnprocessableEntityException('Authenticated actor is required');
    if(!['ACKNOWLEDGED','INVESTIGATING','RESOLVED'].includes(status)) throw new UnprocessableEntityException('INVALID_OPERATIONAL_EXCEPTION_STATUS');
    return this.prisma.$transaction(async tx=>{
      const row=await tx.operationalException.findUniqueOrThrow({where:{operationalExceptionId:id}});
      if(row.status==='RESOLVED') throw new ConflictException('Operational exception is already resolved');
      const now=new Date();
      const updated=await tx.operationalException.update({where:{operationalExceptionId:id},data:{status,acknowledgedByActor:status==='ACKNOWLEDGED'||status==='INVESTIGATING'?actorId:row.acknowledgedByActor,acknowledgedAt:status==='ACKNOWLEDGED'||status==='INVESTIGATING'?now:row.acknowledgedAt,resolvedByActor:status==='RESOLVED'?actorId:undefined,resolvedAt:status==='RESOLVED'?now:undefined,resolutionNote:status==='RESOLVED'?note?.trim()||null:undefined}});
      await this.audit.write(tx,{actorType:'USER',actorId,action:'OPERATIONAL_EXCEPTION_TRANSITIONED',entityType:'OPERATIONAL_EXCEPTION',entityId:id,afterData:{from:row.status,to:status,note:status==='RESOLVED'?note?.trim()||null:null},requestId,correlationId});
      return updated;
    });
  }

  async operationalTasks(input:{status?:string;take?:number}={}){
    const allowed=['OPEN','ACKNOWLEDGED','COMPLETED'];
    if(input.status&&!allowed.includes(input.status)) throw new UnprocessableEntityException('INVALID_OPERATIONAL_TASK_STATUS');
    const requested=Number.isFinite(input.take)?input.take??100:100;
    return this.prisma.operationalTask.findMany({where:input.status?{status:input.status as any}:undefined,orderBy:[{createdAt:'desc'}],take:Math.min(Math.max(requested,1),200)});
  }

  async createOperationalTask(input:{sourceType:string;sourceId:string;taskCode:string;summary:string;priority?:string;assigneeActor?:string;assigneeRole?:string;dueAt?:string;evidenceHash?:string;traceId?:string},actorId:string|undefined,key:string,requestId:string,correlationId:string){
    if(!actorId) throw new UnprocessableEntityException('Authenticated actor is required');
    if(!this.idempotency) throw new UnprocessableEntityException('Operational task idempotency service is unavailable');
    const sourceType=input.sourceType?.trim(),sourceId=input.sourceId?.trim(),taskCode=input.taskCode?.trim(),summary=input.summary?.trim();
    if(!sourceType||!sourceId||!taskCode||!summary) throw new UnprocessableEntityException('OPERATIONAL_TASK_REQUIRED_FIELDS_MISSING');
    const dueAt=input.dueAt?new Date(input.dueAt):undefined;
    if(dueAt&&Number.isNaN(dueAt.getTime())) throw new UnprocessableEntityException('INVALID_OPERATIONAL_TASK_DUE_AT');
    return this.idempotency.execute(`admin:operational-task:${actorId}`,key,input,async tx=>{
      const existing=await tx.operationalTask.findUnique({where:{sourceType_sourceId_taskCode:{sourceType,sourceId,taskCode}}});
      if(existing) return {task:existing,created:false};
      const task=await tx.operationalTask.create({data:{sourceType,sourceId,taskCode,summary,priority:input.priority?.trim()||'NORMAL',assigneeActor:input.assigneeActor?.trim()||null,assigneeRole:input.assigneeRole?.trim()||null,dueAt,evidenceHash:input.evidenceHash?.trim()||null,traceId:input.traceId?.trim()||null}});
      await this.audit.write(tx,{actorType:'USER',actorId,action:'OPERATIONAL_TASK_CREATED',entityType:'OPERATIONAL_TASK',entityId:task.operationalTaskId,afterData:{sourceType,sourceId,taskCode,priority:task.priority,assigneeRole:task.assigneeRole,dueAt:task.dueAt?.toISOString()??null},requestId,correlationId});
      return {task,created:true};
    });
  }

  async transitionOperationalTask(id:string,status:'ACKNOWLEDGED'|'COMPLETED',actorId:string|undefined,note:string|undefined,requestId:string,correlationId:string){
    if(!actorId) throw new UnprocessableEntityException('Authenticated actor is required');
    if(!['ACKNOWLEDGED','COMPLETED'].includes(status)) throw new UnprocessableEntityException('INVALID_OPERATIONAL_TASK_STATUS');
    return this.prisma.$transaction(async tx=>{
      const row=await tx.operationalTask.findUniqueOrThrow({where:{operationalTaskId:id}});
      if(row.status==='COMPLETED') throw new ConflictException('Operational task is already completed');
      const now=new Date();
      const updated=await tx.operationalTask.update({where:{operationalTaskId:id},data:{status,acknowledgedByActor:status==='ACKNOWLEDGED'?actorId:row.acknowledgedByActor,acknowledgedAt:status==='ACKNOWLEDGED'?now:row.acknowledgedAt,completedByActor:status==='COMPLETED'?actorId:undefined,completedAt:status==='COMPLETED'?now:undefined,completionNote:status==='COMPLETED'?note?.trim()||null:undefined}});
      await this.audit.write(tx,{actorType:'USER',actorId,action:'OPERATIONAL_TASK_TRANSITIONED',entityType:'OPERATIONAL_TASK',entityId:id,afterData:{from:row.status,to:status,note:status==='COMPLETED'?note?.trim()||null:null},requestId,correlationId});
      return updated;
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
      await tx.$queryRaw`SELECT payout_batch_id FROM ledger.payout_batch WHERE payout_batch_id=${id}::uuid FOR UPDATE`;
      const batch=await tx.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:id}});
      const existing=await tx.payoutApproval.findUnique({where:{payoutBatchId_stage:{payoutBatchId:id,stage}}});
      if(existing){
        if(existing.decision==='APPROVED'&&existing.actorId===actorId) return existing;
        throw new ConflictException('Payout approval stage is immutable once recorded');
      }
      if(stage==='FINANCE_REVIEW'&&batch.status!=='READY') throw new ConflictException('Only READY payout batch can receive Finance review');
      if(stage==='COMPLIANCE_REVIEW'&&batch.status!=='REVIEWED') throw new ConflictException('Compliance review requires completed Finance review');

      const other=await tx.payoutApproval.findFirst({
        where:{
          payoutBatchId:id,
          stage:{not:stage},
          decision:'APPROVED'
        }
      });
      if(other?.actorId===actorId)
        throw new UnprocessableEntityException('Finance and Compliance approvals must be made by different actors');

      const approval=await tx.payoutApproval.create({data:{payoutBatchId:id,stage,decision:'APPROVED',actorId,note}});
      await tx.payoutBatch.update({where:{payoutBatchId:id},data:{status:stage==='FINANCE_REVIEW'?'REVIEWED':'APPROVED'}});
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
    if(!exportReference?.trim()) throw new UnprocessableEntityException('PAYOUT_EXPORT_REFERENCE_REQUIRED');
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT payout_batch_id FROM ledger.payout_batch WHERE payout_batch_id=${id}::uuid FOR UPDATE`;
      const batch=await tx.payoutBatch.findUniqueOrThrow({
        where:{payoutBatchId:id},include:{approvals:true,lines:{include:{recipient:{include:{currentHolder:{select:{memberNo:true}}}}},orderBy:{payoutLineId:'asc'}}}
      });
      if(batch.status==='EXPORTED'){
        const replay=await tx.payoutExportArtifact.findUnique({where:{exportReference:exportReference.trim()}});
        if(replay?.payoutBatchId===id) return {batch,artifact:replay,replayed:true};
        throw new ConflictException('Payout batch is already exported; create a governed replacement revision before another export');
      }
      if(!['READY','APPROVED'].includes(batch.status))throw new ConflictException('Only APPROVED payout batch can be exported');
      const approved=new Set(batch.approvals.filter(x=>x.decision==='APPROVED').map(x=>x.stage));
      if(!approved.has('FINANCE_REVIEW')||!approved.has('COMPLIANCE_REVIEW'))
        throw new UnprocessableEntityException('Finance and Compliance approvals are both required');
      const latestArtifact=await tx.payoutExportArtifact.aggregate({where:{payoutBatchId:id},_max:{revision:true}});
      const revision=(latestArtifact._max.revision??0)+1;
      const payload={schemaVersion:1,format:'GENERIC_FINANCE_CSV_V1',exportRevision:revision,payoutBatchId:batch.payoutBatchId,periodStart:batch.periodStart.toISOString(),periodEnd:batch.periodEnd.toISOString(),totalGross:batch.totalGross.toString(),totalRecovery:batch.totalRecovery.toString(),totalNet:batch.totalNet.toString(),lines:batch.lines.map(line=>({payoutLineId:line.payoutLineId,memberNo:line.recipient.currentHolder?.memberNo??null,ballNo:line.recipient.ballNo??null,grossAmount:line.grossAmount.toString(),recoveryOffset:line.recoveryOffset.toString(),netAmount:line.netAmount.toString()}))};
      const file=createFinanceReviewArtifact(payload,exportReference.trim());
      const artifact=await tx.payoutExportArtifact.create({data:{payoutBatchId:id,exportReference:exportReference.trim(),adapterCode:'GENERIC_FINANCE_CSV',revision,...file,generatedByActor:actorId}});
      const updated=await tx.payoutBatch.update({where:{payoutBatchId:id},data:{status:'EXPORTED',exportedAt:new Date(),exportReference:exportReference.trim()}});
      await this.audit.write(tx,{actorType:'USER',actorId,action:'PAYOUT_EXPORTED',entityType:'PAYOUT_BATCH',entityId:id,afterData:{exportReference:artifact.exportReference,adapterCode:artifact.adapterCode,formatVersion:artifact.formatVersion,contentHash:artifact.contentHash},requestId,correlationId});
      return {batch:updated,artifact,replayed:false};
    });
  }
  async downloadPayoutArtifact(id:string,revision:number,actorId:string|undefined,actorRole:string|undefined,requestId:string,correlationId:string){
    if(!actorId||!actorRole||!['FINANCE','SUPER_ADMIN'].includes(actorRole))throw new UnprocessableEntityException('Finance role and authenticated actor are required to download payout artifacts');
    if(!Number.isInteger(revision)||revision<1)throw new UnprocessableEntityException('INVALID_PAYOUT_EXPORT_REVISION');
    return this.prisma.$transaction(async tx=>{
      const artifact=await tx.payoutExportArtifact.findUnique({where:{payoutBatchId_revision:{payoutBatchId:id,revision}}});
      if(!artifact)throw new ConflictException('PAYOUT_EXPORT_ARTIFACT_NOT_FOUND');
      const file=readFinanceReviewArtifact(artifact);
      await this.audit.write(tx,{actorType:'USER',actorId,action:'PAYOUT_ARTIFACT_DOWNLOADED',entityType:'PAYOUT_BATCH',entityId:id,afterData:{revision,fileHash:file.fileHash,artifactHash:file.artifactHash},requestId,correlationId});
      return file;
    });
  }
  async markPaid(
    id:string,input:{paymentReference:string;paymentMethod:string;paidAt?:Date},
    actorId:string|undefined,actorRole:string|undefined,requestId:string,correlationId:string
  ){
    if(!actorId || !actorRole || !['FINANCE','SUPER_ADMIN'].includes(actorRole))
      throw new UnprocessableEntityException('Finance role and authenticated actor are required to mark payout paid');
    for(const value of [input?.paymentReference,input?.paymentMethod])if(typeof value!=='string'||!value.trim()||value.length>200||/[\u0000-\u001f\u007f]/.test(value))throw new UnprocessableEntityException('INVALID_PAYOUT_PAYMENT_REFERENCE');
    if(input.paidAt!==undefined&&(!(input.paidAt instanceof Date)||!Number.isFinite(input.paidAt.getTime())))throw new UnprocessableEntityException('INVALID_PAYOUT_RESULT_TIME');
    const paymentReference=input.paymentReference.trim(),paymentMethod=input.paymentMethod.trim();
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT payout_batch_id FROM ledger.payout_batch WHERE payout_batch_id=${id}::uuid FOR UPDATE`;
      const batch=await tx.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:id},include:{lines:true}});
      // Historical PAID batches replay without inventing missing historical results.
      if(batch.status==='PAID'){
        if(batch.paymentReference!==paymentReference||batch.paymentMethod!==paymentMethod||input.paidAt&&batch.paidAt?.getTime()!==input.paidAt.getTime())throw new ConflictException('PAYOUT_PAYMENT_REPLAY_CONFLICT');
        return batch;
      }
      if(batch.status!=='EXPORTED')throw new ConflictException('Only EXPORTED payout batch can be marked PAID');
      if(!batch.lines.length)throw new ConflictException('PAYOUT_RESULT_REQUIRED');
      const paidAt=input.paidAt??new Date();
      const prepared=this.preparePayoutResults(id,{results:batch.lines.map(line=>({payoutLineId:line.payoutLineId,status:'PAID',paidAmount:line.netAmount.toFixed(4),paymentReference,reasonCode:'LEGACY_BATCH_CONFIRMATION',occurredAt:paidAt}))});
      await this.writePayoutResults(tx,id,prepared,actorId,requestId,correlationId);
      const updated=await tx.payoutBatch.update({where:{payoutBatchId:id},data:{paymentReference,paymentMethod,paidAt}});
      await this.audit.write(tx,{actorType:'USER',actorId,action:'PAYOUT_PAID',entityType:'PAYOUT_BATCH',entityId:id,afterData:{paymentReference,paymentMethod,paidAt:paidAt.toISOString()},requestId,correlationId});
      return updated;
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }

  async recordPayoutResults(
    id:string,
    input:{results:Array<{payoutLineId:string;status:'PAID'|'FAILED';paidAmount:string;paymentReference?:string;reasonCode?:string;occurredAt?:Date}>},
    actorId:string|undefined,actorRole:string|undefined,requestId:string,correlationId:string,
  ){
    if(!actorId || !actorRole || !['FINANCE','SUPER_ADMIN'].includes(actorRole))
      throw new UnprocessableEntityException('Finance role and authenticated actor are required to reconcile payout results');
    const prepared=this.preparePayoutResults(id,input);
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT payout_batch_id FROM ledger.payout_batch WHERE payout_batch_id=${id}::uuid FOR UPDATE`;
      return this.writePayoutResults(tx,id,prepared,actorId,requestId,correlationId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }

  private preparePayoutResults(id:string,input:{results:Array<{payoutLineId:string;status:'PAID'|'FAILED';paidAmount:string;paymentReference?:string;reasonCode?:string;occurredAt?:Date}>}){
    if(!Array.isArray(input?.results)||!input.results.length) throw new UnprocessableEntityException('PAYOUT_RESULT_REQUIRED');
    const seen=new Set<string>();
    return input.results.map(result=>{
      if(!result||typeof result.payoutLineId!=='string'||seen.has(result.payoutLineId)||!['PAID','FAILED'].includes(result.status)||typeof result.paidAmount!=='string'||!/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$/.test(result.paidAmount))throw new UnprocessableEntityException('INVALID_PAYOUT_RESULT');
      seen.add(result.payoutLineId);
      if(result.occurredAt!==undefined&&(!(result.occurredAt instanceof Date)||!Number.isFinite(result.occurredAt.getTime())))throw new UnprocessableEntityException('INVALID_PAYOUT_RESULT_TIME');
      for(const value of [result.paymentReference,result.reasonCode])if(value!==undefined&&(typeof value!=='string'||value.length>200||/[\u0000-\u001f\u007f]/.test(value)))throw new UnprocessableEntityException('INVALID_PAYOUT_RESULT_REFERENCE');
      const amount=new Prisma.Decimal(result.paidAmount),paymentReference=result.paymentReference?.trim()||null,reasonCode=result.reasonCode?.trim()||null;
      return {...result,amount,paymentReference,reasonCode,key:`payout-result:${id}:${result.payoutLineId}:${result.status}:${amount.toFixed(4)}:${paymentReference??''}`};
    });
  }

  // Both entry points hold the same batch lock before calling the shared writer.
  private async writePayoutResults(tx:Prisma.TransactionClient,id:string,prepared:ReturnType<AdminOperationsService['preparePayoutResults']>,actorId:string,requestId:string,correlationId:string){
      const batch=await tx.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:id},include:{lines:{include:{payableEntries:true}}}});
      const history=await tx.payoutPaymentResult.findMany({where:{payoutBatchId:id},orderBy:[{createdAt:'asc'},{payoutPaymentResultId:'asc'}]});
      const byKey=new Map(history.map(row=>[row.idempotencyKey,row]));
      for(const result of prepared){
        const prior=byKey.get(result.key);
        if(prior&&(prior.reasonCode!==result.reasonCode||result.occurredAt&&prior.occurredAt.getTime()!==result.occurredAt.getTime()))throw new ConflictException('PAYOUT_RESULT_REPLAY_CONFLICT');
      }
      if(prepared.every(result=>byKey.has(result.key)))return {batch,results:history,replayed:true};
      if(!['EXPORTED','PROCESSING','PARTIALLY_PAID','FAILED'].includes(batch.status))throw new ConflictException('Only exported unpaid payout batches can accept new payment results');
      const lineById=new Map(batch.lines.map(line=>[line.payoutLineId,line]));
      for(const result of prepared){
        const line=lineById.get(result.payoutLineId); if(!line) throw new ConflictException('PAYOUT_RESULT_LINE_NOT_IN_BATCH');
        const {amount}=result;
        if(amount.gt(line.netAmount)||(result.status==='FAILED'&&!amount.isZero())||(result.status==='PAID'&&amount.isZero()&&!line.netAmount.isZero())) throw new UnprocessableEntityException('INVALID_PAYOUT_RESULT_AMOUNT');
        if(byKey.has(result.key))continue;
        const previousPaid=history.filter(row=>row.payoutLineId===line.payoutLineId&&row.resultStatus==='PAID');
        if(previousPaid.some(row=>row.paidAmount.gt(amount)||row.paidAmount.equals(line.netAmount)&&result.status==='FAILED'))throw new ConflictException('PAYOUT_PAID_AMOUNT_CANNOT_DECREASE');
        const occurredAt=result.occurredAt??new Date();
        await tx.payoutPaymentResult.create({data:{payoutBatchId:id,payoutLineId:line.payoutLineId,resultStatus:result.status,paidAmount:amount,paymentReference:result.paymentReference,reasonCode:result.reasonCode,occurredAt,recordedByActor:actorId,idempotencyKey:result.key}});
        if(result.status==='PAID'&&amount.equals(line.netAmount)){
          for(const entry of line.payableEntries.filter(entry=>entry.status==='ALLOCATED'&&entry.sourceType==='BONUS_AWARD'))if(!await tx.bonusAwardLifecycleEvent.findFirst({where:{bonusAwardId:entry.sourceId,status:'PAID'},select:{lifecycleEventId:true}}))await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId:entry.sourceId,status:'PAID',occurredAt,reasonCode:'PAYOUT_PAID'}});
          await tx.payableEntry.updateMany({where:{payoutLineId:line.payoutLineId,status:'ALLOCATED'},data:{status:'PAID'}});
        }
      }
      const results=await tx.payoutPaymentResult.findMany({where:{payoutBatchId:id},orderBy:{createdAt:'asc'}});
      // Cumulative confirmed amounts are monotonic; timestamp ties or delayed
      // reports cannot erase a prior confirmed transfer.
      const balances=batch.lines.map(line=>{const rows=results.filter(row=>row.payoutLineId===line.payoutLineId),payments=rows.filter(row=>row.resultStatus==='PAID');return {paid:payments.reduce((max,row)=>Prisma.Decimal.max(max,row.paidAmount),new Prisma.Decimal(0)),complete:payments.some(row=>row.paidAmount.equals(line.netAmount)),failed:rows.some(row=>row.resultStatus==='FAILED')};});
      const paid=balances.reduce((sum,line)=>sum.add(line.paid),new Prisma.Decimal(0));
      const status=balances.length&&balances.every(line=>line.complete)?'PAID':paid.gt(0)?'PARTIALLY_PAID':balances.length&&balances.every(line=>line.failed)?'FAILED':'PROCESSING';
      const updated=await tx.payoutBatch.update({where:{payoutBatchId:id},data:{status,paymentReference:status==='PAID'?'RECONCILED_BY_LINE_RESULTS':undefined,paidAt:status==='PAID'?new Date():undefined}});
      await this.audit.write(tx,{actorType:'USER',actorId,action:'PAYOUT_RESULT_RECORDED',entityType:'PAYOUT_BATCH',entityId:id,afterData:{status,paidAmount:paid.toString(),resultCount:results.length},requestId,correlationId});
      return {batch:updated,results,replayed:false};
  }
}
