import { ConflictException, Injectable,UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { randomUUID } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

function monthStart(date:Date){
  return new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1));
}
function addMonths(date:Date,n:number){
  return new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+n,1));
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly idempotency:IdempotencyService,
    private readonly audit:AuditService,
  ){}

  async listPlans(){
    return this.prisma.subscriptionPlan.findMany({where:{isActive:true},orderBy:{durationMonths:'asc'}});
  }
  async list(input:{status?:string;qualificationId?:string;take?:number}={}){
    if(input.status&&!['PENDING','ACTIVE','SUSPENDED','CANCELLED','COMPLETED'].includes(input.status))throw new UnprocessableEntityException({code:'INVALID_SUBSCRIPTION_STATUS'});
    if(input.qualificationId&&!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.qualificationId))throw new UnprocessableEntityException({code:'INVALID_QUALIFICATION_ID'});
    if(input.take!==undefined&&(!Number.isInteger(input.take)||input.take<1))throw new UnprocessableEntityException({code:'INVALID_PAGE_LIMIT'});
    return this.prisma.subscription.findMany({where:{...(input.status?{status:input.status as any}:{}),...(input.qualificationId?{qualificationId:input.qualificationId}:{})},include:{plan:true},orderBy:[{createdAt:'desc'},{subscriptionId:'desc'}],take:Math.min(input.take??100,200)});
  }

  async create(dto:CreateSubscriptionDto,key:string,requestId:string,actorId?:string){
    const correlationId=randomUUID();
    return this.idempotency.execute(`admin:subscription:create:${dto.qualificationId}`,key,dto,async tx=>{
      const [q,plan]=await Promise.all([
        tx.qualification.findUnique({where:{qualificationId:dto.qualificationId}}),
        tx.subscriptionPlan.findUnique({where:{planCode:dto.planCode}})
      ]);
      if(!q || q.status!=='EFFECTIVE') throw new ConflictException({code:'RESOURCE_NOT_FOUND',message:'Qualification不存在或未生效。'});
      if(!plan || !plan.isActive) throw new ConflictException({code:'RESOURCE_NOT_FOUND',message:'重銷方案不存在或未啟用。'});

      const start=monthStart(new Date(dto.startMonth));
      const end=addMonths(start,plan.durationMonths-1);

      const subscription=await tx.subscription.create({
        data:{
          qualificationId:dto.qualificationId,
          subscriptionPlanId:plan.subscriptionPlanId,
          orderId:dto.orderId,
          status:'ACTIVE',
          startMonth:start,
          endMonth:end,
          ruleVersionCode:'R1.0B',
          activatedAt:new Date()
        }
      });

      for(let i=0;i<plan.durationMonths;i++){
        const recognitionMonth=addMonths(start,i);
        const dueAt=new Date(Date.UTC(recognitionMonth.getUTCFullYear(),recognitionMonth.getUTCMonth(),1,0,0,0));
        await tx.monthlyRecognitionSchedule.create({
          data:{
            subscriptionId:subscription.subscriptionId,
            installmentNo:i+1,
            recognitionMonth,
            recognizedAmount:plan.monthlyRecognizedAmount,
            rpvAmount:plan.monthlyRpv,
            status:'SCHEDULED',
            dueAt,
            ruleVersionCode:'R1.0B'
          }
        });
      }

      await this.audit.write(tx,{
        actorType:actorId?'USER':'SYSTEM',actorId,
        action:'SUBSCRIPTION_CREATED',
        entityType:'SUBSCRIPTION',entityId:subscription.subscriptionId,
        afterData:{
          qualificationId:dto.qualificationId,
          planCode:dto.planCode,
          months:plan.durationMonths,
          monthlyRecognizedAmount:plan.monthlyRecognizedAmount.toString(),
          monthlyRpv:plan.monthlyRpv.toString()
        },
        requestId,correlationId
      });

      return tx.subscription.findUniqueOrThrow({
        where:{subscriptionId:subscription.subscriptionId},
        include:{plan:true,schedules:{orderBy:{installmentNo:'asc'}}}
      });
    });
  }

  async get(id:string){
    return this.prisma.subscription.findUniqueOrThrow({
      where:{subscriptionId:id},
      include:{plan:true,schedules:{orderBy:{installmentNo:'asc'}}}
    });
  }
}
