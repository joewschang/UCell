import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { toJsonSafe } from '../utils/json-safe';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(map((raw: any) => {
      const body = toJsonSafe(raw);
      if (body?.meta) {
        body.meta = {
          ...body.meta,
          request_id: req.requestId,
          timestamp: new Date().toISOString(),
          api_version: 'v1',
        };
        return body;
      }
      return {
        data: body?.data ?? body,
        meta: {
          request_id: req.requestId,
          timestamp: new Date().toISOString(),
          api_version: 'v1',
        },
      };
    }));
  }
}
