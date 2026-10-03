import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Prisma, PrismaService, emitStructuredOperationalError } from '@ucell/database';

@Injectable()
export class AuditInterceptor implements NestInterceptor{
  constructor(private readonly prisma:PrismaService){}
  intercept(ctx:ExecutionContext,next:CallHandler):Observable<any>{
    const req=ctx.switchToHttp().getRequest(),startedAt=new Date();
    return next.handle().pipe(tap({next:()=>void this.write(req,startedAt,'SUCCESS'),error:(error)=>void this.write(req,startedAt,'FAILED',error)}));
  }
  private async write(req:any,startedAt:Date,result:'SUCCESS'|'FAILED',error?:unknown){
    try{
      const path=String(req.originalUrl ?? req.url ?? '').split('?')[0];
      const code=error && typeof error==='object' && 'getResponse' in error ? String(((error as any).getResponse()?.code) ?? `HTTP_${(error as any).getStatus?.() ?? 500}_REQUEST_FAILED`) : `HTTP_${String(req.method ?? 'UNKNOWN')}`;
      await this.prisma.auditEvent.create({data:{
        actorType:req.user?.personId?'USER':'SYSTEM',actorId:req.user?.personId ?? null,action:`HTTP_${String(req.method ?? 'UNKNOWN')}`,eventCode:code,
        environment:process.env.UCELL_ENVIRONMENT ?? process.env.NODE_ENV ?? 'UNKNOWN',traceId:String(req.correlationId),entityType:'HTTP_REQUEST',entityId:null,result,severity:result==='FAILED'?'WARNING':'INFO',privacyClass:'INTERNAL',retentionClass:'STANDARD',changedFieldNames:[],beforeData:Prisma.DbNull,
        afterData:{path,role:req.user?.role ?? null,provider:req.user?.provider ?? null,result,startedAt:startedAt.toISOString(),completedAt:new Date().toISOString()},requestId:String(req.requestId),correlationId:String(req.correlationId)
      }});
    }catch(writeError){emitStructuredOperationalError({service:'api',operation:'audit.write',traceId:String(req.correlationId ?? 'TRACE_UNAVAILABLE'),error:writeError,errorCode:'AUDIT_WRITE_FAILED',retryable:true});}
  }
}
