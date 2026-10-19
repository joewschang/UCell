import {Controller,Get,Header} from '@nestjs/common';
import {ApiOperation,ApiResponse,ApiTags} from '@nestjs/swagger';
import {PublicWebsiteService} from './public-website.service';
@ApiTags('Public - Website')
@Controller('public/website')
export class PublicWebsiteController{
 constructor(private readonly service:PublicWebsiteService){}
 @Get('products') @Header('Cache-Control','public, max-age=30') @ApiOperation({operationId:'publicWebsiteProducts',summary:'Published TIP product names, prices and order availability'}) @ApiResponse({status:200,description:'Public catalog without member or compensation data'}) products(){return this.service.products();}
 @Get('events') @Header('Cache-Control','public, max-age=30') @ApiOperation({operationId:'publicWebsiteEvents',summary:'Published upcoming member event announcements without meeting credentials'}) @ApiResponse({status:200,description:'Public announcements; registration still requires member authentication'}) events(){return this.service.events();}
}
