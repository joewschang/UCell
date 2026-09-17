import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

const DOMAINS = ['PAYMENT','INVOICE','LOGISTICS'] as const;
const STATUSES = ['RECEIVED','VERIFIED','REJECTED','PROCESSING','PROCESSED','RETRY_PENDING','MANUAL_REVIEW'] as const;
type Domain = typeof DOMAINS[number];
type Status = typeof STATUSES[number];

@Injectable()
export class AdminProviderOperationsService {
  constructor(private readonly prisma:PrismaService){}

  async health(now=new Date()){
    const dueWhere={OR:[{status:'RECEIVED' as const},{status:'VERIFIED' as const},{status:'RETRY_PENDING' as const,nextAttemptAt:{lte:now}}]};
    const [total,byStatus,byDomain,byProvider,dueBacklog,expiredLeases,manualReview,oldestDue]=await Promise.all([
      this.prisma.providerWebhookInbox.count(),
      this.prisma.providerWebhookInbox.groupBy({by:['status'],_count:{_all:true}}),
      this.prisma.providerWebhookInbox.groupBy({by:['domain'],_count:{_all:true}}),
      this.prisma.providerWebhookInbox.groupBy({by:['domain','provider'],_count:{_all:true}}),
      this.prisma.providerWebhookInbox.count({where:dueWhere}),
      this.prisma.providerWebhookInbox.count({where:{status:'PROCESSING',leaseExpiresAt:{lte:now}}}),
      this.prisma.providerWebhookInbox.count({where:{status:'MANUAL_REVIEW'}}),
      this.prisma.providerWebhookInbox.findFirst({where:dueWhere,orderBy:{receivedAt:'asc'},select:{receivedAt:true}}),
    ]);
    const state=expiredLeases>0?'CRITICAL':manualReview>0||dueBacklog>0?'DEGRADED':'HEALTHY';
    return {
      generatedAt:now.toISOString(),state,total,dueBacklog,expiredLeases,manualReview,
      oldestDueReceivedAt:oldestDue?.receivedAt.toISOString()??null,
      counts:{
        byStatus:Object.fromEntries(byStatus.map(row=>[row.status,row._count._all])),
        byDomain:Object.fromEntries(byDomain.map(row=>[row.domain,row._count._all])),
        byProvider:byProvider.map(row=>({domain:row.domain,provider:row.provider,count:row._count._all})),
      },
    };
  }

  async backlog(input:{domain?:string;provider?:string;status?:string;take?:number}={},now=new Date()){
    const domain=input.domain?parseEnum(input.domain,DOMAINS,'PROVIDER_WEBHOOK_DOMAIN_INVALID'):undefined;
    const status=input.status?parseEnum(input.status,STATUSES,'PROVIDER_WEBHOOK_STATUS_INVALID'):undefined;
    const provider=input.provider?.trim();
    if(input.provider!==undefined&&(!provider||provider.length>100)) throw new BadRequestException('PROVIDER_WEBHOOK_PROVIDER_INVALID');
    const take=Number.isFinite(input.take)?Math.trunc(input.take!):50;
    if(take<1||take>200) throw new BadRequestException('PROVIDER_WEBHOOK_TAKE_INVALID');
    const rows=await this.prisma.providerWebhookInbox.findMany({
      where:{
        ...(domain?{domain}:{}),...(provider?{provider}:{}),...(status?{status}:{}),
        status:status??{in:['RECEIVED','VERIFIED','PROCESSING','RETRY_PENDING','MANUAL_REVIEW']},
      },
      orderBy:[{receivedAt:'asc'},{providerWebhookInboxId:'asc'}],take:take+1,
      select:{providerWebhookInboxId:true,domain:true,provider:true,connectionId:true,status:true,attemptCount:true,lastErrorCode:true,receivedAt:true,verifiedAt:true,processedAt:true,nextAttemptAt:true,leaseExpiresAt:true,correlationId:true},
    });
    return {generatedAt:now.toISOString(),items:rows.slice(0,take).map(row=>({
      ...row,receivedAt:row.receivedAt.toISOString(),verifiedAt:row.verifiedAt?.toISOString()??null,
      processedAt:row.processedAt?.toISOString()??null,nextAttemptAt:row.nextAttemptAt?.toISOString()??null,
      leaseExpiresAt:row.leaseExpiresAt?.toISOString()??null,
      due:['RECEIVED','VERIFIED'].includes(row.status)||(row.status==='RETRY_PENDING'&&!!row.nextAttemptAt&&row.nextAttemptAt<=now),
      leaseExpired:row.status==='PROCESSING'&&!!row.leaseExpiresAt&&row.leaseExpiresAt<=now,
    })),limit:take,truncated:rows.length>take};
  }
}

function parseEnum<T extends readonly string[]>(value:string,values:T,code:string):T[number]{
  if(!(values as readonly string[]).includes(value)) throw new BadRequestException(code);
  return value as T[number];
}
