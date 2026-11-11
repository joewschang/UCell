import {Controller,Get,Header,Param,StreamableFile} from '@nestjs/common';
import {ApiOperation,ApiProduces,ApiResponse,ApiTags} from '@nestjs/swagger';
import {DailyGreetingService} from './daily-greeting.service';
@ApiTags('Public - Daily greetings')
@Controller('public/daily-greetings')
export class DailyGreetingController {
 constructor(private readonly service:DailyGreetingService){}
 @Get('current') @Header('Cache-Control','no-store')
 @ApiOperation({operationId:'currentDailyGreeting',summary:'Current 07:00 Asia/Taipei public greeting poster; no personal data'})
 @ApiResponse({status:200,description:'Date, copy, public PNG and share URLs, release and next refresh times'})
 current(){return this.service.current();}
 @Get(':date/image.png') @Header('Cache-Control','public, max-age=3600') @Header('X-Content-Type-Options','nosniff') @Header('Cross-Origin-Resource-Policy','cross-origin')
 @ApiProduces('image/png') @ApiOperation({operationId:'dailyGreetingImage',summary:'Public 1080px greeting PNG for the specified published Taipei date'})
 async image(@Param('date') date:string){return new StreamableFile(await this.service.image(date),{type:'image/png',disposition:`inline; filename="UCell-${date}.png"`});}
 @Get(':date/share') @Header('Cache-Control','public, max-age=300')
 @Header('Content-Security-Policy',"default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
 @ApiProduces('text/html') @ApiOperation({operationId:'dailyGreetingShare',summary:'Public greeting share page with Open Graph image metadata'})
 async share(@Param('date') date:string){return new StreamableFile(Buffer.from(await this.service.shareHtml(date)),{type:'text/html; charset=utf-8'});}
}
