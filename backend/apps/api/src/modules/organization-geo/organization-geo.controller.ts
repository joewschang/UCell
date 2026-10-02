import {Controller,Get,Post,Header,Query,Req,UnprocessableEntityException} from '@nestjs/common';
import {ApiBearerAuth,ApiOperation,ApiProperty,ApiPropertyOptional,ApiResponse,ApiTags} from '@nestjs/swagger';
import {IsIn,IsOptional,IsString,IsUUID,IsInt,Min,Max,Matches} from 'class-validator';
import {Type} from 'class-transformer';
import {Roles} from '../auth/roles.decorator';
import {TreePrincipal,authorizeTreePrincipal} from '../binary-tree/tree-authorization';
import {PrismaService} from '@ucell/database';
import {GeoProfileService} from './geo-profile.service';
import {GeoQuery,OrganizationGeoService} from './organization-geo.service';

export class GeoQueryDto implements GeoQuery {
 @ApiPropertyOptional({description:'Immutable business Ball number; preferred over technical UUID.'}) @IsOptional() @Matches(/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6,}|\d{6,})$/) rootBallNo?:string;
 @ApiPropertyOptional({format:'uuid'}) @IsOptional() @IsUUID() rootQualificationId?:string;
 @ApiPropertyOptional({enum:['ALL','LEFT','RIGHT']}) @IsOptional() @IsIn(['ALL','LEFT','RIGHT']) side?:'ALL'|'LEFT'|'RIGHT';
 @ApiPropertyOptional({enum:['CITY','DISTRICT']}) @IsOptional() @IsIn(['CITY','DISTRICT']) level?:'CITY'|'DISTRICT';
 @ApiPropertyOptional() @IsOptional() @Matches(/^\d{5}$/) parentAreaCode?:string;
 @ApiPropertyOptional({enum:['BALLS','MEMBERS','ACTIVE_BALLS','NEW_BALLS','GPV']}) @IsOptional() @IsIn(['BALLS','MEMBERS','ACTIVE_BALLS','NEW_BALLS','GPV']) metric?:GeoQuery['metric'];
 @ApiProperty({format:'date-time',description:'Inclusive period start, canonical UTC ISO with milliseconds.'}) @IsString() dateFrom!:string;
 @ApiProperty({format:'date-time',description:'Exclusive period end.'}) @IsString() dateTo!:string;
 @ApiProperty({format:'date-time'}) @IsString() asOf!:string;
 @ApiProperty({format:'date-time'}) @IsString() knowledgeCutoff!:string;
 @ApiPropertyOptional({minimum:1,maximum:20}) @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(20) limit?:number;
 @ApiPropertyOptional({enum:['DAY','WEEK','MONTH']}) @IsOptional() @IsIn(['DAY','WEEK','MONTH']) interval?:'DAY'|'WEEK'|'MONTH';
}
class GeoRefreshQuery {
 @ApiPropertyOptional({format:'uuid'}) @IsOptional() @IsUUID() after?:string;
}
@ApiTags('Admin - Organization Geo') @ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','ORG_GEO_VIEW','ORG_GEO_DRILLDOWN','ORG_GEO_EXPORT')
@ApiResponse({status:401,description:'Admin session required'}) @ApiResponse({status:403,description:'Geo capability denied'})
@ApiResponse({status:422,description:'Invalid context or source unavailable'})
@Controller('admin/organization/geo')
export class OrganizationGeoController {
 constructor(private readonly service:OrganizationGeoService,private readonly profiles:GeoProfileService,private readonly db:PrismaService){}
 @Get('summary') @Header('Cache-Control','private, no-store') @ApiOperation({operationId:'adminGeoSummary',summary:'歷史 Binary 子樹地理彙總；GPV 為唯一一般業績單位'})
 async summary(@Req() req:{user:TreePrincipal},@Query() input:GeoQueryDto){return {data:await this.service.capture(req.user,input)};}
 @Get('distribution') @Header('Cache-Control','private, no-store') @ApiOperation({operationId:'adminGeoDistribution',summary:'縣市／行政區彙總，不含地址或座標'})
 @Roles('SUPER_ADMIN','ORG_GEO_DRILLDOWN','ORG_GEO_EXPORT')
 async distribution(@Req() req:{user:TreePrincipal},@Query() input:GeoQueryDto){return {data:await this.service.capture(req.user,input)};}
 @Get('branch-comparison') @Header('Cache-Control','private, no-store') @ApiOperation({operationId:'adminGeoBranchComparison',summary:'以歷史 firstSide 比較左右區地理分布'})
 async branches(@Req() req:{user:TreePrincipal},@Query() input:GeoQueryDto){return {data:await this.service.capture(req.user,input)};}
 @Get('top-markets') @Header('Cache-Control','private, no-store') @ApiOperation({operationId:'adminGeoTopMarkets',summary:'依相同授權時間條件排名最多 20 個市場'})
 async top(@Req() req:{user:TreePrincipal},@Query() input:GeoQueryDto){return {data:await this.service.topMarkets(req.user,input)};}
 @Get('trend') @Header('Cache-Control','private, no-store') @ApiOperation({operationId:'adminGeoTrend',summary:'每個時間桶重新取歷史持有人／地址／Active 證據'})
 async trend(@Req() req:{user:TreePrincipal},@Query() input:GeoQueryDto){return {data:await this.service.trend(req.user,input)};}
 @Get('export') @Roles('SUPER_ADMIN','ORG_GEO_EXPORT') @Header('Content-Type','text/csv; charset=utf-8') @Header('Content-Disposition','attachment; filename="ucell-geo.csv"') @Header('Cache-Control','private, no-store')
 @ApiOperation({operationId:'adminGeoExport',summary:'與圖表相同條件及粒度的行政區 CSV；無 PII'})
 async export(@Req() req:{user:TreePrincipal},@Query() input:GeoQueryDto){
  const result=await this.service.capture(req.user,input,true);
  if(result.status==='UNAVAILABLE')throw new UnprocessableEntityException({code:result.reason});
  const headers=['areaCode','areaName','balls','members','activeBalls','activeRate','newBalls','gpv','status'];
  const quote=(value:unknown)=>'"'+String(value??'').replace(/"/g,'""')+'"';
  return '\uFEFF'+[headers.map(quote).join(','),...result.distribution.map(row=>headers.map(key=>quote((row as any)[key])).join(','))].join('\r\n');
 }
 @Post('profiles/refresh') @Roles('SUPER_ADMIN') @Header('Cache-Control','private, no-store') @ApiOperation({operationId:'adminGeoRefreshProfiles',summary:'分批從已核准的不可變通訊地址版本建立地理投影'})
 async refresh(@Req() req:{user:TreePrincipal},@Query() input:GeoRefreshQuery){
  await authorizeTreePrincipal(this.db,req.user,['SUPER_ADMIN']);
  return {data:await this.profiles.refresh(input.after)};
 }
}
