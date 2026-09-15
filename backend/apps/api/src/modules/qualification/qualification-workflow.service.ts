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

  async approve(workflowId:string,requestedEffectiveAt?:Date){
    return this.prisma.$transaction(async tx=>{
      const wf=await tx.qualificationWorkflow.findUniqueOrThrow({
        where:{qualificationWorkflowId:workflowId}
      });
      if(wf.status!=='SUBMITTED')
        throw new UnprocessableEntityException('Workflow is not SUBMITTED');

      const payload=(wf.payload ?? {}) as any;
      if(payload.reviewFeePaid !== true)
        throw new UnprocessableEntityException('NT$600 review fee must be confirmed before approval');

      const approvedAt=new Date();
      const effectiveAt=requestedEffectiveAt ?? approvedAt;
      if(effectiveAt < approvedAt)
        throw new UnprocessableEntityException('Workflow effectiveAt cannot be backdated before approval');

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

      if(wf.workflowType==='EXIT'){
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

      return tx.qualificationWorkflow.update({
        where:{qualificationWorkflowId:workflowId},
        data:{status:'EFFECTIVE',approvedAt,effectiveAt}
      });
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
