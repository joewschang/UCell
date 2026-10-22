import {AiCacheInterceptor} from './ai-cache.interceptor';
import {Body,Controller,Get,Post,Param,Req,Res,Headers,UseGuards,UseInterceptors,HttpCode} from '@nestjs/common';
import {Roles} from '../auth/roles.decorator';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {AiService} from './ai.service';
@UseInterceptors(AiCacheInterceptor)
@Controller('member/ai')
@UseGuards(MemberAuthenticationGuard)
export class MemberAiController{
 constructor(private readonly ai:AiService){}
 private actor(req:any){return this.ai.authorize(req.user,'MEMBER');}
 @Get('capabilities') async capabilities(@Req() r:any){return this.ai.capabilities(await this.actor(r));}
 @Post('conversations') async conversation(@Req() r:any,@Body() b:any){return this.ai.createConversation(await this.actor(r),b);}
 @Post('conversations/:id/turns') @HttpCode(202) async turn(@Req() r:any,@Param('id') id:string,@Body() b:any,@Headers('idempotency-key') key:string){return this.ai.turn(await this.actor(r),id,b,key);}
 @Get('turns/:id') async get(@Req() r:any,@Param('id') id:string){return this.ai.getTurn(await this.actor(r),id);}
 @Post('turns/:id/cancel') async cancel(@Req() r:any,@Param('id') id:string){return this.ai.cancel(await this.actor(r),id);}
 @Post('turns/:id/feedback') async feedback(@Req() r:any,@Param('id') id:string,@Body() b:any){return this.ai.feedback(await this.actor(r),id,b);}
}
@UseInterceptors(AiCacheInterceptor)
@Controller('admin/ai')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT','ORDER_OPS','MEMBERSHIP_OPS')
export class AdminAiController{
 constructor(private readonly ai:AiService){}
 private actor(req:any,cap='AI_EXEC_READ'){return this.ai.authorize(req.user,'ADMIN',cap);}
 @Get('capabilities') async capabilities(@Req() r:any){return this.ai.capabilities(await this.actor(r));}
 @Post('conversations') async conversation(@Req() r:any,@Body() b:any){return this.ai.createConversation(await this.actor(r),b);}
 @Post('conversations/:id/turns') @HttpCode(202) async turn(@Req() r:any,@Param('id') id:string,@Body() b:any,@Headers('idempotency-key') key:string){return this.ai.turn(await this.actor(r),id,b,key);}
 @Get('turns/:id') async get(@Req() r:any,@Param('id') id:string){return this.ai.getTurn(await this.actor(r),id);}
 @Post('turns/:id/cancel') async cancel(@Req() r:any,@Param('id') id:string){return this.ai.cancel(await this.actor(r),id);}
 @Post('turns/:id/feedback') async feedback(@Req() r:any,@Param('id') id:string,@Body() b:any){return this.ai.feedback(await this.actor(r),id,b);}
 @Post('report-jobs') async report(@Req() r:any,@Body() b:any){return this.ai.createReport(await this.actor(r,'AI_REPORT_EXPORT'),b);}
 @Get('report-jobs/:id/download') async download(@Req() r:any,@Param('id') id:string,@Res() res:any){const csv=await this.ai.download(await this.actor(r,'AI_REPORT_EXPORT'),id);res.header('Content-Type','text/csv; charset=utf-8').header('Cache-Control','no-store').header('Content-Disposition','attachment; filename="ucell-ai.csv"').send(csv);}
 @Get('knowledge') async knowledge(@Req() r:any){return this.ai.knowledge(await this.actor(r,'AI_KB_EDIT'));}
 @Post('knowledge') async createKnowledge(@Req() r:any,@Body() b:any){return this.ai.createKnowledge(await this.actor(r,'AI_KB_EDIT'),b);}
 @Post('knowledge/:id/:action') async knowledgeAction(@Req() r:any,@Param('id') id:string,@Param('action') action:string,@Body() b:any){return this.ai.knowledgeAction(await this.actor(r,action==='submit'?'AI_KB_EDIT':'AI_KB_APPROVE'),id,action,b);}
 @Get('audit') async audit(@Req() r:any){return this.ai.auditList(await this.actor(r,'AI_AUDIT_READ'));}
}
