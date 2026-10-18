import { Injectable } from '@nestjs/common';
import { PrismaService, matureDueBonusAwards } from '@ucell/database';
@Injectable()
export class BonusLifecycleService {
  constructor(private readonly prisma:PrismaService){}
  async matureDueAwards(now=new Date()){
    return matureDueBonusAwards(this.prisma,now);
  }
}
