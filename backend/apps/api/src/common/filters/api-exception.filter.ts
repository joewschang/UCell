import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { emitStructuredOperationalError } from '@ucell/database';
import { randomUUID } from 'crypto';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse();
    const request = http.getRequest();

    const requestId = request.requestId ?? request.headers['x-request-id'] ?? randomUUID();
    const correlationId = request.correlationId ?? randomUUID();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
    const code = String(body['code'] ?? (status === 500 ? 'INTERNAL_UNEXPECTED' : 'DOMAIN_RULE_VIOLATION'));

    emitStructuredOperationalError({
      service: 'api', operation: `${String(request.method ?? 'UNKNOWN')} ${String(request.routerPath ?? request.url ?? 'UNKNOWN')}`,
      traceId: String(correlationId), error: exception, errorCode: code, statusCode: status,
      retryable: status >= 500,
    });

    response.header?.('x-request-id', String(requestId));
    response.header?.('x-correlation-id', String(correlationId));
    response.status(status).send({
      code,
      message: body['message'] ?? '系統處理失敗',
      details: body['details'],
      request_id: requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
