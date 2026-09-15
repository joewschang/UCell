import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context:ExecutionContext,next:CallHandler):Observable<unknown>{
    const req=context.switchToHttp().getRequest();
    const res=context.switchToHttp().getResponse();

    const requestHeader=String(req.headers?.['x-request-id'] ?? '').trim();
    const correlationHeader=String(req.headers?.['x-correlation-id'] ?? '').trim();

    // request_id is an external trace string; correlation_id is persisted as UUID in DB.
    req.requestId=requestHeader || randomUUID();
    req.correlationId=UUID_RE.test(correlationHeader)?correlationHeader:randomUUID();

    res.header?.('x-request-id',req.requestId);
    res.header?.('x-correlation-id',req.correlationId);
    return next.handle();
  }
}
