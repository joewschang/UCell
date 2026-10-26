import {Body,Controller,Get,Param,Post,Req,Res,UnauthorizedException} from '@nestjs/common';
import {IsBoolean,IsIn,IsInt,IsObject,IsString,IsUUID,Matches,Max,MaxLength,Min} from 'class-validator';
import {Roles} from '../auth/roles.decorator';
import {ProductContentService} from './product-content.service';
import {reviewMediaResponse} from './product-review.controller';
import {REVIEW_MIMES} from './product-review-media';
class Sku{@Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/) sku!:string;}
class Id{@IsUUID() id!:string;}
class Save{@IsObject() document!:object;@IsInt() @Min(0) version!:number;}
class Publish{@IsInt() @Min(1) version!:number;@IsBoolean() publish!:boolean;}
class Upload{@IsIn(REVIEW_MIMES) mimeType!:string;@IsInt() @Min(1) @Max(20971520) size!:number;@Matches(/^[a-f0-9]{64}$/) sha256!:string;}
class Part{@IsInt() @Min(0) @Max(79) part!:number;@IsString() @MaxLength(349528) content!:string;}
function actor(req:any){if(!req.user?.personId)throw new UnauthorizedException();return req.user.personId;}
@Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT') @Controller('admin/product-content')
export class AdminProductContentController{
 constructor(private readonly service:ProductContentService){}
 @Get('products/:sku') read(@Param() p:Sku){return this.service.read(p.sku,true).then(data=>({data}));}
 @Get('media/:id') async media(@Param() p:Id,@Req() req:any,@Res({passthrough:true}) res:any){return reviewMediaResponse(await this.service.media(p.id,true),req.headers.range,res);}
 @Roles('SUPER_ADMIN','ORDER_OPS') @Post('products/:sku') save(@Param() p:Sku,@Body() b:Save,@Req() req:any){return this.service.save(p.sku,b.document,b.version,actor(req),req.requestId).then(data=>({data}));}
 @Roles('SUPER_ADMIN','ORDER_OPS') @Post('products/:sku/publish') publish(@Param() p:Sku,@Body() b:Publish,@Req() req:any){return this.service.publish(p.sku,b.version,b.publish,actor(req),req.requestId).then(data=>({data}));}
 @Roles('SUPER_ADMIN','ORDER_OPS') @Post('products/:sku/uploads') start(@Param() p:Sku,@Body() b:Upload,@Req() req:any){return this.service.start(p.sku,b,actor(req)).then(data=>({data}));}
 @Roles('SUPER_ADMIN','ORDER_OPS') @Post('uploads/:id/parts') part(@Param() p:Id,@Body() b:Part,@Req() req:any){return this.service.part(p.id,b.part,b.content,actor(req)).then(data=>({data}));}
 @Roles('SUPER_ADMIN','ORDER_OPS') @Post('uploads/:id/complete') complete(@Param() p:Id,@Req() req:any){return this.service.complete(p.id,actor(req)).then(data=>({data}));}
}
@Controller('public/product-content')
export class PublicProductContentController{
 constructor(private readonly service:ProductContentService){}
 @Get('products/:sku') read(@Param() p:Sku){return this.service.read(p.sku).then(data=>({data}));}
 @Get('media/:id') async media(@Param() p:Id,@Req() req:any,@Res({passthrough:true}) res:any){return reviewMediaResponse(await this.service.media(p.id),req.headers.range,res);}
}
