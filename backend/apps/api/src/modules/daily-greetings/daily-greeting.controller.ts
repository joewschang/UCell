import {GreetingPublicationService} from './greeting-publication.service';
import {escapeHtml} from './daily-greeting';
import {Controller,Get,Header,Param,ParseUUIDPipe,Optional,NotFoundException,StreamableFile} from '@nestjs/common';
import {ApiOperation,ApiProduces,ApiResponse,ApiTags} from '@nestjs/swagger';
import {DailyGreetingService} from './daily-greeting.service';
@ApiTags('Public - Daily greetings')
@Controller('public/daily-greetings')
export class DailyGreetingController {
 constructor(private readonly service:DailyGreetingService,@Optional() private publications?:GreetingPublicationService){}
 @Get('publications/:id/:hash/image.png') @ApiOperation({operationId:'publishedDailyGreetingImage'}) @Header('Cache-Control','no-store') @Header('X-Content-Type-Options','nosniff') @Header('Cross-Origin-Resource-Policy','cross-origin')
 async publishedImage(@Param('id',new ParseUUIDPipe()) id:string,@Param('hash') hash:string){if(!this.publications)throw new NotFoundException();return new StreamableFile(await this.publications.publicImage(id,hash),{type:'image/png'});}
 @Get('publications/:id/:hash/share') @ApiOperation({operationId:'publishedDailyGreetingShare'}) @Header('Cache-Control','no-store')
 @Header('Content-Security-Policy',"default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
 async publishedShare(@Param('id',new ParseUUIDPipe()) id:string,@Param('hash') hash:string){
  if(!this.publications)throw new NotFoundException();await this.publications.publicImage(id,hash);
  const image=escapeHtml(this.service.publicationImageUrl(id,hash));
  return new StreamableFile(Buffer.from(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="twitter:card" content="summary_large_image"><meta property="og:type" content="website"><meta property="og:image:width" content="1080"><meta property="og:image:height" content="1080"><meta property="og:title" content="UCell 宇生國際每日問候"><meta property="og:image" content="${image}"><title>UCell 宇生國際每日問候</title></head><body><img src="${image}" alt="宇生國際問候圖" style="max-width:100%;height:auto"><p>請開啟圖片後長按儲存。</p><a href="${image}">開啟原圖</a></body></html>`),{type:'text/html; charset=utf-8'});
 }
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
