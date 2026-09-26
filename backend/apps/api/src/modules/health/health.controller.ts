import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return {
        status: 'ok', service: 'ucell-api', database: 'ok',
        release: process.env.RELEASE_GIT_HEAD ?? process.env.GITHUB_SHA ?? 'UNVERSIONED',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({code:'DATABASE_CONNECTIVITY_FAILED',message:'資料庫連線暫時不可用'});
    }
  }
}
