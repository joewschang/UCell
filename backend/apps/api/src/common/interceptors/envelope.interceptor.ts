import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { toJsonSafe } from '../utils/json-safe';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(map((raw: any) => {
      // Preserve native streaming; serializing a StreamableFile destroys CSV bytes/backpressure.
      if (raw instanceof StreamableFile) return raw;
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
