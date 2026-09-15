import { CanActivate, ExecutionContext, ForbiddenException, Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

@Injectable()
export class QualificationGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const personId = req.user?.personId as string | undefined;
    const qualificationId = req.headers['x-qualification-id'] as string | undefined;

    if (!qualificationId) {
      throw new BadRequestException({
        code: 'AMBIGUOUS_QUALIFICATION',
        message: '此操作必須指定會員資格／球。',
      });
    }
    if (!personId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '缺少會員身分。' });
    }

    const q = await this.prisma.qualification.findFirst({
      where: { qualificationId, currentHolderPersonId: personId },
      select: { qualificationId: true },
    });

    if (!q) {
      throw new ForbiddenException({
        code: 'QUALIFICATION_NOT_OWNED',
        message: '此會員資格不屬於目前登入者。',
      });
    }

    req.qualificationId = qualificationId;
    return true;
  }
}
