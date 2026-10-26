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
exports.QualificationPlacementService = void 0;
const qualification_activation_gate_1 = require("./qualification-activation-gate");
const placement_workbench_1 = require('./placement-workbench');
const current_tree_1 = require('../binary-tree/current-tree');
const common_1 = require("@nestjs/common");
const database_1 = require("@ucell/database");
const node_crypto_1 = require("node:crypto");
const audit_service_1 = require("../../common/audit/audit.service");
const idempotency_service_1 = require("../../common/idempotency/idempotency.service");
const organization_service_1 = require("../organization/organization.service");
const qualification_access_service_1 = require("../auth/qualification-access.service");
const publicBallNo = /^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6}|\d{6,19})$/;
let QualificationPlacementService = class QualificationPlacementService {
    db;
    idempotency;
    audit;
    organization;
    constructor(db, idempotency, audit, organization) {
        this.db = db;
        this.idempotency = idempotency;
        this.audit = audit;
        this.organization = organization;
    }
    async branch(personId, reference, ballNo) { return (0, placement_workbench_1.memberPlacementBranch)(this.db, personId, reference, ballNo); }
    async dashboard(input) { return (0, placement_workbench_1.placementMonitor)(this.db, input); }
    async pendingForSponsorOwner(personId, now = new Date()) {
        const owned = await this.db.qualification.findMany({ where: { OR: [
                    { currentHolderPersonId: personId },
                    { currentHolderLegalEntity: { representatives: { some: { personId, roleCode: 'PRIMARY_OPERATING_REPRESENTATIVE', effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] } } } }
                ] }, select: { qualificationId: true } }), sponsorIds = owned.map(x => x.qualificationId);
        const rows = await this.db.qualificationSetup.findMany({ where: { setupStatus: { in: ['PLACEMENT_PENDING', 'PLACEMENT_OVERDUE'] }, finalSponsorQualificationId: { in: sponsorIds } }, orderBy: { placementDueAt: 'asc' }, take: 100 });
        const personIds = [...new Set(rows.map(x => x.ownerPersonId).filter((id) => !!id))], qualificationIds = [...new Set(rows.flatMap(x => [x.qualificationId, x.finalSponsorQualificationId].filter((id) => !!id)))];
        const [people, qualifications] = await Promise.all([this.db.person.findMany({ where: { personId: { in: personIds } }, select: { personId: true, memberNo: true } }), this.db.qualification.findMany({ where: { qualificationId: { in: qualificationIds } }, select: { qualificationId: true, qualificationNo: true, ballNo: true } })]);
        const memberNoByPerson = new Map(people.map(x => [x.personId, x.memberNo])), qualificationById = new Map(qualifications.map(x => [x.qualificationId, x]));
        return rows.map(x => { const pending = qualificationById.get(x.qualificationId); return this.view(x, now, { memberNo: (x.ownerPersonId ? memberNoByPerson.get(x.ownerPersonId) : null) ?? null, pendingBallNo: pending?.ballNo ?? null, placementReference: pending ? `P${pending.qualificationNo}` : null, sponsorBallNo: x.finalSponsorQualificationId ? qualificationById.get(x.finalSponsorQualificationId)?.ballNo ?? null : null }); });
    }
    async monitor(input = {}, now = new Date()) {
        const take = Math.min(Math.max(Number.isFinite(input.take) ? input.take : 50, 1), 100), rows = await this.db.qualificationSetup.findMany({ where: { setupStatus: { in: ['PLACEMENT_PENDING', 'PLACEMENT_OVERDUE', 'PLACED'] } }, orderBy: { placementDueAt: 'asc' }, take: 100 });
        return rows.map(x => this.view(x, now)).filter(x => (!input.status || x.status === input.status) && (!input.aging || x.agingBucket === input.aging)).slice(0, take);
    }
    async returnReviews() {
        const rows = await this.db.qualificationSetup.findMany({ where: { setupStatus: 'RETURN_REVIEW_PENDING' }, orderBy: { updatedAt: 'asc' }, take: 100 });
        return Promise.all(rows.map(async (row) => {
            const order = await this.db.order.findUniqueOrThrow({ where: { orderId: row.qualifyingOrderId } });
            const returned = await this.db.returnLine.aggregate({ where: { returnCase: { orderId: order.orderId, status: 'POSTED' } }, _sum: { returnAmount: true } });
            const purchase = await this.db.packagePurchaseSnapshot.findUniqueOrThrow({ where: { orderId: order.orderId } });
            const person = row.ownerPersonId ? await this.db.person.findUnique({ where: { personId: row.ownerPersonId }, select: { memberNo: true } }) : null;
            return { qualificationId: row.qualificationId, orderId: order.orderId, orderNo: order.orderNo.toString(), memberNo: person?.memberNo ?? null, originalPackageType: row.packageType, remainingAmount: purchase.priceAmount.sub(returned._sum.returnAmount ?? 0).toString(), status: row.setupStatus };
        }));
    }
    async approveReturnReview(actorId, qualificationId, input, key, requestId) {
        const prices = { STARTER: '14400', ELITE: '43200', LEADER: '72000' };
        if (!actorId || !prices[input.planLevelCode] || !input.reasonCode?.trim())
            throw new common_1.UnprocessableEntityException({ code: 'QUALIFICATION_RETURN_REVIEW_INPUT_REQUIRED' });
        return this.idempotency.execute(`admin:qualification-return-review:${qualificationId}`, key, input, async (tx) => {
            await tx.$queryRaw `SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${qualificationId},0))) lock_row`;
            const setup = await tx.qualificationSetup.findUniqueOrThrow({ where: { qualificationId } });
            if (setup.setupStatus !== 'RETURN_REVIEW_PENDING' || setup.placedAt)
                throw new common_1.ConflictException({ code: 'QUALIFICATION_RETURN_REVIEW_NOT_PENDING' });
            await tx.$queryRaw `SELECT order_id FROM commerce."order" WHERE order_id=${setup.qualifyingOrderId}::uuid FOR UPDATE`;
            const order = await tx.order.findUniqueOrThrow({ where: { orderId: setup.qualifyingOrderId } });
            const returned = await tx.returnLine.aggregate({ where: { returnCase: { orderId: order.orderId, status: 'POSTED' } }, _sum: { returnAmount: true } });
            const purchase = await tx.packagePurchaseSnapshot.findUniqueOrThrow({ where: { orderId: order.orderId } });
            const remaining = purchase.priceAmount.sub(returned._sum.returnAmount ?? 0);
            if (order.status !== 'PARTIAL_RETURN' || remaining.lt(new database_1.Prisma.Decimal(prices[input.planLevelCode]).sub(purchase.discountAmount)))
                throw new common_1.UnprocessableEntityException({ code: 'QUALIFICATION_RETAINED_AMOUNT_INSUFFICIENT' });
            const now = new Date(), correlationId = (0, node_crypto_1.randomUUID)(), status = setup.finalSponsorQualificationId ? 'PLACEMENT_PENDING' : 'BALL_SETUP_PENDING';
            await tx.qualification.update({ where: { qualificationId }, data: { planLevelCode: input.planLevelCode } });
            await tx.qualificationSetup.update({ where: { qualificationId }, data: { setupStatus: status, placementRequestedAt: setup.finalSponsorQualificationId ? now : null, placementDueAt: setup.finalSponsorQualificationId ? new Date(now.getTime() + 72 * 3600000) : null } });
            await this.audit.write(tx, { actorType: 'USER', actorId, action: 'QUALIFICATION_RETURN_REVIEW_APPROVED', entityType: 'Qualification', entityId: qualificationId, afterData: { ...input, orderId: order.orderId, remainingAmount: remaining.toString(), policy: database_1.qualificationReturnReviewPolicy }, requestId, correlationId });
            return { qualificationId, planLevelCode: input.planLevelCode, status, remainingAmount: remaining.toString() };
        });
    }
    async placeBySponsorOwner(personId, input, key, requestId) { return this.place(personId, 'SPONSOR_OWNER', input, key, requestId); }
    async placeBySponsorOwnerReference(personId, input, key, requestId) {
        const match = /^P([1-9]\d{0,18})$/.exec(input.placementReference);
        if (!match || BigInt(match[1]) > 9223372036854775807n || !publicBallNo.test(input.binaryParentBallNo))
            throw new common_1.UnprocessableEntityException({ code: 'PLACEMENT_REFERENCE_INVALID' });
        const [qualification, parent] = await Promise.all([this.db.qualification.findUnique({ where: { qualificationNo: BigInt(match[1]) }, select: { qualificationId: true, ballNo: true } }), this.db.qualification.findUnique({ where: { ballNo: input.binaryParentBallNo }, select: { qualificationId: true, ballNo: true } })]);
        if (!qualification || !parent)
            throw new common_1.NotFoundException({ code: 'PLACEMENT_BALL_NOT_FOUND' });
        const placed = await this.place(personId, 'SPONSOR_OWNER', { qualificationId: qualification.qualificationId, binaryParentQualificationId: parent.qualificationId, side: input.side }, key, requestId);
        const placedQualification = await this.db.qualification.findUniqueOrThrow({ where: { qualificationId: qualification.qualificationId }, select: { ballNo: true } });
        return { ballNo: placedQualification.ballNo, binaryParentBallNo: parent.ballNo, side: placed.value.side, placedAt: placed.value.placedAt, evidenceHash: placed.value.evidenceHash };
    }
    async placeByAdmin(actorPersonId, input, key, requestId) { if (!input.reasonCode?.trim())
        throw new common_1.UnprocessableEntityException({ code: 'PLACEMENT_OVERRIDE_REASON_REQUIRED' }); return this.place(actorPersonId, 'ADMIN_OVERRIDE', input, key, requestId); }
    async sweepOverdue(actorPersonId, key, requestId, now = new Date()) {
        return this.idempotency.execute(`admin:qualification-placement:sweep:${actorPersonId ?? 'system'}`, key, { asOf: now.toISOString() }, async (tx) => {
            const due = await tx.qualificationSetup.findMany({ where: { setupStatus: 'PLACEMENT_PENDING', placementDueAt: { lte: now } }, orderBy: { qualificationId: 'asc' }, take: 100 });
            for (const row of due) {
                const correlationId = (0, node_crypto_1.randomUUID)();
                await tx.qualificationSetup.updateMany({ where: { qualificationId: row.qualificationId, setupStatus: 'PLACEMENT_PENDING' }, data: { setupStatus: 'PLACEMENT_OVERDUE' } });
                await tx.placementEscalationEvidence.createMany({ data: [{ qualificationId: row.qualificationId, dueAt: row.placementDueAt, escalatedAt: now, escalationType: 'OVERDUE_72H', status: 'OPEN', assignedAdminId: actorPersonId, correlationId }], skipDuplicates: true });
                await tx.outboxEvent.create({ data: { eventType: 'QUALIFICATION_PLACEMENT_OVERDUE', aggregateType: 'Qualification', aggregateId: row.qualificationId, payload: { schemaVersion: 1, qualificationId: row.qualificationId, dueAt: row.placementDueAt.toISOString(), escalatedAt: now.toISOString() }, correlationId } });
            }
            return { processed: due.length, asOf: now.toISOString() };
        });
    }
    async place(actorPersonId, placedByType, input, key, requestId) {
        try {
            return await this.idempotency.execute(`${placedByType.toLowerCase()}:qualification-placement:${actorPersonId ?? 'system'}`, key, input, async (tx) => {
                await tx.$queryRaw `SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${input.qualificationId},0))) lock_row`;
                await tx.$queryRaw `SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`${input.binaryParentQualificationId}:${input.side}`},0))) lock_row`;
                const setup = await tx.qualificationSetup.findUnique({ where: { qualificationId: input.qualificationId } });
                if (!setup)
                    throw new common_1.NotFoundException({ code: 'QUALIFICATION_SETUP_NOT_FOUND' });
                if (!['PLACEMENT_PENDING', 'PLACEMENT_OVERDUE'].includes(setup.setupStatus) || !setup.finalSponsorQualificationId)
                    throw new common_1.ConflictException({ code: 'PLACEMENT_NOT_PENDING' });
                const [qualification, sponsor, parent, sponsorEdge, existingPlacement] = await Promise.all([
                    tx.qualification.findUnique({ where: { qualificationId: input.qualificationId } }), tx.qualification.findUnique({ where: { qualificationId: setup.finalSponsorQualificationId } }), tx.qualification.findUnique({ where: { qualificationId: input.binaryParentQualificationId } }), tx.sponsorRelationship.findUnique({ where: { childQualificationId: input.qualificationId } }), tx.binaryPlacement.findUnique({ where: { childQualificationId: input.qualificationId } })
                ]);
                if (!qualification || !sponsor || !parent)
                    throw new common_1.NotFoundException({ code: 'PLACEMENT_RESOURCE_NOT_FOUND' });
                if (existingPlacement)
                    throw new common_1.ConflictException({ code: 'PLACEMENT_CONFLICT' });
                await (0, qualification_activation_gate_1.assertQualificationActivation)(tx, setup);
                if (!sponsorEdge || sponsorEdge.sponsorQualificationId !== setup.finalSponsorQualificationId)
                    throw new common_1.ConflictException({ code: 'SPONSOR_CONFIRMATION_MISSING' });
                if (placedByType === 'SPONSOR_OWNER') {
                    if (!actorPersonId)
                        throw new common_1.ForbiddenException({ code: 'PLACEMENT_AUTHORITY_DENIED' });
                    try {
                        await new qualification_access_service_1.QualificationAccessService(tx).assertHolder(actorPersonId, sponsor.qualificationId);
                    }
                    catch {
                        throw new common_1.ForbiddenException({ code: 'PLACEMENT_AUTHORITY_DENIED' });
                    }
                }
                if (parent.status !== 'EFFECTIVE')
                    throw new common_1.UnprocessableEntityException({ code: 'BINARY_PARENT_NOT_ELIGIBLE' });
                const allocation = await tx.ballNoAllocation.findUnique({ where: { qualificationId: input.qualificationId } });
                if (!allocation)
                    throw new common_1.ConflictException({ code: 'BINARY_TREE_SCOPE_MISMATCH' });
                await (0, current_tree_1.assertCurrentPlacement)(tx, allocation.binaryTreeId, input.qualificationId, input.binaryParentQualificationId);
                const side = input.side;
                await this.organization.assertBinarySlotAvailable(tx, input.binaryParentQualificationId, side);
                await this.organization.assertNoBinaryCycle(tx, input.qualificationId, input.binaryParentQualificationId);
                await this.organization.assertFirstThirdLeftRule(tx, setup.finalSponsorQualificationId, sponsorEdge.sponsorSequenceNo, input.binaryParentQualificationId, side);
                const placedAt = new Date(), correlationId = (0, node_crypto_1.randomUUID)(), evidenceBody = { qualificationId: input.qualificationId, sponsorQualificationId: setup.finalSponsorQualificationId, binaryParentQualificationId: input.binaryParentQualificationId, side, placedByType, placedByPersonId: actorPersonId ?? null, placedAt: placedAt.toISOString(), reasonCode: input.reasonCode ?? null, policyVersion: setup.setupPolicyVersion, previousStatus: setup.setupStatus }, evidenceHash = (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(evidenceBody)).digest('hex');
                await this.organization.createBinaryPlacement(tx, { parentQualificationId: input.binaryParentQualificationId, childQualificationId: input.qualificationId, side, effectiveFrom: placedAt }, { sourceType: 'DEFERRED_PLACEMENT', actorId: actorPersonId, actorType: placedByType === 'SPONSOR_OWNER' ? 'MEMBER' : 'ADMIN', correlationId, reason: input.reasonCode ?? placedByType });
                const evidence = await tx.placementEvidence.create({ data: { ...evidenceBody, placedAt, placedByPersonId: actorPersonId, reasonCode: input.reasonCode?.trim() || undefined, correlationId, evidenceHash } });
                await tx.qualificationStatusHistory.updateMany({ where: { qualificationId: input.qualificationId, effectiveTo: null }, data: { effectiveTo: placedAt } });
                const plan = await tx.qualificationPlanHistory.findFirst({ where: { qualificationId: input.qualificationId, effectiveTo: null } });
                if (!qualification.planLevelCode)
                    throw new common_1.UnprocessableEntityException({ code: 'QUALIFICATION_PLAN_REQUIRED' });
                if (!plan)
                    await tx.qualificationPlanHistory.create({ data: { qualificationId: input.qualificationId, planCode: qualification.planLevelCode, effectiveFrom: placedAt, sourceType: 'QUALIFICATION_PLACEMENT', sourceId: evidence.placementEvidenceId } });
                await tx.qualificationSetup.update({ where: { qualificationId: input.qualificationId }, data: { setupStatus: 'PLACED', placedAt } });
                await tx.qualification.update({ where: { qualificationId: input.qualificationId }, data: { status: 'EFFECTIVE', effectiveAt: placedAt } });
                await tx.qualificationStatusHistory.create({ data: { qualificationId: input.qualificationId, status: 'EFFECTIVE', effectiveFrom: placedAt, sourceType: 'QUALIFICATION_PLACEMENT', sourceId: evidence.placementEvidenceId } });
                await this.audit.write(tx, { actorType: placedByType === 'ADMIN_OVERRIDE' ? 'USER' : 'MEMBER', actorId: actorPersonId, action: 'QUALIFICATION_PLACED', entityType: 'Qualification', entityId: input.qualificationId, afterData: { ...evidenceBody, evidenceHash }, requestId, correlationId });
                await tx.outboxEvent.create({ data: { eventType: 'QUALIFICATION_PLACED', aggregateType: 'Qualification', aggregateId: input.qualificationId, payload: { schemaVersion: 1, ...evidenceBody, evidenceHash }, correlationId } });
                return { placementEvidenceId: evidence.placementEvidenceId, ...evidenceBody, evidenceHash };
            });
        }
        catch (error) {
            if (['P2002', 'P2034'].includes(error.code) || (error.code === 'P2010' && error.meta?.code === '40001'))
                throw new common_1.ConflictException({ code: 'PLACEMENT_CONFLICT' });
            throw error;
        }
    }
    view(row, now, identity) { const status = row.setupStatus === 'PLACEMENT_PENDING' && row.placementDueAt && row.placementDueAt <= now ? 'PLACEMENT_OVERDUE' : row.setupStatus, ageMs = row.placementRequestedAt ? Math.max(0, now.getTime() - row.placementRequestedAt.getTime()) : 0, h = Math.floor(ageMs / 3600000), agingBucket = status === 'PLACEMENT_OVERDUE' || h >= 72 ? 'OVERDUE' : h >= 48 ? '48_72H' : h >= 24 ? '24_48H' : '0_24H'; return { pendingBallNo: identity?.pendingBallNo ?? null, placementReference: identity?.placementReference ?? null, pendingMemberNo: identity?.memberNo ?? null, packageType: row.packageType, sponsorBallNo: identity?.sponsorBallNo ?? null, paymentState: 'CONFIRMED', requestedAt: row.placementRequestedAt?.toISOString() ?? null, dueAt: row.placementDueAt?.toISOString() ?? null, placedAt: row.placedAt?.toISOString() ?? null, status, agingBucket, policyVersion: row.setupPolicyVersion }; }
};
exports.QualificationPlacementService = QualificationPlacementService;
exports.QualificationPlacementService = QualificationPlacementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_1.PrismaService, idempotency_service_1.IdempotencyService, audit_service_1.AuditService, organization_service_1.OrganizationService])
], QualificationPlacementService);
