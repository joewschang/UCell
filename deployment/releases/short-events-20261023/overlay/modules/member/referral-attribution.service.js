"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralAttributionService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@ucell/database");
const node_crypto_1 = require("node:crypto");
const audit_service_1 = require("../../common/audit/audit.service");
const idempotency_service_1 = require("../../common/idempotency/idempotency.service");
const member_share_link_service_1 = require("./member-share-link.service");
const LOCK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
let ReferralAttributionService = class ReferralAttributionService {
    db;
    links;
    idempotency;
    audit;
    constructor(db, links, idempotency, audit) {
        this.db = db;
        this.links = links;
        this.idempotency = idempotency;
        this.audit = audit;
    }
    async land(token, anonymousId = (0, node_crypto_1.randomUUID)(), now = new Date()) {
        token = await this.links.resolveToken(token);
        const preview = await this.links.preview(token, now);
        const payload = this.links.verify(token, now), tokenHash = this.links.hash(token), correlationId = (0, node_crypto_1.randomUUID)();
        try {
            const result = await this.db.$transaction(async (tx) => {
                await tx.$queryRaw `SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${anonymousId},0))) AS lock_row`;
                const link = await tx.referralLink.findUnique({ where: { tokenHash } });
                if (!link || link.status !== 'ACTIVE' || link.expiresAt <= now || link.referrerQualificationId !== payload.qualificationId)
                    throw new common_1.ServiceUnavailableException({ code: 'MEMBER_SHARE_TOKEN_INVALID' });
                const current = await tx.referralAttribution.findUnique({ where: { anonymousId } });
                if (!current) {
                    const lockedUntil = new Date(now.getTime() + LOCK_WINDOW_MS);
                    const created = await tx.referralAttribution.create({ data: { anonymousId, referrerQualificationId: link.referrerQualificationId, referralLinkId: link.referralLinkId, firstTouchAt: now, lastTouchAt: now, lockedUntil } });
                    await tx.referralAttributionHistory.create({ data: { referralAttributionId: created.referralAttributionId, action: 'CREATED', newReferrerQualificationId: link.referrerQualificationId, reasonCode: 'FIRST_VALID_TOUCH', referralLinkId: link.referralLinkId, correlationId, occurredAt: now } });
                    return this.view(created, true, false, 'FIRST_VALID_TOUCH', link.policyVersion);
                }
                if (current.referrerQualificationId === link.referrerQualificationId && now < current.lockedUntil) {
                    const updated = await tx.referralAttribution.update({ where: { referralAttributionId: current.referralAttributionId }, data: { lastTouchAt: now, referralLinkId: link.referralLinkId, version: { increment: 1 } } });
                    await tx.referralAttributionHistory.create({ data: { referralAttributionId: current.referralAttributionId, action: 'TOUCH_RECORDED', previousReferrerQualificationId: current.referrerQualificationId, newReferrerQualificationId: link.referrerQualificationId, reasonCode: 'SAME_REFERRER_LOCK_UNCHANGED', referralLinkId: link.referralLinkId, correlationId, occurredAt: now } });
                    return this.view(updated, true, false, 'SAME_REFERRER_LOCK_UNCHANGED', link.policyVersion);
                }
                if (now < current.lockedUntil) {
                    await tx.referralAttributionHistory.create({ data: { referralAttributionId: current.referralAttributionId, action: 'COMPETING_TOUCH_RECORDED', previousReferrerQualificationId: current.referrerQualificationId, newReferrerQualificationId: link.referrerQualificationId, reasonCode: 'ATTRIBUTION_LOCK_ACTIVE', referralLinkId: link.referralLinkId, correlationId, occurredAt: now } });
                    return this.view(current, false, false, 'ATTRIBUTION_LOCK_ACTIVE', link.policyVersion);
                }
                const lockedUntil = new Date(now.getTime() + LOCK_WINDOW_MS);
                const replaced = await tx.referralAttribution.update({ where: { referralAttributionId: current.referralAttributionId }, data: { referrerQualificationId: link.referrerQualificationId, referralLinkId: link.referralLinkId, firstTouchAt: now, lastTouchAt: now, lockedUntil, version: { increment: 1 } } });
                await tx.referralAttributionHistory.create({ data: { referralAttributionId: current.referralAttributionId, action: 'REPLACED', previousReferrerQualificationId: current.referrerQualificationId, newReferrerQualificationId: link.referrerQualificationId, reasonCode: 'ATTRIBUTION_LOCK_EXPIRED', referralLinkId: link.referralLinkId, correlationId, occurredAt: now } });
                return this.view(replaced, true, true, 'ATTRIBUTION_LOCK_EXPIRED', link.policyVersion);
            }, { isolationLevel: database_1.Prisma.TransactionIsolationLevel.Serializable });
            return { ...result, destination: preview.destination };
        }
        catch (error) {
            if (error.code === 'P2034')
                throw new common_1.ConflictException({ code: 'RETRYABLE_CONFLICT' });
            throw error;
        }
    }
    async bind(personId, transitionState, idempotencyKey, requestId, now = new Date()) {
        const state = this.links.verifyTransition(transitionState, now);
        try {
            const result = await this.idempotency.execute(`member:referral:bind:${personId}`, idempotencyKey, { transitionStateHash: this.links.hash(transitionState) }, async (tx) => {
                await tx.$queryRaw `SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${state.anonymousId},0))) AS anonymous_lock`;
                await tx.$queryRaw `SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${personId},0))) AS person_lock`;
                const attribution = await tx.referralAttribution.findUnique({ where: { referralAttributionId: state.referralAttributionId } });
                if (!attribution || attribution.anonymousId !== state.anonymousId || attribution.referrerQualificationId !== state.referrerQualificationId || attribution.status !== 'ACTIVE')
                    throw new common_1.ConflictException({ code: 'REFERRAL_ATTRIBUTION_NOT_BINDABLE' });
                if (attribution.personId && attribution.personId !== personId)
                    throw new common_1.ConflictException({ code: 'REFERRAL_ATTRIBUTION_PERSON_CONFLICT' });
                if (attribution.personId === personId)
                    return { referralAttributionId: attribution.referralAttributionId, referrerQualificationId: attribution.referrerQualificationId, status: 'ALREADY_BOUND', boundAt: null };
                if (attribution.version !== state.attributionVersion || attribution.lockedUntil <= now)
                    throw new common_1.ConflictException({ code: 'REFERRAL_ATTRIBUTION_NOT_BINDABLE' });
                const other = await tx.referralAttribution.findFirst({ where: { personId, status: 'ACTIVE', lockedUntil: { gt: now }, NOT: { referralAttributionId: attribution.referralAttributionId } } });
                if (other)
                    throw new common_1.ConflictException({ code: 'PERSON_REFERRAL_ATTRIBUTION_CONFLICT' });
                const updated = await tx.referralAttribution.update({ where: { referralAttributionId: attribution.referralAttributionId }, data: { personId, version: { increment: 1 } } }), correlationId = (0, node_crypto_1.randomUUID)();
                await tx.referralAttributionHistory.create({ data: { referralAttributionId: updated.referralAttributionId, action: 'BOUND_TO_PERSON', previousReferrerQualificationId: updated.referrerQualificationId, newReferrerQualificationId: updated.referrerQualificationId, reasonCode: 'AUTHENTICATED_PERSON_BOUND', referralLinkId: updated.referralLinkId, boundPersonId: personId, correlationId, occurredAt: now } });
                await this.audit.write(tx, { actorType: 'MEMBER', actorId: personId, action: 'REFERRAL_ATTRIBUTION_BOUND', entityType: 'ReferralAttribution', entityId: updated.referralAttributionId, beforeData: { personBound: false }, afterData: { personBound: true, referrerQualificationId: updated.referrerQualificationId }, requestId, correlationId });
                await tx.outboxEvent.create({ data: { eventType: 'REFERRAL_ATTRIBUTION_BOUND', aggregateType: 'ReferralAttribution', aggregateId: updated.referralAttributionId, payload: { schemaVersion: 1, referralAttributionId: updated.referralAttributionId, personId, referrerQualificationId: updated.referrerQualificationId }, correlationId } });
                return { referralAttributionId: updated.referralAttributionId, referrerQualificationId: updated.referrerQualificationId, status: 'BOUND', boundAt: now.toISOString() };
            });
            return { ...result.value, replayed: result.replayed };
        }
        catch (error) {
            if (['P2002', 'P2034'].includes(error.code))
                throw new common_1.ConflictException({ code: 'RETRYABLE_CONFLICT' });
            throw error;
        }
    }
    view(row, accepted, replaced, reasonCode, policyVersion) { const transitionState = this.links.createTransition({ anonymousId: row.anonymousId, referralAttributionId: row.referralAttributionId, referrerQualificationId: row.referrerQualificationId, attributionVersion: row.version, issuedAt: row.lastTouchAt, expiresAt: row.lockedUntil }); return { anonymousId: row.anonymousId, referralAttributionId: row.referralAttributionId, referrerQualificationId: row.referrerQualificationId, firstTouchAt: row.firstTouchAt.toISOString(), lastTouchAt: row.lastTouchAt.toISOString(), lockedUntil: row.lockedUntil.toISOString(), accepted, replaced, reasonCode, policyVersion, transitionState, transitionExpiresAt: row.lockedUntil.toISOString() }; }
};
exports.ReferralAttributionService = ReferralAttributionService;
exports.ReferralAttributionService = ReferralAttributionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_1.PrismaService, member_share_link_service_1.MemberShareLinkService, idempotency_service_1.IdempotencyService, audit_service_1.AuditService])
], ReferralAttributionService);
//# sourceMappingURL=referral-attribution.service.js.map