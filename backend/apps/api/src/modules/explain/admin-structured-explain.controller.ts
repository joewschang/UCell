import { structuredEnvelopeSchema } from './evidence-envelope.schema';
import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { AdminExplainRequest, AdminStructuredExplainService } from './admin-structured-explain.service';
export class ReservoirExplainQuery {
 @ApiProperty({enum:['explainReservoirA','explainReservoirB']}) @IsIn(['explainReservoirA','explainReservoirB']) tool!: 'explainReservoirA'|'explainReservoirB';
 @ApiProperty({format:'uuid'}) @IsUUID() resourceId!:string;
 @ApiProperty({enum:['Asia/Taipei']}) @IsIn(['Asia/Taipei']) timezone!: 'Asia/Taipei';
 @ApiProperty({format:'date-time'}) @IsString() asOf!:string;
 @ApiProperty({format:'date-time'}) @IsString() periodStart!:string;
 @ApiProperty({format:'date-time'}) @IsString() periodEnd!:string;
 @ApiProperty({format:'date-time'}) @IsString() knowledgeCutoff!:string;
}
@ApiTags('Admin - Explain') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/explain')
export class AdminStructuredExplainController {
 constructor(private readonly service:AdminStructuredExplainService){}
 @Get('reservoir') @Header('Cache-Control','no-store')
 @ApiOperation({operationId:'adminExplainReservoir',description:'Stored Reservoir A accrual/correction, requires live Entra finance/audit grant. Reservoir B reads immutable Company Core final entitlement, original LEADER binding and signed replay effect; no frontend recomputation.'})
 @ApiResponse({status:200,schema:{type:'object',properties:{data:structuredEnvelopeSchema}},description:'EvidenceEnvelope with stored source or explicit UNAVAILABLE; no withdrawal or monetary calculation.'})
 @ApiResponse({status:403,description:'DENIED, including revoked grant and development bypass principals'})
 read(@Req() request:AdminExplainRequest,@Query() input:ReservoirExplainQuery){const {tool,resourceId,...time}=input;return this.service.explain(request,tool,{resourceId,time});}
}
