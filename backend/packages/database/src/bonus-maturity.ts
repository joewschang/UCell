import {PrismaClient} from '@prisma/client';

/** Exclude append-only terminal history before limiting a polling batch.
 * The locked latest-status check remains authoritative under concurrency. */
export async function matureDueBonusAwards(db:PrismaClient,now:Date){
  const awards=await db.bonusAward.findMany({
    where:{pendingUntil:{lte:now},lifecycleEvents:{some:{status:'PENDING_45D'},none:{status:{notIn:['CALCULATED','PENDING_45D']}}}},
    orderBy:[{pendingUntil:'asc'},{bonusAwardId:'asc'}],take:500
  });
  let matured=0;
  for(const award of awards)if(await matureBonusAward(db,award.bonusAwardId,now))matured++;
  return {matured};
}

/** Append one EFFECTIVE transition under ownership shared by API and worker. */
export async function matureBonusAward(db:PrismaClient,bonusAwardId:string,now:Date):Promise<boolean>{
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT bonus_award_id FROM ledger.bonus_award WHERE bonus_award_id=${bonusAwardId}::uuid FOR UPDATE`;
    // Initial CALCULATED/PENDING rows can share one millisecond. Do not use
    // timestamp ordering to decide which initial state wins. Any subsequent
    // append-only transition prevents a second EFFECTIVE, even on replay.
    if(await tx.bonusAwardLifecycleEvent.count({where:{bonusAwardId,status:{notIn:['CALCULATED','PENDING_45D']}}}))return false;
    const latest=await tx.bonusAwardLifecycleEvent.findFirst({where:{bonusAwardId,status:'PENDING_45D'},orderBy:{occurredAt:'desc'}});
    if(latest?.status!=='PENDING_45D') return false;
    await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId,status:'EFFECTIVE',occurredAt:now}});
    return true;
  });
}
