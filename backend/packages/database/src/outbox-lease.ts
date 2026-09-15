import {Prisma, PrismaClient} from '@prisma/client';
import {consumeReplayOutbox} from './historical-replay';

export interface OutboxLease {outboxEventId:string;attemptCount:number;availableAt:Date}
export async function claimOutboxLease(db:PrismaClient,event:{outboxEventId:string;processStatus:string;attemptCount:number;availableAt:Date},now=new Date(),leaseMs=120000):Promise<OutboxLease|null>{
  if(!['PENDING','PROCESSING'].includes(event.processStatus)||event.availableAt>now)return null;
  const availableAt=new Date(now.getTime()+leaseMs);
  const claim=await db.outboxEvent.updateMany({where:{outboxEventId:event.outboxEventId,processStatus:event.processStatus as Prisma.EnumEventProcessStatusFilter['equals'],attemptCount:event.attemptCount,availableAt:event.availableAt},data:{processStatus:'PROCESSING',attemptCount:{increment:1},availableAt}});
  return claim.count===1?{outboxEventId:event.outboxEventId,attemptCount:event.attemptCount+1,availableAt}:null;
}
export async function withOutboxLease<T>(db:PrismaClient,lease:OutboxLease,work:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T|{lostLease:true}>{
  return db.$transaction(async tx=>{
    // Row ownership is checked and retained through monetary posting and acknowledgement.
    await tx.$queryRaw`SELECT outbox_event_id FROM integration.outbox_event WHERE outbox_event_id=${lease.outboxEventId}::uuid FOR UPDATE`;
    const event=await tx.outboxEvent.findUnique({where:{outboxEventId:lease.outboxEventId}});
    if(!event||event.processStatus!=='PROCESSING'||event.attemptCount!==lease.attemptCount||event.availableAt.getTime()!==lease.availableAt.getTime()||event.availableAt<=new Date())return {lostLease:true};
    return work(tx);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:60000});
}
export async function processLeasedReplay(db:PrismaClient,lease:OutboxLease){return withOutboxLease(db,lease,tx=>consumeReplayOutbox(tx,lease.outboxEventId));}
export async function releaseFailedOutboxLease(db:PrismaClient,lease:OutboxLease,error:unknown,now=new Date()){
  const e=error as any;
  const message=e?.getResponse?JSON.stringify(e.getResponse()):error instanceof Error?error.message:String(error);
  return db.outboxEvent.updateMany({where:{outboxEventId:lease.outboxEventId,processStatus:'PROCESSING',attemptCount:lease.attemptCount,availableAt:lease.availableAt},data:{processStatus:lease.attemptCount>=10?'DEAD':'PENDING',lastError:message.slice(0,4000),availableAt:new Date(now.getTime()+30000)}});
}
