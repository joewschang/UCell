import { Injectable } from '@nestjs/common';
import { PrismaService, matureBonusAward } from '@ucell/database';

@Injectable()
export class BonusLifecycleService {
  constructor(private readonly prisma:PrismaService){}

  async matureDueAwards(now=new Date()){
    const awards=await this.prisma.bonusAward.findMany({
      where:{pendingUntil:{lte:now}},
      take:500
    });

    let matured=0;
    for(const award of awards){
      if(await matureBonusAward(this.prisma,award.bonusAwardId,now)) matured++;
    }
    return {matured};
  }
}
