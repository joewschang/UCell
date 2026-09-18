import {Controller,Get,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiResponse,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {AdminProviderOperationsService} from './admin-provider-operations.service';

@ApiTags('Admin - Provider Reconciliation')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/provider-operations/reconciliation')
export class AdminProviderReconciliationController{
  constructor(private readonly service:AdminProviderOperationsService){}
  @Get('health')
  @ApiOperation({operationId:'adminProviderReconciliationHealth',summary:'Provider reconciliation health from authoritative persisted runs'})
  @ApiOkResponse({description:'Safe aggregate health without evidence references or monetary interpretation'})
  health(){return this.service.reconciliationHealth().then(data=>({data}));}
  @Get('exceptions')
  @ApiOperation({operationId:'adminProviderReconciliationExceptions',summary:'Bounded reconciliation discrepancy and failure queue'})
  @ApiOkResponse({description:'Safe exception rows; excludes provider batch and stored evidence references'})
  @ApiResponse({status:400,description:'Invalid filter or limit'})
  @ApiResponse({status:401,description:'Admin authentication required'})
  @ApiResponse({status:403,description:'Operational, finance or compliance role required'})
  exceptions(@Query('domain') domain?:string,@Query('provider') provider?:string,@Query('status') status?:string,@Query('take') take?:string){return this.service.reconciliationExceptions({domain,provider,status,take:take===undefined?undefined:Number(take)}).then(data=>({data}));}
}