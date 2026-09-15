import { Controller, Get, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('System')
@Controller('health')
class HealthController {
  @Get()
  @ApiOperation({ summary: 'Service health check' })
  health() {
    return {
      data: { status: 'ok', service: 'ucell-backend', ruleBaseline: 'R1.0B FROZEN' },
      meta: { timestamp: new Date().toISOString() },
    };
  }
}

@Module({ controllers: [HealthController] })
export class AppModule {}
