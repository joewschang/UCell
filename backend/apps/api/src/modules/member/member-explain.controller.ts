import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { MemberAuthenticationGuard } from '../auth/member-authentication.guard';
import { MemberContextGuard } from './member-context.guard';
import { MemberExplainRequest, MemberExplainService } from './member-explain.service';

export class MemberExplainActiveQuery {
  @ApiProperty({ format: 'uuid', description: 'Explicit selected Ball; current ownership is checked server-side before and after reading.' })
  @IsUUID() qualificationId!: string;
}
export class MemberExplainCarryQuery extends MemberExplainActiveQuery {
  @ApiProperty({ format: 'uuid', description: 'Exact original FINALIZED BINARY_K1 batch; not latest corrected Carry or inferred tree scope.' })
  @IsUUID() settlementBatchId!: string;
}
const resultSchema = {
  type: 'object', required: ['status', 'finality', 'scope', 'updatedAt', 'definitionKey', 'definitionVersion', 'ruleVersion', 'parameterVersion', 'classification', 'evidenceRefs', 'result'],
  properties: {
    status: { type: 'string', enum: ['AVAILABLE'] }, finality: { type: 'string', enum: ['FINALIZED', 'NOT_APPLICABLE'] },
    scope: { type: 'object', additionalProperties: false, required: ['qualificationId'], properties: { qualificationId: { type: 'string', format: 'uuid' }, settlementBatchId: { type: 'string', format: 'uuid' } } },
    periodEnd: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
    definitionKey: { type: 'string' }, definitionVersion: { type: 'string' }, ruleVersion: { type: 'string' }, parameterVersion: { type: 'string' },
    classification: { type: 'string', enum: ['MEMBER_SELF'] },
    evidenceRefs: { type: 'array', maxItems: 100, items: { type: 'object', required: ['type', 'id', 'revision'], properties: { type: { type: 'string' }, id: { type: 'string' }, revision: { type: 'string' } } } },
    result: { type: 'object', description: 'Active: active boolean, ownerType MEMBER, reasonCode THRESHOLD_MET. Carry: leftCarry/rightCarry exact decimal strings.' },
  },
};
const activeResultSchema = { ...resultSchema, properties: { ...resultSchema.properties,
  definitionKey: { type: 'string', enum: ['active.status'] }, finality: { type: 'string', enum: ['NOT_APPLICABLE'] },
  result: { type: 'object', additionalProperties: false, required: ['active', 'ownerType', 'reasonCode'], properties: {
    active: { type: 'boolean', enum: [true] }, ownerType: { type: 'string', enum: ['MEMBER'] }, reasonCode: { type: 'string', enum: ['THRESHOLD_MET'] },
  } },
} };
const carryResultSchema = { ...resultSchema, required: [...resultSchema.required, 'periodEnd'], properties: { ...resultSchema.properties,
  definitionKey: { type: 'string', enum: ['binary.settlement_carry'] }, finality: { type: 'string', enum: ['FINALIZED'] },
  scope: { ...resultSchema.properties.scope, required: ['qualificationId', 'settlementBatchId'] },
  result: { type: 'object', additionalProperties: false, required: ['leftCarry', 'rightCarry'], properties: {
    leftCarry: { type: 'string', pattern: '^(0|[1-9][0-9]{0,17})(\\.[0-9]{1,8})?$' },
    rightCarry: { type: 'string', pattern: '^(0|[1-9][0-9]{0,17})(\\.[0-9]{1,8})?$' },
  } },
} };
@ApiTags('Member - Explain') @ApiBearerAuth('memberBearer')
@UseGuards(MemberAuthenticationGuard, MemberContextGuard)
@ApiResponse({ status: 400, description: 'INVALID_QUERY; unsupported fields/time modes rejected' })
@ApiResponse({ status: 401, description: 'Member authentication required' })
@ApiResponse({ status: 403, description: 'DENIED; selected Ball is not authorized' })
@ApiResponse({ status: 409, description: 'CONTEXT_CHANGED; suppress obsolete results' })
@ApiResponse({ status: 422, description: 'HISTORICAL_UNAVAILABLE; authoritative evidence absent or unsupported' })
@ApiResponse({ status: 503, description: 'INVALID_EVIDENCE or SOURCE_UNAVAILABLE; no fallback' })
@ApiResponse({ status: 504, description: 'TIMEOUT; no result released' })
@Controller('member/explain')
export class MemberExplainController {
  constructor(private readonly service: MemberExplainService) {}
  @Get('active') @Header('Cache-Control', 'no-store') @ApiOperation({ operationId: 'memberExplainActive', description: 'Current positive Active with a verified v3 consumption evidence chain. Absence is unavailable, not an inferred inactive/zero result.' })
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { data: activeResultSchema } } })
  active(@Req() request: MemberExplainRequest, @Query() query: MemberExplainActiveQuery) { return this.service.explain(request, 'getActiveStatus', query); }
  @Get('binary-carry') @Header('Cache-Control', 'no-store') @ApiOperation({ operationId: 'memberExplainBinaryCarry', description: 'Original sealed batch Carry, exact decimal strings. Does not infer tree identity or substitute current/replayed totals.' })
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { data: carryResultSchema } } })
  carry(@Req() request: MemberExplainRequest, @Query() query: MemberExplainCarryQuery) { return this.service.explain(request, 'explainBinarySettlementCarry', query); }
}
