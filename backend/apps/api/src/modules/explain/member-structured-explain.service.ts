import { HttpException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaService } from '@ucell/database';
import { createExplainGateway, ExplainQuery, ExplainTool, ReadContractError, UCellRequestContext } from '@ucell/shared';
import { MemberExplainRequest } from '../member/member-explain.service';
import { readStructuredExplanation } from './structured-explain-source';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const permissions = ['active','performance','binary','award','settlement','payout','return'].map(x => `explain:${x}:read`);
/** Selection comes from the guarded HTTP request; roles and permissions never come from tool arguments. */
@Injectable()
export class MemberStructuredExplainService {
  constructor(private readonly db: PrismaService) {}
  private async owns(tx: Prisma.TransactionClient, personId: string, qualificationId: string) {
    const now = new Date();
    const [ball, holders, system] = await Promise.all([
      tx.qualification.findUnique({where:{qualificationId},select:{currentHolderPersonId:true}}),
      tx.qualificationHolderHistory.findMany({where:{qualificationId,effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},take:2}),
      tx.systemAssignmentPoolEntry.findFirst({where:{qualificationId},select:{qualificationId:true}}),
    ]);
    return !system && ball?.currentHolderPersonId === personId && holders.length === 1 && holders[0].holderPersonId === personId;
  }
  async explain(request: MemberExplainRequest, tool: ExplainTool, query: ExplainQuery) {
    const p = request.user;
    if (!p || p.provider !== 'LINE' || !uuid.test(p.personId) || !uuid.test(p.sessionId)) throw new HttpException({code:'MEMBER_SESSION_INVALID'},401);
    if (!query.qualificationId || !uuid.test(query.qualificationId) || [query.resourceId,query.binaryTreeId].some(x => x !== undefined && !uuid.test(x)))
      throw new HttpException({code:'INVALID_QUERY'},400);
    const selected = query.qualificationId;
    const correlationId = request.correlationId && uuid.test(request.correlationId) ? request.correlationId : randomUUID();
    const gateway = createExplainGateway({
      resolveContext: async (): Promise<UCellRequestContext> => {
        const [session,person,link] = await Promise.all([
          this.db.authSession.findUnique({where:{authSessionId:p.sessionId}}),
          this.db.person.findUnique({where:{personId:p.personId},select:{status:true}}),
          this.db.identityLink.findUnique({where:{provider_providerSubject:{provider:'LINE',providerSubject:p.subject}}}),
        ]);
        if (!session || session.provider !== 'LINE' || session.roleCode !== null || session.status !== 'ACTIVE' || session.revokedAt
          || session.expiresAt <= new Date() || session.personId !== p.personId || session.subject !== p.subject
          || person?.status !== 'EFFECTIVE' || link?.personId !== p.personId) throw new ReadContractError('DENIED');
        return {actorId:p.personId,actorType:'MEMBER',roles:['MEMBER'],personId:p.personId,selectedQualificationId:selected,
          permissions,scopes:[selected],locale:'zh-TW',timezone:'Asia/Taipei',correlationId,contextVersion:p.sessionId+'.'+selected};
      },
      authorize: async (_ctx,_tool,input) => input.qualificationId === selected && !input.binaryTreeId
        && await this.owns(this.db as unknown as Prisma.TransactionClient,p.personId,selected),
      read: async (name,input,_ctx,signal) => {
        const now = new Date().toISOString();
        if (input.time.asOf > now || input.time.knowledgeCutoff > now) throw new ReadContractError('INVALID_QUERY');
        if (signal.aborted) throw new ReadContractError('TIMEOUT');
        return this.db.$transaction(async tx => {
          if (!await this.owns(tx,p.personId,selected)) throw new ReadContractError('DENIED');
          const result = await readStructuredExplanation(tx,name,input);
          if (signal.aborted) throw new ReadContractError('TIMEOUT');
          return result;
        },{isolationLevel:'RepeatableRead',maxWait:500,timeout:1500});
      },
      audit: async event => { await this.db.auditEvent.create({data:{actorType:'MEMBER',actorId:p.personId,
        action:'MEMBER_STRUCTURED_EXPLAIN_READ',entityType:'Qualification',entityId:selected,
        afterData:{tool:event.tool,outcome:event.outcome,definitionVersion:'1'},requestId:correlationId,correlationId}}); },
    });
    try { return await gateway(tool,query); } catch (error) {
      const code = error instanceof ReadContractError ? error.code : 'SOURCE_UNAVAILABLE';
      throw new HttpException({code},code === 'INVALID_QUERY' ? 400 : code === 'DENIED' ? 403 : code === 'CONTEXT_CHANGED' ? 409 : code === 'TIMEOUT' ? 504 : 503);
    }
  }
}
