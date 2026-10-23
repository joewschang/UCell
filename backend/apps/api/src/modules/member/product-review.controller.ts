import {Body,Controller,Get,Param,Post,Query,Req,Res,UseGuards,StreamableFile,UnauthorizedException} from '@nestjs/common';
import {ArrayMaxSize,IsArray,IsBoolean,IsIn,IsInt,IsOptional,IsString,IsUUID,Matches,Max,MaxLength,Min} from 'class-validator';
import {Type} from 'class-transformer';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {ProductReviewService} from './product-review.service';
import {REVIEW_MIMES} from './product-review-media';
class OrderParam{@Matches(/^[1-9][0-9]{0,17}$/) orderNo!:string;}
class IdParam{@IsUUID() id!:string;}
class ProductParam{@Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/) sku!:string;}
class UploadInput{@IsUUID() productId!:string;@IsIn(REVIEW_MIMES) mimeType!:string;@IsInt() @Min(1) @Max(20971520) size!:number;@Matches(/^[a-f0-9]{64}$/) sha256!:string;}
class PartInput{@IsInt() @Min(0) @Max(79) part!:number;@IsString() @MaxLength(349528) content!:string;}
class SubmitInput{@IsUUID() productId!:string;@IsInt() @Min(1) @Max(5) rating!:number;@IsString() @MaxLength(1000) comment!:string;@IsArray() @ArrayMaxSize(6) @IsUUID('all',{each:true}) mediaIds!:string[];@IsInt() @Min(0) @Max(100000) expectedVersion!:number;@IsBoolean() publishConsent!:boolean;}
class FeatureInput{@IsBoolean() featured!:boolean;@IsInt() @Min(1) version!:number;}
class PageQuery{@IsOptional() @IsIn(['true','false']) featured?:string;@IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100000) page?:number;@IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(5) rating?:number;}
class AdminQuery{@IsOptional() @IsIn(['ALL','PENDING','APPROVED','REJECTED','HIDDEN']) status?:string;@IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100000) page?:number;}
class ModerateInput{@IsIn(['APPROVED','REJECTED','HIDDEN']) action!:'APPROVED'|'REJECTED'|'HIDDEN';@IsInt() @Min(1) version!:number;@IsString() @MaxLength(500) reason!:string;}
export function reviewMediaResponse(file:{bytes:Buffer;mimeType:string},range:string|undefined,res:any){
 res.header('Cache-Control','private, no-store');res.header('X-Content-Type-Options','nosniff');res.header('Accept-Ranges','bytes');res.header('Cross-Origin-Resource-Policy','cross-origin');res.header('Content-Security-Policy',"default-src 'none'; sandbox");
 let bytes=file.bytes;const size=bytes.length;if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||!match[1]&&!match[2]){res.code(416);res.header('Content-Range',`bytes */${size}`);return new StreamableFile(Buffer.alloc(0));}
  const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2])),end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){res.code(416);res.header('Content-Range',`bytes */${size}`);return new StreamableFile(Buffer.alloc(0));}
  bytes=bytes.subarray(start,end+1);res.code(206);res.header('Content-Range',`bytes ${start}-${end}/${size}`);
 }return new StreamableFile(bytes,{type:file.mimeType,length:bytes.length});
}
@UseGuards(MemberAuthenticationGuard) @Controller('member/product-reviews')
export class MemberProductReviewController{
 constructor(private readonly service:ProductReviewService){}
 @Get('orders/:orderNo') own(@Req() req:any,@Param() p:OrderParam){return this.service.own(req.user.personId,p.orderNo).then(data=>({data}));}
 @Post('orders/:orderNo/uploads') upload(@Req() req:any,@Param() p:OrderParam,@Body() body:UploadInput){return this.service.startUpload(req.user.personId,p.orderNo,body).then(data=>({data}));}
 @Post('uploads/:id/parts') part(@Req() req:any,@Param() p:IdParam,@Body() body:PartInput){return this.service.uploadPart(req.user.personId,p.id,body.part,body.content).then(data=>({data}));}
 @Post('uploads/:id/complete') complete(@Req() req:any,@Param() p:IdParam){return this.service.finishUpload(req.user.personId,p.id).then(data=>({data}));}
 @Post('orders/:orderNo') submit(@Req() req:any,@Param() p:OrderParam,@Body() body:SubmitInput){return this.service.submit(req.user.personId,p.orderNo,body,req.requestId??randomUUID()).then(data=>({data}));}
 @Get('media/:id') async media(@Req() req:any,@Param() p:IdParam,@Res({passthrough:true}) res:any){return reviewMediaResponse(await this.service.media(p.id,{personId:req.user.personId}),req.headers.range,res);}
}
@Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT') @Controller('admin/product-reviews')
export class AdminProductReviewController{
 constructor(private readonly service:ProductReviewService){}
 @Roles('SUPER_ADMIN','ORDER_OPS') @Post(':id/featured') feature(@Req() req:any,@Param() p:IdParam,@Body() b:FeatureInput){if(!req.user?.personId)throw new UnauthorizedException();return this.service.feature(p.id,b.featured,b.version,req.user.personId,req.requestId??randomUUID()).then(data=>({data}));}
 @Get() list(@Query() q:AdminQuery){return this.service.adminList(q.status??'PENDING',q.page??1).then(data=>({data}));}
 @Get('media/:id') async media(@Req() req:any,@Param() p:IdParam,@Res({passthrough:true}) res:any){return reviewMediaResponse(await this.service.media(p.id,{admin:true}),req.headers.range,res);}
 @Roles('SUPER_ADMIN','ORDER_OPS') @Post(':id/moderate') moderate(@Req() req:any,@Param() p:IdParam,@Body() body:ModerateInput){if(!req.user?.personId)throw new UnauthorizedException();return this.service.moderate(p.id,body.action,body.version,body.reason,req.user.personId,req.requestId??randomUUID()).then(data=>({data}));}
}
@Controller('public/product-reviews')
export class PublicProductReviewController{
 constructor(private readonly service:ProductReviewService){}
 @Get('products/:sku') list(@Param() p:ProductParam,@Query() q:PageQuery){return this.service.publicList(p.sku,q.page,q.rating,q.featured==='true').then(data=>({data}));}
 @Get('media/:id') async media(@Req() req:any,@Param() p:IdParam,@Res({passthrough:true}) res:any){return reviewMediaResponse(await this.service.media(p.id,{public:true}),req.headers.range,res);}
}
