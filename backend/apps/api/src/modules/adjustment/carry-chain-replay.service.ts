import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, pending, replayReturnDependencies } from '@ucell/database';
import { SettlementReplayService } from './settlement-replay.service';
@Injectable()
export class CarryChainReplayService {
  constructor(private readonly prisma:PrismaService,private readonly replay:SettlementReplayService){}
  async runForReturn(returnCaseId:string,maxWeeks=260,ruleVersionCode='R1.0B') {
    if(!Number.isInteger(maxWeeks)||maxWeeks<1||maxWeeks>260) pending('INVALID_REPLAY_HORIZON','Replay horizon must be integer 1..260');
    return this.prisma.$transaction(async tx=>{
      const ret=await tx.returnCase.findUnique({where:{returnCaseId},include:{order:true}});
      if(ret&&ret.order.ruleVersionCode!==ruleVersionCode) pending('RULE_VERSION_MISMATCH','Replay must use original transaction version');
      return replayReturnDependencies(tx,returnCaseId,maxWeeks);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:60000});
  }
}
