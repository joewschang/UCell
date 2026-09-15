import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { CreatePersonDto } from './dto/create-person.dto';
import { PersonService } from './person.service';

@ApiTags('Admin - Person')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/persons')
export class PersonController {
  constructor(private readonly service: PersonService) {}

  @Post()
  @UseGuards(IdempotencyGuard)
  @ApiOperation({ operationId: 'adminCreatePerson', summary: '建立 Person 草稿' })
  async create(
    @Body() dto: CreatePersonDto,
    @Headers('idempotency-key') key: string,
    @Req() req: any,
  ) {
    const result = await this.service.create(dto, key, req.requestId, req.user?.userId);
    return { data: result.value, meta: { replayed: result.replayed } };
  }

  @Get()
  @ApiOperation({ operationId: 'adminSearchPersons', summary: '搜尋 Person' })
  async search(@Query('q') q?: string, @Query('take') take?: string) {
    return { data: await this.service.search(q, Number(take ?? 20)) };
  }

  @Get(':personId')
  @ApiOperation({ operationId: 'adminGetPerson', summary: '取得 Person' })
  async get(@Param('personId') personId: string) {
    return { data: await this.service.get(personId) };
  }
}
