import {PrismaClient} from '@prisma/client';

/** Append one EFFECTIVE transition under ownership shared by API and worker. */
export async function matureBonusAward(db:PrismaClient,bonusAwardId:string,now:Date):Promise<boolean>{
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT bonus_award_id FROM ledger.bonus_award WHERE bonus_award_id=${bonusAwardId}::uuid FOR UPDATE`;
    const latest=await tx.bonusAwardLifecycleEvent.findFirst({where:{bonusAwardId},orderBy:{occurredAt:'desc'}});
    if(latest?.status!=='PENDING_45D') return false;
    await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId,status:'EFFECTIVE',occurredAt:now}});
    return true;
  });
}
