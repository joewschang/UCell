import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const key = req.headers['idempotency-key'];
    if (!key || String(key).length < 8) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '此命令需要有效的 Idempotency-Key。',
      });
    }
    req.idempotencyKey = String(key);
    return true;
  }
}
