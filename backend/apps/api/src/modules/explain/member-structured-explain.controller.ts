import { structuredEnvelopeSchema } from './evidence-envelope.schema';
import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ExplainTool } from '@ucell/shared';
import { MemberAuthenticationGuard } from '../auth/member-authentication.guard';
import { MemberContextGuard } from '../member/member-context.guard';
import { MemberExplainRequest } from '../member/member-explain.service';
import { MemberStructuredExplainService } from './member-structured-explain.service';
const memberTools = ['getActiveStatus','explainActive','explainPerformance','explainBinaryCarry','explainAward','explainSettlement','explainPayout','explainReturnImpact'];
export class StructuredExplainQuery {
  @ApiProperty({format:'uuid'}) @IsUUID() qualificationId!: string;
  @ApiProperty({enum:memberTools}) @IsIn(memberTools) tool!: ExplainTool;
  @ApiPropertyOptional({format:'uuid'}) @IsOptional() @IsUUID() resourceId?: string;
  @ApiProperty({enum:['Asia/Taipei']}) @IsIn(['Asia/Taipei']) timezone!: 'Asia/Taipei';
  @ApiProperty({format:'date-time'}) @IsString() asOf!: string;
  @ApiProperty({format:'date-time'}) @IsString() periodStart!: string;
  @ApiProperty({format:'date-time'}) @IsString() periodEnd!: string;
  @ApiProperty({format:'date-time'}) @IsString() knowledgeCutoff!: string;
}
@ApiTags('Member - Explain') @ApiBearerAuth('memberBearer')
@UseGuards(MemberAuthenticationGuard,MemberContextGuard)
@Controller('member/explain')
export class MemberStructuredExplainController {
  constructor(private readonly service:MemberStructuredExplainService) {}
  @Get('structured') @Header('Cache-Control','no-store')
  @ApiOperation({operationId:'memberStructuredExplain',description:'Versioned stored evidence with explicit Taipei effective and recorded-time bounds. Unprovable historical facts return UNAVAILABLE. No money calculation or external AI provider.'})
  @ApiResponse({status:200,schema:{type:'object',properties:{data:structuredEnvelopeSchema}},description:'EvidenceEnvelope: AVAILABLE/VERIFIED or UNAVAILABLE with null result. No raw PII or secret fields.'})
  @ApiResponse({status:400,description:'INVALID_QUERY'}) @ApiResponse({status:403,description:'DENIED'})
  @ApiResponse({status:409,description:'CONTEXT_CHANGED'}) @ApiResponse({status:503,description:'SOURCE_UNAVAILABLE or INVALID_EVIDENCE'})
  read(@Req() request:MemberExplainRequest,@Query() input:StructuredExplainQuery) {
    const {qualificationId,resourceId,tool,...time} = input;
    return this.service.explain(request,tool,{qualificationId,...(resourceId?{resourceId}:{}),time});
  }
}
