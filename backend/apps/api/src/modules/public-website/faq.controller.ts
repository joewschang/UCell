import {Body,Controller,Delete,Get,Header,Param,Put,Req,ConflictException,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {IsBoolean,IsInt,IsString,Length,Min,Max,Matches} from 'class-validator';
import {PrismaService} from '@ucell/database';
import {Roles} from '../auth/roles.decorator';

class CategoryDto{
 @IsString() @Length(1,80) label!:string;
 @IsInt() @Min(0) @Max(10000) sortOrder!:number;
 @IsBoolean() published!:boolean;
 @IsInt() @Min(0) version!:number;
}
class FaqDto{
 @Matches(/^[a-zA-Z0-9_-]{1,80}$/) category!:string;
 @IsString() @Length(1,200) question!:string;
 @IsString() @Length(1,12000) answer!:string;
 @IsString() @Length(0,500) keywords!:string;
 @IsInt() @Min(0) @Max(10000) sortOrder!:number;
 @IsBoolean() published!:boolean;
 @IsInt() @Min(0) version!:number;
}
function idCheck(id:string){if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw new UnprocessableEntityException('FAQ_ID_INVALID');}
export async function faqList(db:PrismaService,admin=false){
 const categories=await db.$queryRaw<any[]>`SELECT id,label,sort_order AS "sortOrder",published,version FROM content.faq_category WHERE (${admin} OR published) ORDER BY sort_order,id`;
 const items=await db.$queryRaw<any[]>`SELECT f.id,f.category,f.question,f.answer,f.keywords,f.sort_order AS "sortOrder",f.published,f.version FROM content.faq_item f JOIN content.faq_category c ON c.id=f.category WHERE (${admin} OR (f.published AND c.published)) ORDER BY f.sort_order,f.id`;
 return {categories,items};
}
@Controller('public/faq')
export class PublicFaqController{
 constructor(private readonly db:PrismaService){}
 @Get() @Header('Cache-Control','no-store') list(){return faqList(this.db);}
}
@Controller('admin/faq') @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','CUSTOMER_SERVICE')
export class AdminFaqController{
 constructor(private readonly db:PrismaService){}
 @Get() @Header('Cache-Control','no-store') list(){return faqList(this.db,true);}
 @Put('categories/:id') async category(@Param('id') id:string,@Body() input:CategoryDto,@Req() req:any){
  idCheck(id);if(!input.label.trim())throw new UnprocessableEntityException('FAQ_LABEL_REQUIRED');
  return this.db.$transaction(async tx=>{
   const rows=await tx.$queryRaw<any[]>`INSERT INTO content.faq_category(id,label,sort_order,published) SELECT ${id},${input.label.trim()},${input.sortOrder},${input.published} WHERE ${input.version}=0 ON CONFLICT(id) DO NOTHING RETURNING id`;
   const count=rows.length||await tx.$executeRaw`UPDATE content.faq_category SET label=${input.label.trim()},sort_order=${input.sortOrder},published=${input.published},version=version+1 WHERE id=${id} AND version=${input.version}`;
   if(!count)throw new ConflictException('FAQ_VERSION_CONFLICT');
   await tx.$executeRaw`INSERT INTO content.faq_change(actor_id,entity_id,action,payload) VALUES (${req.user.personId||req.user.subject||req.user.role},${id},'CATEGORY_SAVED',${JSON.stringify(input)}::jsonb)`;
   return {saved:true};
  });
 }
 @Put('items/:id') async item(@Param('id') id:string,@Body() input:FaqDto,@Req() req:any){
  idCheck(id);if(!input.question.trim()||!input.answer.trim())throw new UnprocessableEntityException('FAQ_TEXT_REQUIRED');
  return this.db.$transaction(async tx=>{
   const category=await tx.$queryRaw<any[]>`SELECT id FROM content.faq_category WHERE id=${input.category} FOR KEY SHARE`;
   if(!category.length)throw new UnprocessableEntityException('FAQ_CATEGORY_REQUIRED');
   const rows=await tx.$queryRaw<any[]>`INSERT INTO content.faq_item(id,category,question,answer,keywords,sort_order,published) SELECT ${id},${input.category},${input.question.trim()},${input.answer.trim()},${input.keywords},${input.sortOrder},${input.published} WHERE ${input.version}=0 ON CONFLICT(id) DO NOTHING RETURNING id`;
   const count=rows.length||await tx.$executeRaw`UPDATE content.faq_item SET category=${input.category},question=${input.question.trim()},answer=${input.answer.trim()},keywords=${input.keywords},sort_order=${input.sortOrder},published=${input.published},version=version+1 WHERE id=${id} AND version=${input.version}`;
   if(!count)throw new ConflictException('FAQ_VERSION_CONFLICT');
   await tx.$executeRaw`INSERT INTO content.faq_change(actor_id,entity_id,action,payload) VALUES (${req.user.personId||req.user.subject||req.user.role},${id},'ITEM_SAVED',${JSON.stringify(input)}::jsonb)`;
   return {saved:true};
  });
 }
}
