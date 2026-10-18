import {authorizeTreePrincipal,TreePrincipal} from '../binary-tree/tree-authorization';
import {treeHash} from '../organization/tree-placement';
import { ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { QualificationStatusService } from './qualification-status.service';

export type WorkflowPaymentConfirmation = { paymentConfirmed?: boolean; erpPaymentVoucher?: string };

@Injectable()
export class QualificationWorkflowService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly statusService:QualificationStatusService,
  ){}

  async submit(input:{
    qualificationId:string;
    workflowType:'UPGRADE'|'TRANSFER'|'EXIT'|'COMPANY_RETRANSFER';
    applicantPersonId?:string;
    receivingPersonId?:string;
    targetPlanCode?:string;
    payload?:any;
  }){
    const q=await this.prisma.qualification.findUnique({where:{qualificationId:input.qualificationId}});
    if(!q) throw new UnprocessableEntityException('Qualification not found');
    if(q.kind==='COMPANY_BOOTSTRAP')throw new UnprocessableEntityException('BOOTSTRAP_QUALIFICATION_LOCKED');

    if(input.workflowType==='UPGRADE' && !input.targetPlanCode)
      throw new UnprocessableEntityException('targetPlanCode required');
    if(input.workflowType==='UPGRADE') this.assertUpgrade(q.planLevelCode,input.targetPlanCode);
    if(['TRANSFER','COMPANY_RETRANSFER'].includes(input.workflowType) && !input.receivingPersonId)
      throw new UnprocessableEntityException('receivingPersonId required');

    return this.prisma.qualificationWorkflow.create({
      data:{
        qualificationId:input.qualificationId,
        workflowType:input.workflowType,
        status:'SUBMITTED',
        applicantPersonId:input.applicantPersonId,
        receivingPersonId:input.receivingPersonId,
        targetPlanCode:input.targetPlanCode,
        reviewFee:new Prisma.Decimal(600),
        submittedAt:new Date(),
        payload:{...(input.payload ?? {}),manualPayment:undefined}
      }
    });
  }

  async approve(workflowId:string,requestedEffectiveAt?:Date,principal?:TreePrincipal,payment?:WorkflowPaymentConfirmation){
    if(requestedEffectiveAt!==undefined && (!(requestedEffectiveAt instanceof Date) || !Number.isFinite(requestedEffectiveAt.getTime())))
      throw new UnprocessableEntityException('WORKFLOW_EFFECTIVE_TIME_INVALID');
    return this.prisma.$transaction(async tx=>{
      const wf=await tx.qualificationWorkflow.findUniqueOrThrow({
        where:{qualificationWorkflowId:workflowId}
      });
      if(wf.status!=='SUBMITTED')
        throw new UnprocessableEntityException('Workflow is not SUBMITTED');

      await tx.$queryRaw`SELECT qualification_id FROM membership.qualification WHERE qualification_id=${wf.qualificationId}::uuid FOR UPDATE`;
      const qualification=await tx.qualification.findUniqueOrThrow({where:{qualificationId:wf.qualificationId}});
      if(qualification.kind==='COMPANY_BOOTSTRAP')throw new UnprocessableEntityException('BOOTSTRAP_QUALIFICATION_LOCKED');
      const membership=await tx.binaryTreeMembership.findUnique({where:{qualificationId:wf.qualificationId},include:{binaryTree:true}});
      if(membership?.binaryTree.status==='ARCHIVED')throw new UnprocessableEntityException('TREE_ARCHIVED');
      const tracked=!!qualification.currentCompanyPrincipalId || !!membership;
      const stageTestAdmin=wf.workflowType==='UPGRADE' && process.env.UCELL_ENVIRONMENT==='STAGE' && process.env.NODE_ENV==='staging' && process.env.ADMIN_AUTH_BYPASS==='true' && principal?.provider==='ADMIN_LOCAL' && principal?.sessionId==='DEV_BYPASS' && principal?.subject==='dev-bypass' && principal?.role==='SUPER_ADMIN' && !principal?.personId;
      let actorId=tracked&&!stageTestAdmin?await authorizeTreePrincipal(this.prisma,principal,['SUPER_ADMIN','MEMBERSHIP_OPS'],tx):undefined;
      const payload=(wf.payload ?? {}) as any;
      const isUpgrade=wf.workflowType==='UPGRADE';
      let voucher:string|undefined;
      if(isUpgrade){
        if(payment?.paymentConfirmed!==true)throw new UnprocessableEntityException('UPGRADE_PAYMENT_CONFIRMATION_REQUIRED');
        voucher=typeof payment.erpPaymentVoucher==='string'?payment.erpPaymentVoucher.trim():'';
        if(!voucher || voucher.length>500 || /[\u0000-\u001f\u007f]/.test(voucher))throw new UnprocessableEntityException('ERP_PAYMENT_VOUCHER_REQUIRED_OR_INVALID');
        if(!stageTestAdmin && (!principal?.personId || principal.provider!=='ENTRA' || !['SUPER_ADMIN','MEMBERSHIP_OPS'].includes(principal.role)))throw new ForbiddenException('PAYMENT_CONFIRMER_REQUIRED');
        actorId=principal?.personId;
      }
      if(!isUpgrade && payload.reviewFeePaid !== true)
        throw new UnprocessableEntityException('NT$600 review fee must be confirmed before approval');

      const approvedAt=new Date();
      const effectiveAt=requestedEffectiveAt ?? approvedAt;
      if(tracked && requestedEffectiveAt && requestedEffectiveAt.getTime()!==approvedAt.getTime())throw new UnprocessableEntityException('TREE_OWNER_SCHEDULE_UNSUPPORTED');
      if(effectiveAt < approvedAt)
        throw new UnprocessableEntityException('Workflow effectiveAt cannot be backdated before approval');

      if(tracked && wf.workflowType==='EXIT'){
        const companyId=String(payload.companyPrincipalId??'');
        if(!/^[a-f0-9-]{36}$/i.test(companyId))throw new UnprocessableEntityException('COMPANY_PRINCIPAL_REQUIRED');
        const company=await tx.companyPrincipal.findUnique({where:{companyPrincipalId:companyId}});
        if(company?.status!=='ACTIVE')throw new UnprocessableEntityException('COMPANY_PRINCIPAL_UNAVAILABLE');
        await this.changeOwner(tx,wf.qualificationId,wf.qualificationWorkflowId,'EXIT',effectiveAt,'MEMBER',{companyPrincipalId:companyId});
        const current=await tx.qualificationHolderHistory.findFirst({where:{qualificationId:wf.qualificationId,effectiveTo:null}});
        if(!current||current.holderPersonId!==qualification.currentHolderPersonId)throw new UnprocessableEntityException('MEMBER_OWNER_EVIDENCE_REQUIRED');
        await tx.qualificationHolderHistory.update({where:{holderHistoryId:current.holderHistoryId},data:{effectiveTo:effectiveAt}});
        await this.statusService.transition(tx,wf.qualificationId,'EXITED',effectiveAt,'QUALIFICATION_EXIT',wf.qualificationWorkflowId);
        await tx.qualification.update({where:{qualificationId:wf.qualificationId},data:{currentHolderPersonId:null,currentCompanyPrincipalId:companyId,status:'CLOSED',activeFlag:false}});
      }
      if(wf.workflowType==='UPGRADE'){
        if(!wf.targetPlanCode) throw new UnprocessableEntityException('targetPlanCode required');

        const current=await tx.qualificationPlanHistory.findFirst({
          where:{qualificationId:wf.qualificationId,effectiveTo:null},
          orderBy:{effectiveFrom:'desc'}
        });
        // Recheck under the qualification lock: another submitted workflow may
        // already have raised the plan since this application was submitted.
        this.assertUpgrade(current?.planCode ?? qualification.planLevelCode,wf.targetPlanCode);
        if(current){
          await tx.qualificationPlanHistory.update({
            where:{qualificationPlanHistoryId:current.qualificationPlanHistoryId},
            data:{effectiveTo:effectiveAt}
          });
        }
        await tx.qualificationPlanHistory.create({
          data:{
            qualificationId:wf.qualificationId,
            planCode:wf.targetPlanCode,
            effectiveFrom:effectiveAt,
            sourceType:'QUALIFICATION_UPGRADE',
            sourceId:wf.qualificationWorkflowId
          }
        });
        await tx.qualification.update({
          where:{qualificationId:wf.qualificationId},
          data:{planLevelCode:wf.targetPlanCode}
        });
      }

      if(wf.workflowType==='TRANSFER' || wf.workflowType==='COMPANY_RETRANSFER'){
        if(tracked){
          if(!wf.receivingPersonId)throw new UnprocessableEntityException('receivingPersonId required');
          await this.changeOwner(tx,wf.qualificationId,wf.qualificationWorkflowId,wf.workflowType,effectiveAt,wf.workflowType==='TRANSFER'?'MEMBER':'COMPANY',{personId:wf.receivingPersonId});
        }
        if(!wf.receivingPersonId) throw new UnprocessableEntityException('receivingPersonId required');
        const receiver=await tx.person.findUnique({where:{personId:wf.receivingPersonId}});
        if(!receiver) throw new UnprocessableEntityException('Receiving Person not found');

        const current=await tx.qualificationHolderHistory.findFirst({
          where:{qualificationId:wf.qualificationId,effectiveTo:null},
          orderBy:{effectiveFrom:'desc'}
        });
        if(current){
          await tx.qualificationHolderHistory.update({
            where:{holderHistoryId:current.holderHistoryId},
            data:{effectiveTo:effectiveAt}
          });
        }
        await tx.qualificationHolderHistory.create({
          data:{
            qualificationId:wf.qualificationId,
            holderPersonId:wf.receivingPersonId,
            effectiveFrom:effectiveAt,
            sourceType:wf.workflowType,
            sourceId:wf.qualificationWorkflowId
          }
        });
        await tx.qualification.update({
          where:{qualificationId:wf.qualificationId},
          data:{
            currentHolderPersonId:wf.receivingPersonId,
            ...(tracked?{currentCompanyPrincipalId:null}:{}),
            ...(wf.workflowType==='COMPANY_RETRANSFER'?{status:'EFFECTIVE'}:{})
          }
        });
        if(wf.workflowType==='COMPANY_RETRANSFER'){
          await this.statusService.transition(
            tx,wf.qualificationId,'EFFECTIVE',effectiveAt,
            'COMPANY_RETRANSFER',wf.qualificationWorkflowId
          );
        }
      }

      if(wf.workflowType==='EXIT' && !tracked){
        const companyHolderPersonId=String(payload.companyHolderPersonId ?? '');
        if(!companyHolderPersonId)
          throw new UnprocessableEntityException('companyHolderPersonId required for company-held exit');
        const company=await tx.person.findUnique({where:{personId:companyHolderPersonId}});
        if(!company) throw new UnprocessableEntityException('Company holder Person not found');

        const current=await tx.qualificationHolderHistory.findFirst({
          where:{qualificationId:wf.qualificationId,effectiveTo:null},
          orderBy:{effectiveFrom:'desc'}
        });
        if(current){
          await tx.qualificationHolderHistory.update({
            where:{holderHistoryId:current.holderHistoryId},
            data:{effectiveTo:effectiveAt}
          });
        }
        await tx.qualificationHolderHistory.create({
          data:{
            qualificationId:wf.qualificationId,
            holderPersonId:companyHolderPersonId,
            effectiveFrom:effectiveAt,
            sourceType:'QUALIFICATION_EXIT_COMPANY_HELD',
            sourceId:wf.qualificationWorkflowId
          }
        });
        await this.statusService.transition(
          tx,wf.qualificationId,'EXITED',effectiveAt,
          'QUALIFICATION_EXIT',wf.qualificationWorkflowId
        );
        await tx.qualification.update({
          where:{qualificationId:wf.qualificationId},
          data:{currentHolderPersonId:companyHolderPersonId,status:'CLOSED',activeFlag:false}
        });
      }

      if(tracked || isUpgrade){
        if(tracked&&!stageTestAdmin)await authorizeTreePrincipal(this.prisma,principal,['SUPER_ADMIN','MEMBERSHIP_OPS'],tx);
        await tx.auditEvent.create({data:{actorType:stageTestAdmin?'STAGE_TEST_ADMIN':'USER',actorId,action:tracked?'TREE_QUALIFICATION_WORKFLOW_APPROVED':'QUALIFICATION_WORKFLOW_APPROVED',entityType:'Qualification',entityId:wf.qualificationId,requestId:wf.qualificationWorkflowId,correlationId:wf.qualificationWorkflowId,afterData:{workflowId:wf.qualificationWorkflowId,workflowType:wf.workflowType,effectiveAt:effectiveAt.toISOString(),binaryTreeId:membership?.binaryTreeId??null,...(isUpgrade?{paymentConfirmed:true,erpPaymentVoucher:voucher,paymentConfirmationMethod:'MANUAL_ERP_REFERENCE',...(stageTestAdmin?{confirmedByProvider:'ADMIN_LOCAL',confirmedBySubject:'dev-bypass',stageTestAdmin:true}:{})}:{})}}});
      }
      const confirmer=stageTestAdmin?{legalName:'Stage Super Admin（測試管理員）'}:isUpgrade?await tx.person.findUnique({where:{personId:actorId!},select:{legalName:true}}):null;
      if(isUpgrade && !confirmer)throw new ForbiddenException('PAYMENT_CONFIRMER_REQUIRED');
      return tx.qualificationWorkflow.update({
        where:{qualificationWorkflowId:workflowId},
        data:{status:'EFFECTIVE',approvedAt,effectiveAt,...(isUpgrade?{payload:{...payload,reviewFeePaid:true,manualPayment:{paymentConfirmed:true,erpPaymentVoucher:voucher,confirmedBy:actorId??null,...(stageTestAdmin?{confirmedByProvider:'ADMIN_LOCAL',confirmedBySubject:'dev-bypass',stageTestAdmin:true}:{}),confirmedByName:confirmer!.legalName,confirmedAt:approvedAt.toISOString(),method:'MANUAL_ERP_REFERENCE'}}}:{})}
      });
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  private assertUpgrade(current:string|null|undefined,target:string|null|undefined){
    const plans=['STARTER','ELITE','LEADER'];
    const from=plans.indexOf(current ?? ''),to=plans.indexOf(target ?? '');
    if(from<0 || to<0 || to<=from)throw new UnprocessableEntityException('UPGRADE_TARGET_MUST_BE_HIGHER');
  }
  private async changeOwner(tx:Prisma.TransactionClient,qualificationId:string,workflowId:string,type:string,at:Date,expected:'MEMBER'|'COMPANY',next:{personId?:string;companyPrincipalId?:string}){
    const current=await tx.qualificationOwnerInterval.findFirst({where:{qualificationId,effectiveTo:null}});
    if(!current || current.ownerType!==expected || current.effectiveFrom>=at)throw new UnprocessableEntityException('OWNER_EVIDENCE_CONFLICT');
    await tx.qualificationOwnerInterval.update({where:{ownerIntervalId:current.ownerIntervalId},data:{effectiveTo:at,closedRecordedAt:new Date()}});
    await tx.qualificationOwnerInterval.create({data:{qualificationId,ownerType:next.personId?'MEMBER':'COMPANY',...next,effectiveFrom:at,sourceType:type,sourceId:workflowId,
      evidenceHash:treeHash({qualificationId,workflowId,type,effectiveFrom:at.toISOString(),previousOwnerIntervalId:current.ownerIntervalId,...next})}});
  }
}
