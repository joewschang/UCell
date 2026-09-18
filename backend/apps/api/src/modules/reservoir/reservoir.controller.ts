import {RESERVOIR_RESPONSE} from './reservoir-openapi';
import {PERIOD_ERROR_SCHEMA} from '../analytics/period-openapi';
import {Controller,Get,Header,Query,Req} from '@nestjs/common';
import {Type} from 'class-transformer';
import {ApiBearerAuth,ApiOperation,ApiProperty,ApiPropertyOptional,ApiResponse,ApiTags} from '@nestjs/swagger';
import {IsIn,IsOptional,IsString,IsUUID,IsInt,Min,Max} from 'class-validator';
import {Roles} from '../auth/roles.decorator';
import {TreePrincipal} from '../binary-tree/tree-authorization';
import {ReservoirService} from './reservoir.service';
export class ReservoirQuery{
 @ApiProperty({enum:['A','B']}) @IsIn(['A','B']) kind!:'A'|'B';
 @ApiProperty({enum:['Asia/Taipei']}) @IsIn(['Asia/Taipei']) timezone!:'Asia/Taipei';
 @ApiProperty({format:'date-time'}) @IsString() asOf!:string;
 @ApiProperty({format:'date-time'}) @IsString() knowledgeCutoff!:string;
 @ApiProperty({format:'date-time'}) @IsString() periodStart!:string;
 @ApiProperty({format:'date-time'}) @IsString() periodEnd!:string;
 @ApiPropertyOptional({format:'uuid',description:'B only'}) @IsOptional() @IsUUID() tree?:string;
 @ApiPropertyOptional({minimum:1,maximum:3,description:'B bootstrap position only'}) @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(3) position?:number;
 @ApiPropertyOptional({enum:['REFERRAL','EQUALIZATION','BINARY','MATCHING','RPV','EPV','GLOBAL']}) @IsOptional() @IsIn(['REFERRAL','EQUALIZATION','BINARY','MATCHING','RPV','EPV','GLOBAL']) awardType?:string;
 @ApiPropertyOptional({format:'uuid'}) @IsOptional() @IsUUID() after?:string;
 @ApiPropertyOptional({format:'uuid',description:'Required with after; fixed actor/role/query and MVCC visibility; expires after one hour.'}) @IsOptional() @IsUUID() snapshotToken?:string;
}
@ApiTags('Admin - Reservoir Center') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/finance/reservoirs')
export class ReservoirController{
 constructor(private readonly service:ReservoirService){}
 @Get() @Header('Cache-Control','no-store')
 @ApiOperation({operationId:'adminReadReservoirCenter',summary:'分開讀取 Reservoir A/B 權威分錄與期間／累積金額',description:'Finance-confidential immutable sources. Read-only; signed replay correction is not a payout. Stable UUID cursor within server snapshot. A rejects tree/position/awardType filters.'})
 @ApiResponse({status:200,description:'Snapshot-consistent posted ledger; STALE amounts are not a complete latest entitlement. Decimal TWD, at most 100 entries.',schema:RESERVOIR_RESPONSE as any})
 @ApiResponse({status:400,description:'DTO validation failed',schema:PERIOD_ERROR_SCHEMA as any})
 @ApiResponse({status:401,schema:PERIOD_ERROR_SCHEMA as any,description:'Session expired'})
 @ApiResponse({status:403,schema:PERIOD_ERROR_SCHEMA as any,description:'Live Entra Finance/Super Admin/Audit grant required; revoked or unauthorized role denied'})
 @ApiResponse({status:409,schema:PERIOD_ERROR_SCHEMA as any,description:'Missing, changed or expired pagination snapshot'})
 @ApiResponse({status:422,schema:PERIOD_ERROR_SCHEMA as any,description:'Invalid time context or unsupported filters'})
 async read(@Req() req:{user:TreePrincipal},@Query() input:ReservoirQuery){const {kind,tree,position,awardType,after,snapshotToken,...time}=input;return {data:await this.service.list(req.user,kind,{...time},{tree,position,awardType},after,snapshotToken)};}
}
