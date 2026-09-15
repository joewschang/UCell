import { CallHandler,ExecutionContext,Injectable,NestInterceptor } from '@nestjs/common';
import { Observable,tap } from 'rxjs';
import { Prisma, PrismaService } from '@ucell/database';

@Injectable()
export class AuditInterceptor implements NestInterceptor{
  constructor(private readonly prisma:PrismaService){}

  intercept(ctx:ExecutionContext,next:CallHandler):Observable<any>{
    const req=ctx.switchToHttp().getRequest();
    const startedAt=new Date();

    return next.handle().pipe(tap({
      next:()=>void this.write(req,startedAt,'SUCCESS'),
      error:()=>void this.write(req,startedAt,'ERROR')
    }));
  }

  private async write(req:any,startedAt:Date,outcome:string){
    try{
      await this.prisma.auditEvent.create({
        data:{
          actorType:req.user?.personId?'USER':'SYSTEM',
          actorId:req.user?.personId ?? null,
          action:`HTTP_${String(req.method ?? 'UNKNOWN')}`,
          entityType:'HTTP_REQUEST',
          // AuditEvent.entity_id is UUID and an HTTP request has no domain entity UUID by default.
          // request_id/correlation_id provide request trace; domain services write their own entity audit facts.
          entityId:null,
          beforeData:Prisma.DbNull,
          afterData:{
            path:req.originalUrl ?? req.url,
            role:req.user?.role ?? null,
            provider:req.user?.provider ?? null,
            outcome,
            startedAt:startedAt.toISOString(),
            completedAt:new Date().toISOString(),
            userAgent:req.headers?.['user-agent'] ?? null,
            ip:req.ip ?? null
          },
          requestId:String(req.requestId),
          correlationId:String(req.correlationId)
        }
      });
    }catch{
      // Production monitoring must alert on audit-write failures.
      // Never dump request body/PII to fallback logs.
    }
  }
}
