import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse();
    const request = http.getRequest();

    const requestId = request.headers['x-request-id'] ?? randomUUID();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};

    response.status(status).send({
      code: body['code'] ?? (status === 500 ? 'INTERNAL_ERROR' : 'DOMAIN_RULE_VIOLATION'),
      message: body['message'] ?? '系統處理失敗',
      details: body['details'],
      request_id: requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
