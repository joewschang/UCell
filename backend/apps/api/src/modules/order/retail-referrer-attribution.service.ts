import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { createHash, randomUUID } from 'crypto';
import { SponsorResolver } from '../qualification/sponsor-resolver.service';

/**
 * Authoritative retail attribution boundary. It deliberately never writes a
 * SponsorRelationship, BinaryPlacement, PV event, or Qualification.
 */
@Injectable()
export class RetailReferrerAttributionService {
  constructor(private readonly db: PrismaService, private readonly sponsors: SponsorResolver) {}

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

  private hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
}