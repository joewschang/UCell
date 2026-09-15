import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async listPv(qualificationId: string, take = 50) {
    return this.prisma.pvLedger.findMany({
      where: { qualificationId },
      orderBy: [{ occurredAt: 'desc' }, { recordedAt: 'desc' }],
      take: Math.min(Math.max(take, 1), 200),
    });
  }

  async balances(qualificationId: string) {
    const rows = await this.prisma.pvLedger.groupBy({
      by: ['pvType'],
      where: { qualificationId },
      _sum: { amount: true },
    });
    return rows.map(r => ({ pvType: r.pvType, amount: r._sum.amount?.toString() ?? '0' }));
  }
}
