import { HttpException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaService } from '@ucell/database';
import { createReadGateway, ReadContractError, ReadQuery, ToolName } from '@ucell/shared';
import { MemberPrincipal } from '../auth/member-authentication';
import { readMemberActiveEvidence, readMemberSettlementCarry } from './member-explain-source';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface MemberExplainRequest { user: MemberPrincipal; correlationId?: string; }
@Injectable()
export class MemberExplainService {
  constructor(private readonly db: PrismaService) {}

  private async owns(db: Prisma.TransactionClient, personId: string, qualificationId: string, now: Date) {
    const [ball, holders, systemBall] = await Promise.all([
      db.qualification.findUnique({ where: { qualificationId }, select: { currentHolderPersonId: true } }),
      db.qualificationHolderHistory.findMany({ where: { qualificationId, effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, take: 2 }),
      db.systemAssignmentPoolEntry.findFirst({ where: { qualificationId }, select: { qualificationId: true } }),
    ]);
    return !systemBall && ball?.currentHolderPersonId === personId && holders.length === 1 && holders[0].holderPersonId === personId;
  }

  async explain(request: MemberExplainRequest, tool: 'getActiveStatus' | 'explainBinarySettlementCarry', query: ReadQuery) {
    const principal = request.user;
    if (!principal || principal.provider !== 'LINE' || !uuid.test(principal.personId) || !uuid.test(principal.sessionId))
      throw new HttpException({ code: 'MEMBER_SESSION_INVALID' }, 401);
    const qualificationId = query.qualificationId;
    if (!qualificationId || !uuid.test(qualificationId) || (query.settlementBatchId !== undefined && !uuid.test(query.settlementBatchId)))
      throw new HttpException({ code: 'INVALID_QUERY' }, 400);
    const correlationId = request.correlationId && uuid.test(request.correlationId) ? request.correlationId : randomUUID();
    const gateway = createReadGateway({
      resolveContext: async () => {
        const [session, person, link] = await Promise.all([
          this.db.authSession.findUnique({ where: { authSessionId: principal.sessionId } }),
          this.db.person.findUnique({ where: { personId: principal.personId }, select: { status: true } }),
          this.db.identityLink.findUnique({ where: { provider_providerSubject: { provider: 'LINE', providerSubject: principal.subject } } }),
        ]);
        if (!session || session.provider !== 'LINE' || session.roleCode !== null || session.status !== 'ACTIVE' || session.revokedAt
          || session.expiresAt <= new Date() || session.personId !== principal.personId || session.subject !== principal.subject
          || person?.status !== 'EFFECTIVE' || link?.personId !== principal.personId) throw new ReadContractError('DENIED');
        return { actorId: principal.personId, audience: 'MEMBER', personId: principal.personId,
          selectedQualificationId: qualificationId, contextVersion: principal.sessionId + '.' + qualificationId,
          permissions: ['explain:active:read', 'explain:binary:read'], correlationId };
      },
      authorize: async (_context, _tool, input) => await this.owns(this.db as unknown as Prisma.TransactionClient, principal.personId, qualificationId, new Date())
        ? { qualificationId, ...(input.settlementBatchId ? { settlementBatchId: input.settlementBatchId } : {}) } : null,
      read: async (selectedTool: ToolName, _target, input, signal) => {
        if (signal.aborted) throw new ReadContractError('TIMEOUT');
        return this.db.$transaction(async tx => {
          const now = new Date();
          if (!await this.owns(tx, principal.personId, qualificationId, now)) throw new ReadContractError('DENIED');
          const source = selectedTool === 'getActiveStatus' ? await readMemberActiveEvidence(tx, qualificationId, now)
            : await readMemberSettlementCarry(tx, qualificationId, input.settlementBatchId!);
          if (signal.aborted) throw new ReadContractError('TIMEOUT');
          return source;
        }, { isolationLevel: 'RepeatableRead', maxWait: 500, timeout: 1500 });
      },
      audit: async event => {
        await this.db.auditEvent.create({ data: { actorType: 'MEMBER', actorId: principal.personId,
          action: 'MEMBER_EXPLAIN_READ', entityType: 'Qualification', entityId: qualificationId,
          afterData: { tool: event.tool, definitionVersion: event.definitionVersion, outcome: event.outcome },
          requestId: correlationId, correlationId } });
      },
    });
    try { return await gateway(tool, { ...query }); }
    catch (error) {
      const code = error instanceof ReadContractError ? error.code : 'SOURCE_UNAVAILABLE';
      const status = code === 'INVALID_QUERY' ? 400 : code === 'DENIED' ? 403 : code === 'CONTEXT_CHANGED' ? 409
        : code === 'HISTORICAL_UNAVAILABLE' ? 422 : code === 'TIMEOUT' ? 504 : 503;
      throw new HttpException({ code }, status);
    }
  }
}
