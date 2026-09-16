import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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
    const result = await this.service.create(dto, key, req.requestId, req.user?.personId);
    return { data: result.value, meta: { replayed: result.replayed } };
  }

  @Get()
  @ApiOperation({ operationId: 'adminSearchPersons', summary: '搜尋 Person' })
  async search(@Query('q') q?: string, @Query('take') take?: string) {
    return { data: await this.service.search(q, Number(take ?? 20)) };
  }

  @Get(':personId/qualifications')
  @ApiOperation({ operationId: 'adminListPersonQualifications', summary: 'Person 的目前持有資格（1:N）', description: 'Read-only exact currentHolderPersonId filter. Includes every existing status; does not infer Active or historical ownership. Same Person administration roles. Stable createdAt descending / qualificationId ascending ordering.' })
  @ApiParam({ name: 'personId', format: 'uuid' })
  @ApiQuery({ name: 'take', required: false, type: Number, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: 'skip', required: false, type: Number, schema: { type: 'integer', minimum: 0, default: 0 } })
  @ApiResponse({ status: 200, schema: { type: 'object', required: ['data', 'meta'], properties: {
    data: { type: 'array', items: { type: 'object', required: ['qualificationId', 'currentHolderPersonId', 'qualificationNo', 'planLevelCode', 'status', 'activeFlag'], properties: {
      qualificationId: { type: 'string', format: 'uuid' }, currentHolderPersonId: { type: 'string', format: 'uuid' }, qualificationNo: { type: 'string', description: 'Core BigInt serialized as decimal string' }, planLevelCode: { type: 'string' }, status: { type: 'string', description: 'Existing Core RecordStatus; no frontend status inference' }, activeFlag: { type: 'boolean' }, effectiveAt: { type: 'string', format: 'date-time', nullable: true }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
    } } }, meta: { type: 'object', properties: { total: { type: 'integer' }, take: { type: 'integer' }, skip: { type: 'integer' } } },
  } } })
  @ApiResponse({ status: 401, description: 'Admin authentication required' })
  @ApiResponse({ status: 403, description: 'Existing Person role policy denies access' })
  @ApiResponse({ status: 404, description: 'PERSON_NOT_FOUND' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR: invalid UUID or pagination' })
  async qualifications(@Param('personId') personId: string, @Query('take') take?: string, @Query('skip') skip?: string) {
    return this.service.qualifications(personId, take === undefined ? 20 : Number(take), skip === undefined ? 0 : Number(skip));
  }

  @Get(':personId')
  @ApiOperation({ operationId: 'adminGetPerson', summary: '取得 Person' })
  async get(@Param('personId') personId: string) {
    return { data: await this.service.get(personId) };
  }
}
