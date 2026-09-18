import {authorizeTreePrincipal,TreePrincipal} from '../binary-tree/tree-authorization';
import {treeHash} from '../organization/tree-placement';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { QualificationStatusService } from './qualification-status.service';

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
        payload:input.payload ?? {}
      }
    });
  }

  async approve(workflowId:string,requestedEffectiveAt?:Date,principal?:TreePrincipal){
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
      const actorId=tracked?await authorizeTreePrincipal(this.prisma,principal,['SUPER_ADMIN','MEMBERSHIP_OPS'],tx):undefined;
      const payload=(wf.payload ?? {}) as any;
      if(payload.reviewFeePaid !== true)
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

      if(tracked){
        await authorizeTreePrincipal(this.prisma,principal,['SUPER_ADMIN','MEMBERSHIP_OPS'],tx);
        await tx.auditEvent.create({data:{actorType:'USER',actorId,action:'TREE_QUALIFICATION_WORKFLOW_APPROVED',entityType:'Qualification',entityId:wf.qualificationId,requestId:wf.qualificationWorkflowId,correlationId:wf.qualificationWorkflowId,afterData:{workflowId:wf.qualificationWorkflowId,workflowType:wf.workflowType,effectiveAt:effectiveAt.toISOString(),binaryTreeId:membership?.binaryTreeId??null}}});
      }
      return tx.qualificationWorkflow.update({
        where:{qualificationWorkflowId:workflowId},
        data:{status:'EFFECTIVE',approvedAt,effectiveAt}
      });
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  private async changeOwner(tx:Prisma.TransactionClient,qualificationId:string,workflowId:string,type:string,at:Date,expected:'MEMBER'|'COMPANY',next:{personId?:string;companyPrincipalId?:string}){
    const current=await tx.qualificationOwnerInterval.findFirst({where:{qualificationId,effectiveTo:null}});
    if(!current || current.ownerType!==expected || current.effectiveFrom>=at)throw new UnprocessableEntityException('OWNER_EVIDENCE_CONFLICT');
    await tx.qualificationOwnerInterval.update({where:{ownerIntervalId:current.ownerIntervalId},data:{effectiveTo:at,closedRecordedAt:new Date()}});
    await tx.qualificationOwnerInterval.create({data:{qualificationId,ownerType:next.personId?'MEMBER':'COMPANY',...next,effectiveFrom:at,sourceType:type,sourceId:workflowId,
      evidenceHash:treeHash({qualificationId,workflowId,type,effectiveFrom:at.toISOString(),previousOwnerIntervalId:current.ownerIntervalId,...next})}});
  }
}
