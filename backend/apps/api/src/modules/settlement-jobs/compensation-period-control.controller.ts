import {Controller,Get,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiQuery,ApiResponse,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {CompensationPeriodControlService} from './compensation-period-control.service';
class PeriodIdentityDto{@ApiProperty() periodStart!:string;@ApiProperty() periodEnd!:string;@ApiProperty() ruleVersionCode!:string;}
class PeriodCheckpointDto{@ApiProperty() code!:string;@ApiProperty() label!:string;@ApiProperty() status!:string;@ApiProperty() evidence!:string;}
class PeriodJobDto{@ApiProperty() jobReference!:string;@ApiProperty() kind!:string;@ApiProperty() status!:string;@ApiProperty() attemptCount!:number;@ApiProperty({nullable:true}) completedAt!:string|null;@ApiProperty({nullable:true}) blockingCode!:string|null;}
class PeriodSettlementDto{@ApiProperty() kind!:string;@ApiProperty() status!:string;@ApiProperty() totalTheory!:string;@ApiProperty() poolAvailable!:string;@ApiProperty() kFactor!:string;@ApiProperty({nullable:true}) finalizedAt!:string|null;}
class PeriodAmountBridgeDto{@ApiProperty() grossTheory!:string;@ApiProperty() awardAfterEligibilityAndK!:string;@ApiProperty() companyReservoirB!:string;@ApiProperty() recoveryRequired!:string;@ApiProperty() recoveryOutstanding!:string;@ApiProperty() payableMaterialized!:string;@ApiProperty() payoutGross!:string;@ApiProperty() payoutRecoveryOffset!:string;@ApiProperty() payoutNet!:string;@ApiProperty() bankPaid!:string;@ApiProperty({nullable:true}) erpAccountingProjection!:string|null;}
class PeriodPayoutDto{@ApiProperty() payoutReference!:string;@ApiProperty() status!:string;@ApiProperty() totalGross!:string;@ApiProperty() totalRecovery!:string;@ApiProperty() totalNet!:string;@ApiProperty({type:'array',items:{type:'object',additionalProperties:true}}) approvals!:Record<string,unknown>[];@ApiProperty({type:'object',nullable:true,additionalProperties:true}) latestExport!:Record<string,unknown>|null;@ApiProperty({type:'object',properties:{paid:{type:'integer'},failed:{type:'integer'}}}) paymentResults!:{paid:number;failed:number};}
class PeriodBlockingDto{@ApiProperty() reference!:string;@ApiProperty() code!:string;@ApiProperty() status!:string;}
class PeriodFreshnessDto{@ApiProperty() status!:string;@ApiProperty() projectedAt!:string;@ApiProperty() dataThrough!:string;}
class PeriodAuthorityDto{@ApiProperty() ucell!:string;@ApiProperty() erp!:string;@ApiProperty() hardClose!:string;}
class CompensationPeriodControlDto{@ApiProperty({type:PeriodIdentityDto}) period!:PeriodIdentityDto;@ApiProperty() lifecycle!:string;@ApiProperty() dataThrough!:string;@ApiProperty({type:[PeriodCheckpointDto]}) checkpoints!:PeriodCheckpointDto[];@ApiProperty({type:[PeriodJobDto]}) jobs!:PeriodJobDto[];@ApiProperty({type:[PeriodSettlementDto]}) settlements!:PeriodSettlementDto[];@ApiProperty({type:PeriodAmountBridgeDto}) amountBridge!:PeriodAmountBridgeDto;@ApiProperty({type:[PeriodPayoutDto]}) payouts!:PeriodPayoutDto[];@ApiProperty({type:[PeriodBlockingDto]}) blockingExceptions!:PeriodBlockingDto[];@ApiProperty({type:PeriodFreshnessDto}) freshness!:PeriodFreshnessDto;@ApiProperty({type:PeriodAuthorityDto}) authority!:PeriodAuthorityDto;}
class CompensationPeriodEnvelopeDto{@ApiProperty({type:CompensationPeriodControlDto}) data!:CompensationPeriodControlDto;}
@ApiTags('Admin - Compensation Period Control')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/compensation-period-control')
export class CompensationPeriodControlController{
 constructor(private readonly service:CompensationPeriodControlService){}
 @Get()
 @ApiOperation({operationId:'adminCompensationPeriodControl',summary:'獎金與會員經濟營運控制中心',description:'Read-only control view over authoritative UCell compensation facts. FINANCIALLY_RECONCILED does not mean the ERP accounting month is closed.'})
 @ApiQuery({name:'periodStart',required:true,description:'ISO-8601 inclusive compensation period start'})
 @ApiQuery({name:'periodEnd',required:true,description:'ISO-8601 exclusive compensation period end'})
 @ApiQuery({name:'ruleVersionCode',required:true})
 @ApiOkResponse({type:CompensationPeriodEnvelopeDto})
 @ApiResponse({status:400,description:'Invalid period or rule version'})
 @ApiResponse({status:401,description:'Admin authentication required'})
 @ApiResponse({status:403,description:'Finance or compliance role required'})
 read(@Query('periodStart') periodStart:string,@Query('periodEnd') periodEnd:string,@Query('ruleVersionCode') ruleVersionCode:string){return this.service.read({periodStart,periodEnd,ruleVersionCode}).then(data=>({data}));}
}
