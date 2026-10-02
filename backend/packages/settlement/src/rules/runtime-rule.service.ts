import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';

@Injectable()
export class RuntimeRuleService {
  constructor(private readonly prisma: PrismaService) {}

  async decimal(
    parameterCode:string,
    scopeKey='*',
    at=new Date(),
    ruleVersionCode='R1.0B',
    tx?:Prisma.TransactionClient,
  ):Promise<Prisma.Decimal>{
    const db=tx ?? this.prisma;
    const row=await db.runtimeRuleParameter.findFirst({
      where:{
        ruleVersionCode,parameterCode,scopeKey,
        effectiveFrom:{lte:at},
        OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]
      },
      orderBy:{effectiveFrom:'desc'}
    });
    if(!row) throw new Error(`Missing runtime parameter ${parameterCode}/${scopeKey}`);
    return new Prisma.Decimal(String(row.valueJson));
  }

  async integer(
    parameterCode:string,
    scopeKey='*',
    at=new Date(),
    ruleVersionCode='R1.0B',
    tx?:Prisma.TransactionClient,
  ):Promise<number>{
    const v=await this.decimal(parameterCode,scopeKey,at,ruleVersionCode,tx);
    return Number(v.toString());
  }
}
