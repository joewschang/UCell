import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { createHash, randomUUID } from 'crypto';
import { SponsorResolver } from '../qualification/sponsor-resolver.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { AuditService } from '../../common/audit/audit.service';
import { OutboxService } from '../../common/outbox/outbox.service';

/**
 * Authoritative retail attribution boundary. It deliberately never writes a
 * SponsorRelationship, BinaryPlacement, PV event, or Qualification.
 */
@Injectable()
export class RetailReferrerAttributionService {
  constructor(private readonly db: PrismaService, private readonly sponsors: SponsorResolver, private readonly idempotency?:IdempotencyService, private readonly audit?:AuditService, private readonly outbox?:OutboxService) {}

  async candidate(code: string, at = new Date()) {
    const resolved = await this.sponsors.resolve({ code, effectiveAt: at, ruleVersion: 'R1.0B' });
    return { ballNo: resolved.sponsorBallNo, planLevelCode: resolved.planLevelCode, effectiveAt: resolved.effectiveAt, ruleVersion: resolved.ruleVersion };
  }

  async current(personId: string, at = new Date(), tx: any = this.db) {
    return tx.retailReferrerAttribution.findFirst({
      where: { personId, effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async history(personId:string){const rows=await this.db.retailReferrerAttribution.findMany({where:{personId},select:{referrerBallNoSnapshot:true,source:true,effectiveFrom:true,effectiveTo:true,correctionReason:true},orderBy:{effectiveFrom:'desc'},take:50});return rows.map(row=>({ballNo:row.referrerBallNoSnapshot,source:row.source,effectiveFrom:row.effectiveFrom.toISOString(),effectiveTo:row.effectiveTo?.toISOString()??null,reason:row.correctionReason??null}));}
  async resolveForRetailOrder(tx: any, input: { personId: string; candidateCode?: string; orderId: string; at: Date; correlationId: string }) {
    const current = await this.current(input.personId, input.at, tx);
    if (current) {
      if (input.candidateCode) {
        const candidate = await this.sponsors.resolveWithin(tx, { code: input.candidateCode, effectiveAt: input.at, ruleVersion: 'R1.0B' });
        if (candidate.sponsorQualificationId !== current.referrerQualificationId) {
          throw new ConflictException({ code: 'RETAIL_REFERRER_ATTRIBUTION_LOCKED' });
        }
      }
      return current;
    }
    if (!input.candidateCode) return null;
    const candidate = await this.sponsors.resolveWithin(tx, { code: input.candidateCode, effectiveAt: input.at, ruleVersion: 'R1.0B' });
    const created = await tx.retailReferrerAttribution.create({ data: {
      personId: input.personId,
      referrerQualificationId: candidate.sponsorQualificationId,
      referrerBallNoSnapshot: candidate.sponsorBallNo,
      source: 'RETAIL_CHECKOUT_CANDIDATE_REVALIDATED',
      effectiveFrom: input.at,
      createdByOrderId: input.orderId,
    }});
    await tx.retailReferrerAttributionEvent.create({ data: {
      retailReferrerAttributionId: created.retailReferrerAttributionId,
      action: 'CREATED_AT_FIRST_ATTRIBUTED_ORDER',
      effectiveFrom: input.at,
      correlationId: input.correlationId,
      evidenceHash: this.hash({ personId: input.personId, ballNo: candidate.sponsorBallNo, orderId: input.orderId, effectiveAt: input.at.toISOString(), ruleVersion: candidate.ruleVersion }),
    }});
    return created;
  }

  async correct(input:{personId:string;ballNo:string;reason:string;effectiveFrom:Date;actorPersonId:string;key:string;requestId:string}){
    if(input.effectiveFrom<=new Date())throw new UnprocessableEntityException({code:'RETAIL_REFERRER_CORRECTION_MUST_BE_FORWARD_ONLY'});
    if(!this.idempotency||!this.audit||!this.outbox)throw new UnprocessableEntityException({code:'COMMAND_SERVICE_UNAVAILABLE'});
    const audit=this.audit,outbox=this.outbox;
    return this.idempotency.execute(`admin:retail-referrer-correction:${input.personId}`,input.key,{ballNo:input.ballNo,reason:input.reason,effectiveFrom:input.effectiveFrom.toISOString()},async tx=>{
      const correlationId=randomUUID(),current=await this.current(input.personId,input.effectiveFrom,tx);
      if(!current)throw new UnprocessableEntityException({code:'RETAIL_REFERRER_ATTRIBUTION_NOT_FOUND'});
      const candidate=await this.sponsors.resolveWithin(tx,{code:input.ballNo,effectiveAt:input.effectiveFrom,ruleVersion:'R1.0B'});
      if(candidate.sponsorQualificationId===current.referrerQualificationId)throw new UnprocessableEntityException({code:'RETAIL_REFERRER_CORRECTION_NO_CHANGE'});
      await tx.retailReferrerAttribution.update({where:{retailReferrerAttributionId:current.retailReferrerAttributionId},data:{effectiveTo:input.effectiveFrom}});
      const created=await tx.retailReferrerAttribution.create({data:{personId:input.personId,referrerQualificationId:candidate.sponsorQualificationId,referrerBallNoSnapshot:candidate.sponsorBallNo,source:'ADMIN_FORWARD_CORRECTION',effectiveFrom:input.effectiveFrom,correctionReason:input.reason}});
      const evidenceHash=this.hash({personId:input.personId,from:current.referrerBallNoSnapshot,to:candidate.sponsorBallNo,effectiveFrom:input.effectiveFrom.toISOString(),reason:input.reason});
      await tx.retailReferrerAttributionEvent.createMany({data:[{retailReferrerAttributionId:current.retailReferrerAttributionId,action:'CLOSED_BY_ADMIN_FORWARD_CORRECTION',actorPersonId:input.actorPersonId,reason:input.reason,effectiveFrom:input.effectiveFrom,correlationId,evidenceHash},{retailReferrerAttributionId:created.retailReferrerAttributionId,action:'CREATED_BY_ADMIN_FORWARD_CORRECTION',actorPersonId:input.actorPersonId,reason:input.reason,effectiveFrom:input.effectiveFrom,correlationId,evidenceHash}]});
      await audit.write(tx,{actorType:'USER',actorId:input.actorPersonId,action:'RETAIL_REFERRER_ATTRIBUTION_CORRECTED_FORWARD',entityType:'RetailReferrerAttribution',entityId:created.retailReferrerAttributionId,beforeData:{ballNo:current.referrerBallNoSnapshot,effectiveTo:input.effectiveFrom.toISOString()},afterData:{ballNo:candidate.sponsorBallNo,effectiveFrom:input.effectiveFrom.toISOString(),reason:input.reason},requestId:input.requestId,correlationId});
      await outbox.enqueue(tx,{eventType:'RETAIL_REFERRER_ATTRIBUTION_CORRECTED_FORWARD',aggregateType:'RetailReferrerAttribution',aggregateId:created.retailReferrerAttributionId,payload:{personId:input.personId,effectiveFrom:input.effectiveFrom.toISOString()},correlationId});
      return {retailReferrerAttributionId:created.retailReferrerAttributionId,ballNo:created.referrerBallNoSnapshot,effectiveFrom:created.effectiveFrom.toISOString()};
    });
  }

  private hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
}
