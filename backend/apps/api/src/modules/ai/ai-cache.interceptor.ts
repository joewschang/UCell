import {CallHandler,ExecutionContext,Injectable,NestInterceptor} from '@nestjs/common';

@Injectable()
export class AiCacheInterceptor implements NestInterceptor {
  intercept(context:ExecutionContext,next:CallHandler){
    context.switchToHttp().getResponse().header('Cache-Control','no-store');
    return next.handle();
  }
}
