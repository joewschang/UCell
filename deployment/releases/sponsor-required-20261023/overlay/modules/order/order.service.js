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
exports.OrderService = void 0;
const package_parameters_1 = require("./package-parameters");
const formal_enrollment_payment_1 = require("../member/formal-enrollment-payment");
const common_1 = require("@nestjs/common");
const database_1 = require("@ucell/database");
const crypto_1 = require("crypto");
const audit_service_1 = require("../../common/audit/audit.service");
const idempotency_service_1 = require("../../common/idempotency/idempotency.service");
const outbox_service_1 = require("../../common/outbox/outbox.service");
const qualification_access_service_1 = require("../auth/qualification-access.service");
const package_config_service_1 = require("../package-config/package-config.service");
const sponsor_resolver_service_1 = require("../qualification/sponsor-resolver.service");
const organization_service_1 = require("../organization/organization.service");
const retail_referrer_attribution_service_1 = require("./retail-referrer-attribution.service");
const commercial_offering_service_1 = require("./commercial-offering.service");
let OrderService = class OrderService {
    prisma;
    idempotency;
    audit;
    outbox;
    packages;
    sponsors;
    organization;
    retailAttributions;
    commercialOfferings;
    constructor(prisma, idempotency, audit, outbox, packages, sponsors, organization, retailAttributions, commercialOfferings) {
        this.prisma = prisma;
        this.idempotency = idempotency;
        this.audit = audit;
        this.outbox = outbox;
        this.packages = packages;
        this.sponsors = sponsors;
        this.organization = organization;
        this.retailAttributions = retailAttributions;
        this.commercialOfferings = commercialOfferings;
    }
    async resolveOfferingSnapshot(tx, offeringCode, channel, at) {
        if (!offeringCode)
            return undefined;
        return (this.commercialOfferings ?? new commercial_offering_service_1.CommercialOfferingService()).resolveEffective(tx, { offeringCode, channel, at });
    }
    async resolveLineOffering(tx, item, product, root, channel, at, purpose) {
        if (!item.commercialOfferingCode)
            return root;
        if (root || purpose !== 'RETAIL')
            throw new common_1.UnprocessableEntityException({ code: 'LINE_OFFERING_NOT_ALLOWED' });
        const offer = await this.resolveOfferingSnapshot(tx, item.commercialOfferingCode, channel, at);
        const rule = offer?.selectionRule;
        if (offer?.offeringType !== 'CORE_PRODUCT' || !Array.isArray(rule?.eligibleSkus) || !rule.eligibleSkus.includes(product.sku))
            throw new common_1.UnprocessableEntityException({ code: 'LINE_OFFERING_SKU_NOT_ELIGIBLE' });
        return offer;
    }
    assertOfferingPurpose(offering, purpose) {
        if (!offering)
            return;
        const allowed = {
            ENTRY: ['QUALIFICATION_PACKAGE'],
            UPGRADE: ['QUALIFICATION_PACKAGE'],
            REPURCHASE: ['REPURCHASE_PLAN'],
            SUBSCRIPTION_PREPAY: ['REPURCHASE_PLAN'],
            RETAIL: ['CORE_PRODUCT', 'RETAIL_PRODUCT', 'PROMOTIONAL_BUNDLE'],
        };
        if (!allowed[purpose]?.includes(offering.offeringType)) {
            throw new common_1.UnprocessableEntityException({ code: 'COMMERCIAL_OFFERING_PURPOSE_NOT_ALLOWED' });
        }
    }
    assertOfferingSelection(offering, selections) {
        if (!offering)
            return;
        if (offering.offeringType === 'PROMOTIONAL_BUNDLE') {
            const rule = offering.selectionRule;
            if (!rule) {
                const composition = Array.isArray(offering.composition) ? offering.composition : [];
                const actual = new Map();
                for (const row of selections)
                    actual.set(row.product.sku, (actual.get(row.product.sku) ?? 0) + Number(row.quantity));
                const expected = new Map();
                for (const row of composition)
                    if (typeof row.sku === 'string')
                        expected.set(row.sku, Number(row.quantity));
                if (actual.size !== expected.size || [...expected].some(([sku, quantity]) => actual.get(sku) !== quantity))
                    throw new common_1.UnprocessableEntityException({ code: 'PROMOTIONAL_BUNDLE_COMPOSITION_MISMATCH' });
                return;
            }
        }
        if (!['QUALIFICATION_PACKAGE', 'REPURCHASE_PLAN', 'PROMOTIONAL_BUNDLE'].includes(offering.offeringType))
            return;
        const rule = offering.selectionRule;
        const required = Number(rule?.requiredTotalQuantity), eligible = Array.isArray(rule?.eligibleSkus) ? rule.eligibleSkus : [];
        const total = selections.reduce((sum, row) => sum + Number(row.quantity), 0);
        if (!Number.isInteger(required) || required < 1 || total !== required)
            throw new common_1.UnprocessableEntityException({ code: 'COMMERCIAL_OFFERING_SELECTION_TOTAL_MISMATCH' });
        if (!selections.every(row => eligible.includes(row.product.sku)))
            throw new common_1.UnprocessableEntityException({ code: 'COMMERCIAL_OFFERING_SELECTION_SKU_NOT_ELIGIBLE' });
    }
    async createMember(dto, key, requestId, personId) {
        if (dto.packageVersionId)
            return this.createPackageForPerson(dto, key, requestId, personId);
        if (!dto.items?.length || dto.selections?.length)
            throw new common_1.UnprocessableEntityException({ code: 'INVALID_ORDER_SHAPE' });
        if (!dto.qualificationId)
            return this.createWebRetailMember(dto, key, requestId, personId);
        await new qualification_access_service_1.QualificationAccessService(this.prisma).assertHolder(personId, dto.qualificationId);
        try {
            return await this.create({ qualificationId: dto.qualificationId, items: dto.items, purpose: 'RETAIL', sourceReferralToken: dto.sourceReferralToken, clientReference: dto.clientReference, commercialOfferingCode: dto.commercialOfferingCode, linePurpose: dto.linePurpose }, key, requestId, personId, true);
        }
        catch (error) {
            if (['P2002', 'P2034'].includes(error.code))
                throw new common_1.ConflictException({ code: 'RETRYABLE_CONFLICT', message: 'Concurrent operation; retry the identical request with the same Idempotency-Key.' });
            throw error;
        }
    }
    async createWebRetailMember(dto, key, requestId, personId) {
        if (dto.sponsorCode)
            throw new common_1.UnprocessableEntityException({ code: 'QUALIFICATION_SPONSOR_CODE_NOT_ALLOWED_FOR_RETAIL' });
        const correlationId = (0, crypto_1.randomUUID)();
        try {
            return await this.idempotency.execute(`member:web-retail-order:create:${personId}`, key, dto, async (tx) => {
                const person = await tx.person.findUnique({ where: { personId }, select: { status: true } });
                if (person?.status !== 'EFFECTIVE')
                    throw new common_1.ConflictException({ code: 'MEMBER_PERSON_DISABLED' });
                const ownedEffective = await tx.qualification.count({ where: { currentHolderPersonId: personId, status: 'EFFECTIVE' } });
                if (ownedEffective)
                    throw new common_1.ConflictException({ code: 'QUALIFIED_MEMBER_RETAIL_REQUIRES_BALL_CONTEXT' });
                const delivery = await tx.deliveryProfile.findFirst({ where: { personId, effectiveTo: null }, select: { deliveryProfileId: true } });
                if (!delivery)
                    throw new common_1.UnprocessableEntityException({ code: 'DELIVERY_PROFILE_REQUIRED', message: '請先完成配送資料，再建立零售訂單。' });
                const now = new Date(), offering = await this.resolveOfferingSnapshot(tx, dto.commercialOfferingCode, 'WEB_MEMBER', now), productIds = [...new Set(dto.items.map(item => item.productId))];
                this.assertOfferingPurpose(offering, 'RETAIL');
                const products = await tx.productReference.findMany({ where: { productId: { in: productIds }, isActive: true } });
                if (products.length !== productIds.length)
                    throw new common_1.ConflictException({ code: 'RESOURCE_NOT_FOUND' });
                this.assertOfferingSelection(offering, dto.items.map(item => ({ product: products.find(product => product.productId === item.productId), quantity: Number(item.quantity) })));
                const lines = [];
                let gross = new database_1.Prisma.Decimal(0);
                let ruleVersionCode = 'R1.0B';
                let parameterSnapshotHash;
                for (const item of dto.items) {
                    const product = products.find(row => row.productId === item.productId);
                    const lineOffering = await this.resolveLineOffering(tx, item, product, offering, 'WEB_MEMBER', now, 'RETAIL');
                    const profiles = await tx.productRuleProfile.findMany({ where: { productId: product.productId, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, orderBy: { effectiveFrom: 'desc' } });
                    if (profiles.length !== 1)
                        throw new common_1.UnprocessableEntityException({ code: 'RULE_PROFILE_CONFIGURATION_PENDING' });
                    const profile = profiles[0];
                    const quantity = new database_1.Prisma.Decimal(item.quantity);
                    if (!quantity.isInteger() || quantity.lte(0) || quantity.gt(99) || product.currentPrice.lt(0))
                        throw new common_1.UnprocessableEntityException({ code: 'INVALID_PRODUCT_QUANTITY_OR_PRICE' });
                    const lineAmount = product.currentPrice.mul(quantity);
                    gross = gross.add(lineAmount);
                    ruleVersionCode = profile.ruleVersionCode;
                    parameterSnapshotHash = profile.parameterSnapshotHash ?? parameterSnapshotHash;
                    lines.push({ productId: product.productId, skuSnapshot: product.sku, productNameSnapshot: product.displayName, quantity, unitPrice: product.currentPrice, lineAmount, gpvRateSnapshot: lineOffering?.offeringType === 'CORE_PRODUCT' ? profile.gpvRate : new database_1.Prisma.Decimal(0), gpvAmountSnapshot: lineOffering?.offeringType === 'CORE_PRODUCT' ? lineAmount.mul(profile.gpvRate).toDecimalPlaces(2) : new database_1.Prisma.Decimal(0), pvRateSnapshot: lineOffering?.offeringType === 'CORE_PRODUCT' ? profile.pvRate : new database_1.Prisma.Decimal(0), ruleProfileSnapshot: { profileId: profile.productRuleProfileId, ruleVersionCode: profile.ruleVersionCode, parameterSnapshotHash: profile.parameterSnapshotHash, pricingContext: 'WEB_MEMBER_RETAIL_LIST_PRICE', retailReferral: { enabled: profile.retailReferralEnabled, calculationType: profile.retailReferralCalculationType, rate: profile.retailReferralRate?.toString() ?? null, baseType: profile.retailReferralBaseType } }, commercialOfferingVersionId: lineOffering?.commercialOfferingVersionId, commercialOfferingSnapshot: lineOffering, linePurpose: dto.linePurpose });
                }
                const order = await tx.order.create({ data: { purchaserPersonId: personId, purpose: 'RETAIL', status: 'CONFIRMED', grossAmount: gross, discountAmount: new database_1.Prisma.Decimal(0), netAmount: gross, ruleVersionCode, parameterSnapshotHash, clientReference: dto.clientReference, confirmedAt: now, lines: { create: lines } }, include: { lines: true } });
                const attribution = await (this.retailAttributions ?? new retail_referrer_attribution_service_1.RetailReferrerAttributionService(this.prisma, this.sponsors ?? new sponsor_resolver_service_1.SponsorResolver(this.prisma))).resolveForRetailOrder(tx, { personId, candidateCode: dto.retailReferralCode, orderId: order.orderId, at: now, correlationId });
                const profileById = new Map();
                for (const item of lines) {
                    const profileId = item.ruleProfileSnapshot.profileId;
                    if (!profileById.has(profileId))
                        profileById.set(profileId, await tx.productRuleProfile.findUniqueOrThrow({ where: { productRuleProfileId: profileId } }));
                }
                await tx.retailReferralOrderLineSnapshot.createMany({
                    data: order.lines.map(line => {
                        const profile = profileById.get(line.ruleProfileSnapshot.profileId);
                        return {
                            orderLineId: line.orderLineId, orderId: order.orderId,
                            retailReferrerAttributionId: attribution?.retailReferrerAttributionId,
                            referrerQualificationId: attribution?.referrerQualificationId,
                            referrerBallNoSnapshot: attribution?.referrerBallNoSnapshot,
                            retailReferralEnabled: profile.retailReferralEnabled,
                            calculationType: profile.retailReferralCalculationType, rate: profile.retailReferralRate,
                            baseType: profile.retailReferralBaseType, netPaidItemAmount: line.lineAmount,
                            productRuleProfileId: profile.productRuleProfileId, productRuleVersion: profile.ruleVersionCode,
                            parameterSnapshotHash: profile.parameterSnapshotHash,
                            attributionEvidence: { attributionId: attribution?.retailReferrerAttributionId ?? null, source: attribution?.source ?? 'NONE', asOf: now.toISOString() },
                        };
                    }),
                });
                await this.audit.write(tx, { actorType: 'MEMBER', actorId: personId, action: 'WEB_MEMBER_RETAIL_ORDER_CREATED', entityType: 'ORDER', entityId: order.orderId, afterData: { orderId: order.orderId, personId, qualificationId: null, netAmount: order.netAmount.toString(), retailReferrerBallNo: attribution?.referrerBallNoSnapshot ?? null }, requestId, correlationId });
                await this.outbox.enqueue(tx, { eventType: 'WEB_MEMBER_RETAIL_ORDER_CREATED', aggregateType: 'ORDER', aggregateId: order.orderId, payload: { schemaVersion: 1, orderId: order.orderId, personId, recognitionStatus: 'PAYMENT_PENDING' }, correlationId });
                return order;
            });
        }
        catch (error) {
            if (['P2002', 'P2034', '23P01'].includes(error.code))
                throw new common_1.ConflictException({ code: 'RETRYABLE_CONFLICT' });
            throw error;
        }
    }
    async listWebRetailMember(personId) {
        const orders = await this.prisma.order.findMany({ where: { purchaserPersonId: personId, qualificationId: null, purpose: 'RETAIL' }, select: { orderNo: true, status: true, netAmount: true, createdAt: true, confirmedAt: true, lines: { select: { productNameSnapshot: true, quantity: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
        return orders.map(order => ({ orderNo: order.orderNo.toString(), status: order.status, total: order.netAmount.toString(), createdAt: order.createdAt.toISOString(), confirmedAt: order.confirmedAt?.toISOString() ?? null, itemCount: order.lines.reduce((count, line) => count + Number(line.quantity), 0), itemNames: order.lines.map(line => line.productNameSnapshot) }));
    }
    async createPaperQualification(dto, key, requestId, actorId, paperApplicationId) {
        const application = await this.prisma.paperApplication.findUnique({ where: { paperApplicationId }, select: { personId: true } });
        if (!application)
            throw new common_1.ConflictException({ code: 'PAPER_APPLICATION_NOT_FOUND' });
        return this.createPackageForPerson(dto, key, requestId, application.personId, { scope: `admin:paper-package-order:create:${paperApplicationId}`, actorId, paperApplicationId });
    }
    async createPaperQualificationByNo(dto, key, requestId, actorId, paperApplicationNo) {
        const application = await this.prisma.paperApplication.findUnique({ where: { paperApplicationNo }, select: { paperApplicationId: true } });
        if (!application)
            throw new common_1.ConflictException({ code: 'PAPER_APPLICATION_NOT_FOUND' });
        return this.createPaperQualification(dto, key, requestId, actorId, application.paperApplicationId);
    }
    async createPackageForPerson(dto, key, requestId, personId, paper) {
        if (dto.items?.length || !Array.isArray(dto.selections))
            throw new common_1.UnprocessableEntityException({ code: 'INVALID_PACKAGE_ORDER_SHAPE' });
        const correlationId = (0, crypto_1.randomUUID)();
        try {
            return await this.idempotency.execute(paper?.scope ?? `member:package-order:create:${personId}`, key, dto, async (tx) => {
                const person = await tx.person.findUnique({ where: { personId } });
                if (!person || (paper ? !['DRAFT', 'EFFECTIVE'].includes(person.status) : person.status !== 'EFFECTIVE'))
                    throw new common_1.ConflictException({ code: paper ? 'PAPER_PERSON_NOT_ELIGIBLE' : 'MEMBER_PERSON_DISABLED' });
                if (paper) {
                    const application = await tx.paperApplication.findUnique({ where: { paperApplicationId: paper.paperApplicationId }, select: { personId: true, orderId: true, status: true } });
                    if (!application || application.personId !== personId || application.status !== 'OPEN')
                        throw new common_1.ConflictException({ code: 'PAPER_APPLICATION_NOT_OPEN' });
                    if (application.orderId)
                        throw new common_1.ConflictException({ code: 'PAPER_APPLICATION_ORDER_ALREADY_CREATED' });
                }
                const now = new Date(), offering = await this.resolveOfferingSnapshot(tx, dto.commercialOfferingCode, paper ? 'ADMIN_PAPER' : 'WEB_MEMBER', now), prepared = await (this.packages ?? new package_config_service_1.PackageConfigService(this.prisma)).checkoutData(tx, personId, { packageVersionId: dto.packageVersionId, couponCode: dto.couponCode, quoteHash: dto.quoteHash, targetQualificationId: dto.targetQualificationId, legalEntityId: dto.legalEntityId, selections: dto.selections }, now), v = prepared.version, pricing = prepared.pricing;
                const paymentDeadline = v.profile.packageClass === 'QUALIFICATION' ? new Date(Math.min(now.getTime() + 48 * 60 * 60 * 1000, pricing.endsAt ? Date.parse(pricing.endsAt) : Infinity)) : null;
                this.assertOfferingPurpose(offering, v.profile.packageClass === 'QUALIFICATION' ? 'ENTRY' : 'REPURCHASE');
                this.assertOfferingSelection(offering, prepared.selections);
                let qualificationId = dto.targetQualificationId;
                let sponsorEvidence;
                if (v.profile.packageClass === 'QUALIFICATION') {
                    if (!paper && !dto.sponsorCode?.trim()) throw new common_1.UnprocessableEntityException({ code: 'QUALIFICATION_SPONSOR_REQUIRED' });
                    if (dto.sponsorCode)
                        sponsorEvidence = await (this.sponsors ?? new sponsor_resolver_service_1.SponsorResolver(this.prisma)).resolveWithin(tx, { code: dto.sponsorCode, effectiveAt: now, ruleVersion: 'R1.0B' });
                    const qualification = await tx.qualification.create({ data: { currentHolderPersonId: dto.legalEntityId ? null : personId, currentHolderLegalEntityId: dto.legalEntityId ?? null, planLevelCode: v.profile.stableCode, status: 'DRAFT', activeFlag: false } });
                    qualificationId = qualification.qualificationId;
                    await tx.qualificationHolderHistory.create({ data: { qualificationId, holderPersonId: dto.legalEntityId ? null : personId, holderLegalEntityId: dto.legalEntityId ?? null, effectiveFrom: now, sourceType: 'PACKAGE_CHECKOUT' } });
                    await tx.qualificationOwnerInterval.create({ data: { qualificationId, ownerType: dto.legalEntityId ? 'LEGAL_ENTITY' : 'MEMBER', personId: dto.legalEntityId ? null : personId, legalEntityId: dto.legalEntityId ?? null, companyPrincipalId: null, effectiveFrom: now, sourceType: 'PACKAGE_CHECKOUT', sourceId: qualificationId, evidenceHash: (0, crypto_1.createHash)('sha256').update(JSON.stringify({ qualificationId, personId: dto.legalEntityId ? null : personId, legalEntityId: dto.legalEntityId ?? null, packageVersionId: dto.packageVersionId, at: now.toISOString() })).digest('hex') } });
                    await tx.qualificationStatusHistory.create({ data: { qualificationId, status: 'DRAFT', effectiveFrom: now, sourceType: 'PACKAGE_CHECKOUT' } });
                    if (sponsorEvidence)
                        await tx.qualificationSponsorSelectionEvidence.create({ data: { qualificationId, attributionReferrerQualificationId: sponsorEvidence.sponsorQualificationId, selectedSponsorQualificationId: sponsorEvidence.sponsorQualificationId, selectedSponsorOwnerPersonId: sponsorEvidence.sponsorOwnerPersonId, selectedByPersonId: personId, selectedAt: now, source: 'MANUAL_INPUT', policyVersion: sponsorEvidence.kind === 'COMPANY_ALIAS' ? sponsorEvidence.policyVersion : sponsorEvidence.ruleVersion, correlationId } });
                }
                if (!qualificationId)
                    throw new common_1.UnprocessableEntityException({ code: 'TARGET_QUALIFICATION_REQUIRED' });
                const packageParameters = await (0, package_parameters_1.resolvePackageParameters)(tx, now, v, prepared.selections.length ? prepared.selections.map(s => s.profile.ruleVersionCode) : ['R1.0B']);
                const order = await tx.order.create({ data: { qualificationId, purpose: v.profile.packageClass === 'QUALIFICATION' ? 'ENTRY' : 'REPURCHASE', status: 'CONFIRMED', currency: v.currency, grossAmount: v.priceAmount.add(pricing.qualificationFee), discountAmount: new database_1.Prisma.Decimal(pricing.discountAmount), netAmount: new database_1.Prisma.Decimal(pricing.total), ...packageParameters, confirmedAt: now, lines: { create: prepared.selections.map(s => ({ productId: s.product.productId, skuSnapshot: s.product.sku, productNameSnapshot: s.product.displayName, quantity: new database_1.Prisma.Decimal(s.quantity), unitPrice: new database_1.Prisma.Decimal(0), lineAmount: new database_1.Prisma.Decimal(0), gpvRateSnapshot: new database_1.Prisma.Decimal(0), gpvAmountSnapshot: new database_1.Prisma.Decimal(0), pvRateSnapshot: new database_1.Prisma.Decimal(0), ruleProfileSnapshot: { profileId: s.profile.productRuleProfileId, packageSelection: true, recognitionConfigRef: v.recognitionConfigRef, packageConfigHash: v.configHash }, commercialOfferingVersionId: offering?.commercialOfferingVersionId, commercialOfferingSnapshot: offering, linePurpose: dto.linePurpose })) } }, include: { lines: true } });
                if (paper)
                    await tx.paperApplication.update({ where: { paperApplicationId: paper.paperApplicationId }, data: { orderId: order.orderId, status: 'ORDER_CREATED' } });
                const snapshot = await tx.packagePurchaseSnapshot.create({ data: { orderId: order.orderId, personId: dto.legalEntityId ? null : personId, legalEntityId: dto.legalEntityId ?? null, targetQualificationId: dto.targetQualificationId, packageProfileVersionId: v.packageProfileVersionId, packageCode: v.profile.stableCode, packageName: v.displayName, packageClass: v.profile.packageClass, currency: v.currency, priceAmount: new database_1.Prisma.Decimal(pricing.goodsAmount), qualificationFee: new database_1.Prisma.Decimal(pricing.qualificationFee), discountAmount: new database_1.Prisma.Decimal(pricing.discountAmount), couponCode: pricing.couponCode, paymentDeadline, selectableProductQuantity: pricing.selectableProductQuantity, membershipEffect: v.membershipEffect, qualificationEffect: v.qualificationEffect, activeDurationUnit: v.activeDurationUnit, activeDurationValue: v.activeDurationValue, recognitionConfigRef: pricing.recognitionPolicy, packageConfigHash: v.configHash, purchasedAt: now, selections: { create: prepared.selections.map(s => ({ productRuleProfileId: s.productRuleProfileId, productId: s.product.productId, skuSnapshot: s.product.sku, productDisplaySnapshot: s.product.displayName, quantity: s.quantity, productConfigHash: s.productConfigHash })) } } });
                if (pricing.couponId) {
                    await tx.couponRedemption.create({ data: { couponId: pricing.couponId, orderId: order.orderId, personId, snapshot: pricing, expiresAt: paymentDeadline } });
                    await tx.couponUsageEvent.create({ data: { orderId: order.orderId, kind: 'RESERVED' } });
                }
                await this.audit.write(tx, { actorType: paper ? 'USER' : 'MEMBER', actorId: paper?.actorId ?? personId, action: paper ? 'PAPER_ORDER_CREATED' : 'PACKAGE_ORDER_CREATED', entityType: 'ORDER', entityId: order.orderId, afterData: { orderId: order.orderId, qualificationId, packagePurchaseSnapshotId: snapshot.packagePurchaseSnapshotId, packageCode: v.profile.stableCode, packageClass: v.profile.packageClass, netAmount: pricing.total, qualificationFee: pricing.qualificationFee, discountAmount: pricing.discountAmount, couponCode: pricing.couponCode, operatorPersonId: personId, legalEntityId: dto.legalEntityId ?? null, sponsorEvidence: sponsorEvidence ? (sponsorEvidence.kind === 'COMPANY_ALIAS' ? { kind: 'COMPANY_ALIAS', displayLabel: sponsorEvidence.displayLabel, policyVersion: sponsorEvidence.policyVersion, ruleVersion: sponsorEvidence.ruleVersion, effectiveAt: sponsorEvidence.effectiveAt } : { kind: 'BALL', sponsorBallNo: sponsorEvidence.sponsorBallNo, ruleVersion: sponsorEvidence.ruleVersion, effectiveAt: sponsorEvidence.effectiveAt }) : null }, requestId, correlationId });
                await this.outbox.enqueue(tx, { eventType: 'MEMBER_PACKAGE_ORDER_CREATED', aggregateType: 'ORDER', aggregateId: order.orderId, payload: { schemaVersion: 2, orderId: order.orderId, qualificationId, personId: dto.legalEntityId ? null : personId, legalEntityId: dto.legalEntityId ?? null, operatorPersonId: personId, packagePurchaseSnapshotId: snapshot.packagePurchaseSnapshotId, packageClass: v.profile.packageClass, recognitionStatus: 'PAYMENT_PENDING', source: paper ? 'ADMIN_PAPER_ORDER' : 'MEMBER' }, correlationId });
                return { ...order, packagePurchaseSnapshotId: snapshot.packagePurchaseSnapshotId, packageClass: v.profile.packageClass };
            });
        }
        catch (error) {
            if (['P2002', 'P2034'].includes(error.code))
                throw new common_1.ConflictException({ code: 'RETRYABLE_CONFLICT', message: 'Concurrent operation; retry the identical request with the same Idempotency-Key.' });
            throw error;
        }
    }
    async create(dto, key, requestId, actorId, member = false) {
        const correlationId = (0, crypto_1.randomUUID)();
        return this.idempotency.execute(`${member ? 'member' : 'admin'}:order:create:${actorId ?? 'system'}`, key, dto, async (tx) => {
            if (member) {
                await new qualification_access_service_1.QualificationAccessService(tx).assertHolder(actorId, dto.qualificationId);
                const person = await tx.person.findUnique({ where: { personId: actorId } });
                if (person?.status !== 'EFFECTIVE')
                    throw new common_1.ConflictException({ code: 'MEMBER_PERSON_DISABLED' });
            }
            const qualification = await tx.qualification.findUnique({
                where: { qualificationId: dto.qualificationId },
            });
            if (!qualification || qualification.status !== 'EFFECTIVE') {
                throw new common_1.ConflictException({
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Qualification不存在或尚未生效。',
                });
            }
            const productIds = [...new Set(dto.items.map(i => i.productId))];
            const products = await tx.productReference.findMany({
                where: { productId: { in: productIds }, isActive: true },
            });
            if (products.length !== productIds.length) {
                throw new common_1.ConflictException({
                    code: 'RESOURCE_NOT_FOUND',
                    message: '部分商品不存在或未啟用。',
                });
            }
            const now = new Date();
            const offering = await this.resolveOfferingSnapshot(tx, dto.commercialOfferingCode, member ? 'WEB_MEMBER' : 'ADMIN', now);
            this.assertOfferingPurpose(offering, dto.purpose ?? 'RETAIL');
            this.assertOfferingSelection(offering, dto.items.map(item => ({ product: products.find(product => product.productId === item.productId), quantity: Number(item.quantity) })));
            const lines = [];
            let gross = new database_1.Prisma.Decimal(0);
            let ruleVersionCode = 'R1.0B';
            let parameterSnapshotHash;
            for (const item of dto.items) {
                const product = products.find(p => p.productId === item.productId);
                const lineOffering = await this.resolveLineOffering(tx, item, product, offering, member ? 'WEB_MEMBER' : 'ADMIN', now, dto.purpose ?? 'RETAIL');
                const profileQuery = {
                    where: {
                        productId: item.productId,
                        effectiveFrom: { lte: now },
                        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
                    },
                    orderBy: { effectiveFrom: 'desc' },
                };
                const profiles = [];
                if (member)
                    profiles.push(...await tx.productRuleProfile.findMany(profileQuery));
                else {
                    const first = await tx.productRuleProfile.findFirst(profileQuery);
                    if (first)
                        profiles.push(first);
                }
                const profile = profiles[0];
                if (member && (profiles.length !== 1 || profile.ruleVersionCode !== 'R1.0B' || !profile.parameterSnapshotHash || !/^[a-f0-9]{64}$/.test(profile.parameterSnapshotHash)))
                    throw new common_1.UnprocessableEntityException({ code: 'RULE_PROFILE_CONFIGURATION_PENDING', message: 'One traceable effective R1.0B product profile required; no inferred PV/BV mapping.' });
                if (!profile) {
                    throw new common_1.UnprocessableEntityException({
                        code: 'DOMAIN_RULE_VIOLATION',
                        message: `商品 ${product.sku} 沒有目前有效的制度Rule Profile。`,
                    });
                }
                const quantity = new database_1.Prisma.Decimal(item.quantity);
                if (member && (!quantity.isInteger() || quantity.lte(0) || quantity.gt(99) || product.currentPrice.lt(0)))
                    throw new common_1.UnprocessableEntityException({ code: 'INVALID_PRODUCT_QUANTITY_OR_PRICE' });
                const lineAmount = product.currentPrice.mul(quantity);
                const gpvAmount = lineAmount.mul(profile.gpvRate);
                gross = gross.add(lineAmount);
                ruleVersionCode = profile.ruleVersionCode;
                parameterSnapshotHash = profile.parameterSnapshotHash ?? parameterSnapshotHash;
                lines.push({
                    productId: product.productId,
                    skuSnapshot: product.sku,
                    productNameSnapshot: product.displayName,
                    quantity,
                    unitPrice: product.currentPrice,
                    lineAmount,
                    gpvRateSnapshot: profile.gpvRate,
                    gpvAmountSnapshot: gpvAmount,
                    pvRateSnapshot: profile.pvRate ?? undefined,
                    ruleProfileSnapshot: {
                        profileId: profile.productRuleProfileId,
                        gpvRate: profile.gpvRate.toString(),
                        pvRate: profile.pvRate?.toString() ?? null,
                        rpvEligible: profile.rpvEligible,
                        epvEligible: profile.epvEligible,
                        ruleVersionCode: profile.ruleVersionCode,
                        parameterSnapshotHash: profile.parameterSnapshotHash,
                    },
                    commercialOfferingVersionId: lineOffering?.commercialOfferingVersionId,
                    commercialOfferingSnapshot: lineOffering,
                    linePurpose: dto.linePurpose,
                });
            }
            const sourceReferralTokenHash = dto.sourceReferralToken
                ? (0, crypto_1.createHash)('sha256').update(dto.sourceReferralToken).digest('hex')
                : undefined;
            const order = await tx.order.create({
                data: {
                    qualificationId: dto.qualificationId,
                    purpose: dto.purpose ?? 'RETAIL',
                    status: 'CONFIRMED',
                    grossAmount: gross,
                    discountAmount: new database_1.Prisma.Decimal(0),
                    netAmount: gross,
                    ruleVersionCode,
                    parameterSnapshotHash,
                    sourceReferralTokenHash,
                    clientReference: dto.clientReference,
                    confirmedAt: now,
                    lines: { create: lines },
                },
                include: { lines: true },
            });
            await this.audit.write(tx, {
                actorType: actorId ? 'USER' : 'SYSTEM',
                actorId,
                action: 'ORDER_CREATED_CONFIRMED',
                entityType: 'ORDER',
                entityId: order.orderId,
                afterData: {
                    orderId: order.orderId,
                    qualificationId: order.qualificationId,
                    netAmount: order.netAmount.toString(),
                    lineCount: order.lines.length,
                },
                requestId,
                correlationId,
            });
            if (member)
                await this.outbox.enqueue(tx, { eventType: 'MEMBER_ORDER_CREATED', aggregateType: 'ORDER', aggregateId: order.orderId, payload: { orderId: order.orderId, qualificationId: order.qualificationId, personId: actorId }, correlationId });
            return order;
        });
    }
    async confirmPayment(orderId, dto, key, requestId, actorId) {
        const correlationId = (0, crypto_1.randomUUID)();
        return this.idempotency.execute(`admin:payment:${orderId}`, key, dto, async (tx) => {
            if (tx.$queryRaw)
                await tx.$queryRaw `SELECT order_id FROM commerce."order" WHERE order_id=${orderId}::uuid FOR UPDATE`;
            const order = await tx.order.findUnique({
                where: { orderId },
                include: { lines: true },
            });
            if (!order) {
                throw new common_1.ConflictException({ code: 'RESOURCE_NOT_FOUND', message: '訂單不存在。' });
            }
            if (order.status === 'PAID' || order.status === 'FULFILLED') {
                throw new common_1.ConflictException({ code: 'ORDER_LOCKED', message: '訂單已付款，不可重複確認。' });
            }
            if (order.status !== 'CONFIRMED') {
                throw new common_1.ConflictException({ code: 'ORDER_LOCKED', message: '只有CONFIRMED訂單可確認付款。' });
            }
            const amount = new database_1.Prisma.Decimal(dto.amount);
            if (!amount.equals(order.netAmount)) {
                throw new common_1.UnprocessableEntityException({
                    code: 'DOMAIN_RULE_VIOLATION',
                    message: '付款金額必須等於訂單應付金額。',
                    details: { expected: order.netAmount.toString(), received: amount.toString() },
                });
            }
            if (order.purpose === 'FORMAL_MEMBERSHIP_FEE') {
                if (!actorId || !order.purchaserPersonId || !amount.equals('600'))
                    throw new common_1.ConflictException({ code: 'FORMAL_FEE_INVALID' });
                await tx.$queryRaw `SELECT person_id FROM identity.person WHERE person_id=${order.purchaserPersonId}::uuid FOR UPDATE`;
                const paidFee = await tx.order.findFirst({ where: { purchaserPersonId: order.purchaserPersonId, purpose: 'FORMAL_MEMBERSHIP_FEE', status: 'PAID' } });
                const covered = await (0, formal_enrollment_payment_1.formalFeeCoveredByPackage)(tx, order.purchaserPersonId);
                if (paidFee || covered)
                    throw new common_1.ConflictException({ code: 'FORMAL_FEE_ALREADY_COVERED' });
            }
            const occurredAt = new Date(dto.occurredAt);
            const entrySnapshot = tx.packagePurchaseSnapshot ? await tx.packagePurchaseSnapshot.findUnique({ where: { orderId } }) : null;
            if (entrySnapshot?.paymentDeadline && (new Date() >= entrySnapshot.paymentDeadline || occurredAt >= entrySnapshot.paymentDeadline || occurredAt < order.createdAt || occurredAt.getTime() > Date.now() + 60000))
                throw new common_1.ConflictException({ code: "PACKAGE_PAYMENT_DEADLINE_EXCEEDED", message: "付款期限已過或付款時間不符，請勿確認此筆收款，應進行款項核對與退款處理。" });
            const payment = await tx.paymentEvent.create({
                data: {
                    orderId,
                    eventType: 'PAYMENT_CONFIRMED',
                    amount,
                    paymentMethod: dto.paymentMethod,
                    referenceNo: dto.referenceNo,
                    idempotencyKey: key,
                    occurredAt,
                    createdBy: actorId,
                    correlationId,
                },
            });
            await tx.order.update({
                where: { orderId },
                data: { status: 'PAID', paidAt: occurredAt },
            });
            if (order.purpose === 'FORMAL_MEMBERSHIP_FEE') {
                await this.audit.write(tx, { actorType: 'USER', actorId, action: 'FORMAL_ENROLLMENT_FEE_PAYMENT_CONFIRMED', entityType: 'ORDER', entityId: orderId, afterData: { paymentEventId: payment.paymentEventId, amount: '600.00', referenceNo: dto.referenceNo, paymentMethod: dto.paymentMethod, note: dto.note ?? null, approvalGranted: false }, requestId, correlationId });
                return { orderId, status: 'PAID', paymentEventId: payment.paymentEventId, correlationId };
            }
            // Legacy unit harnesses predate the additive package delegate; production Prisma always provides it.
            const packageSnapshot = tx.packagePurchaseSnapshot ? await tx.packagePurchaseSnapshot.findUnique({ where: { orderId } }) : null;
            if (packageSnapshot) {
                const packageQualificationId = order.qualificationId;
                if (!packageQualificationId)
                    throw new common_1.UnprocessableEntityException({ code: 'PACKAGE_ORDER_QUALIFICATION_MISSING' });
                let downstreamStatus = 'RECOGNITION_CONFIGURATION_PENDING';
                if (packageSnapshot.packageClass === 'QUALIFICATION') {
                    const selected = tx.qualificationSponsorSelectionEvidence ? await tx.qualificationSponsorSelectionEvidence.findFirst({ where: { qualificationId: packageQualificationId }, orderBy: { selectedAt: 'desc' } }) : null;
                    let sponsorQualificationId;
                    if (selected) {
                        const selectedBall = await tx.qualification.findUnique({ where: { qualificationId: selected.selectedSponsorQualificationId }, select: { ballNo: true } });
                        if (!selectedBall?.ballNo)
                            throw new common_1.UnprocessableEntityException({ code: 'SPONSOR_EVIDENCE_INVALID' });
                        const resolved = await (this.sponsors ?? new sponsor_resolver_service_1.SponsorResolver(this.prisma)).resolveWithin(tx, { code: selectedBall.ballNo, effectiveAt: occurredAt, ruleVersion: 'R1.0B' });
                        const resolvedSponsorId = resolved.sponsorQualificationId;
                        if (!resolvedSponsorId || resolvedSponsorId !== selected.selectedSponsorQualificationId)
                            throw new common_1.UnprocessableEntityException({ code: 'SPONSOR_EVIDENCE_INVALID' });
                        sponsorQualificationId = resolvedSponsorId;
                        const sponsorSequenceNo = await (this.organization ?? new organization_service_1.OrganizationService(this.prisma)).allocateSponsorSequence(tx, resolvedSponsorId);
                        await tx.sponsorRelationship.create({ data: { sponsorQualificationId: resolvedSponsorId, childQualificationId: packageQualificationId, sponsorSequenceNo, effectiveFrom: occurredAt } });
                    }
                    const placementDueAt = sponsorQualificationId ? new Date(occurredAt.getTime() + 72 * 60 * 60 * 1000) : undefined;
                    await tx.qualificationSetup.create({ data: { qualificationId: packageQualificationId, ownerPersonId: packageSnapshot.personId, ownerLegalEntityId: packageSnapshot.legalEntityId, qualifyingOrderId: orderId, packagePurchaseSnapshotId: packageSnapshot.packagePurchaseSnapshotId, packageType: packageSnapshot.packageCode, setupStatus: sponsorQualificationId ? 'PLACEMENT_PENDING' : 'BALL_SETUP_PENDING', finalSponsorQualificationId: sponsorQualificationId, placementRequestedAt: sponsorQualificationId ? occurredAt : undefined, placementDueAt, setupPolicyVersion: 'NR-DEC-004-V1' } });
                    downstreamStatus = sponsorQualificationId ? 'PLACEMENT_PENDING' : 'BALL_SETUP_PENDING';
                }
                await this.outbox.enqueue(tx, { eventType: 'PACKAGE_PAYMENT_CONFIRMED', aggregateType: 'ORDER', aggregateId: orderId, correlationId, payload: { schemaVersion: 1, eventType: 'PACKAGE_PAYMENT_CONFIRMED', orderId, qualificationId: order.qualificationId, packagePurchaseSnapshotId: packageSnapshot.packagePurchaseSnapshotId, packageClass: packageSnapshot.packageClass, occurredAt: occurredAt.toISOString(), recognitionStatus: 'CONFIGURATION_PENDING', downstreamStatus } });
                await this.audit.write(tx, { actorType: actorId ? 'USER' : 'SYSTEM', actorId, action: 'PACKAGE_PAYMENT_CONFIRMED', entityType: 'ORDER', entityId: orderId, afterData: { paymentEventId: payment.paymentEventId, packagePurchaseSnapshotId: packageSnapshot.packagePurchaseSnapshotId, downstreamStatus }, requestId, correlationId });
                return { orderId, status: 'PAID', paymentEventId: payment.paymentEventId, correlationId, packagePurchaseSnapshotId: packageSnapshot.packagePurchaseSnapshotId, downstreamStatus };
            }
            if (order.lines.some(line => line.commercialOfferingSnapshot?.recognitionProfile?.recognitionStatus === 'CONFIGURATION_PENDING')) {
                await this.audit.write(tx, { actorType: actorId ? 'USER' : 'SYSTEM', actorId, action: 'MANUAL_ORDER_RECOGNITION_PENDING', entityType: 'ORDER', entityId: orderId, afterData: { paymentEventId: payment.paymentEventId, amount: amount.toString(), recognitionStatus: 'CONFIGURATION_PENDING', referenceNo: dto.referenceNo }, requestId, correlationId });
                return { orderId, status: 'PAID', paymentEventId: payment.paymentEventId, correlationId, recognitionStatus: 'CONFIGURATION_PENDING' };
            }
            if (!order.qualificationId) {
                await this.outbox.enqueue(tx, { eventType: 'WEB_MEMBER_RETAIL_PAYMENT_CONFIRMED', aggregateType: 'ORDER', aggregateId: orderId, correlationId, payload: { schemaVersion: 1, orderId, personId: order.purchaserPersonId, amount: order.netAmount.toString(), occurredAt: occurredAt.toISOString(), ruleVersionCode: order.ruleVersionCode, parameterSnapshotHash: order.parameterSnapshotHash, recognitionStatus: 'RETAIL_REFERRAL_RECOGNITION_PENDING' } });
                await this.audit.write(tx, { actorType: actorId ? 'USER' : 'SYSTEM', actorId, action: 'WEB_MEMBER_RETAIL_PAYMENT_CONFIRMED', entityType: 'ORDER', entityId: orderId, afterData: { paymentEventId: payment.paymentEventId, amount: amount.toString(), referenceNo: dto.referenceNo }, requestId, correlationId });
                return { orderId, status: 'PAID', paymentEventId: payment.paymentEventId, correlationId };
            }
            await this.outbox.enqueue(tx, {
                eventType: 'SALE_CONFIRMED',
                aggregateType: 'ORDER',
                aggregateId: orderId,
                correlationId,
                payload: {
                    eventType: 'SALE_CONFIRMED',
                    source: 'MANUAL',
                    orderId,
                    qualificationId: order.qualificationId,
                    amount: order.netAmount.toString(),
                    occurredAt: occurredAt.toISOString(),
                    ruleVersionCode: order.ruleVersionCode,
                    parameterSnapshotHash: order.parameterSnapshotHash,
                },
            });
            await this.audit.write(tx, {
                actorType: actorId ? 'USER' : 'SYSTEM',
                actorId,
                action: 'PAYMENT_CONFIRMED',
                entityType: 'ORDER',
                entityId: orderId,
                afterData: {
                    paymentEventId: payment.paymentEventId,
                    amount: amount.toString(),
                    referenceNo: dto.referenceNo,
                },
                requestId,
                correlationId,
            });
            return {
                orderId,
                status: 'PAID',
                paymentEventId: payment.paymentEventId,
                correlationId,
            };
        });
    }
    async search(input = {}) {
        const take = Math.min(Math.max(input.take ?? 50, 1), 100);
        const q = input.q?.trim();
        const orders = await this.prisma.order.findMany({
            where: {
                ...(input.status ? { status: input.status } : {}),
                ...(input.qualificationId ? { qualificationId: input.qualificationId } : {}),
                ...(q ? {
                    OR: [
                        { clientReference: { contains: q, mode: 'insensitive' } },
                        ...(/^[a-f0-9-]{36}$/i.test(q) ? [{ orderId: q }] : []),
                        { purchaser: { memberNo: { contains: q } } }, { purchaser: { legalName: { contains: q, mode: 'insensitive' } } }, { purchaser: { mobile: { contains: q } } },
                        { qualification: { currentHolder: { legalName: { contains: q, mode: 'insensitive' } } } },
                        { qualification: { currentHolder: { mobile: { contains: q } } } },
                    ]
                } : {})
            },
            include: {
                qualification: { include: { currentHolder: true } },
                purchaser: { select: { memberNo: true, legalName: true, mobile: true } },
                lines: true,
                paymentEvents: true,
            },
            orderBy: { createdAt: 'desc' },
            take,
        });
        if (!orders.length)
            return orders;
        const orderIds = orders.map(row => row.orderId), [snapshots, setups] = await Promise.all([
            this.prisma.packagePurchaseSnapshot.findMany({ where: { orderId: { in: orderIds } }, include: { selections: true } }),
            this.prisma.qualificationSetup.findMany({ where: { qualifyingOrderId: { in: orderIds } } }),
        ]);
        return orders.map(order => { const snapshot = snapshots.find(row => row.orderId === order.orderId), setup = setups.find(row => row.qualifyingOrderId === order.orderId); return { ...order, recognitionStatus: order.lines.some(line => line.commercialOfferingSnapshot?.recognitionProfile?.recognitionStatus === 'CONFIGURATION_PENDING') ? 'CONFIGURATION_PENDING' : null, ...this.packageReadback(snapshot, setup) }; });
    }
    async updatePaymentReference(orderId, referenceNo, actorId, requestId) {
        if (!actorId || !referenceNo.trim() || referenceNo.length > 120)
            throw new common_1.UnprocessableEntityException({ code: 'PAYMENT_REFERENCE_INVALID' });
        return this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUniqueOrThrow({ where: { orderId } });
            if (!['PAID', 'FULFILLED'].includes(order.status))
                throw new common_1.ConflictException({ code: 'ORDER_NOT_PAID' });
            const event = await tx.paymentEvent.findFirst({ where: { orderId, eventType: 'PAYMENT_CONFIRMED' }, orderBy: { occurredAt: 'desc' } });
            if (!event)
                throw new common_1.ConflictException({ code: 'PAYMENT_EVENT_NOT_FOUND' });
            // Payment events are append-only. Store an audited reference annotation instead.
            const prior = await tx.auditEvent.findFirst({ where: { entityId: orderId, action: 'PAYMENT_REFERENCE_UPDATED' }, orderBy: { occurredAt: 'desc' } });
            await this.audit.write(tx, { actorType: 'USER', actorId, action: 'PAYMENT_REFERENCE_UPDATED', entityType: 'ORDER', entityId: orderId, beforeData: { referenceNo: prior?.afterData?.referenceNo ?? event.referenceNo }, afterData: { referenceNo: referenceNo.trim(), paymentEventId: event.paymentEventId }, requestId, correlationId: (0, crypto_1.randomUUID)() });
            return { orderId, referenceNo: referenceNo.trim() };
        });
    }
    async get(orderId) {
        return this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUniqueOrThrow({
                where: { orderId },
                include: { purchaser: { select: { memberNo: true, legalName: true, mobile: true } }, lines: true, paymentEvents: true },
            });
            const reference = await tx.auditEvent.findFirst({ where: { entityId: orderId, action: 'PAYMENT_REFERENCE_UPDATED' }, orderBy: { occurredAt: 'desc' } });
            const returned = await tx.returnLine.groupBy({ by: ['orderLineId'], where: { returnCase: { orderId, status: 'POSTED' } }, _sum: { quantity: true } });
            const [snapshot, setup] = await Promise.all([tx.packagePurchaseSnapshot.findUnique({ where: { orderId }, include: { selections: true } }), tx.qualificationSetup.findFirst({ where: { qualifyingOrderId: orderId } })]);
            return { ...order, recognitionStatus: order.lines.some(line => line.commercialOfferingSnapshot?.recognitionProfile?.recognitionStatus === 'CONFIGURATION_PENDING') ? 'CONFIGURATION_PENDING' : null, paymentReferenceNo: reference?.afterData?.referenceNo ?? order.paymentEvents.find(x => x.eventType === 'PAYMENT_CONFIRMED')?.referenceNo ?? null, ...this.packageReadback(snapshot, setup), lines: order.lines.map(line => {
                    const quantity = returned.find(row => row.orderLineId === line.orderLineId)?._sum.quantity ?? new database_1.Prisma.Decimal(0);
                    return { ...line, returnedQuantity: quantity.toString(), remainingReversibleQuantity: database_1.Prisma.Decimal.max(0, line.quantity.minus(quantity)).toString() };
                }) };
        }, { isolationLevel: 'RepeatableRead' });
    }
    packageReadback(snapshot, setup) { if (!snapshot)
        return { packagePurchase: null, packageDownstreamStatus: null }; return { packagePurchase: { packagePurchaseSnapshotId: snapshot.packagePurchaseSnapshotId, packageProfileVersionId: snapshot.packageProfileVersionId, packageCode: snapshot.packageCode, packageName: snapshot.packageName, packageClass: snapshot.packageClass, currency: snapshot.currency, priceAmount: snapshot.priceAmount.toString(), qualificationFee: snapshot.qualificationFee?.toString() ?? "0", discountAmount: snapshot.discountAmount?.toString() ?? "0", couponCode: snapshot.couponCode ?? null, paymentDeadline: snapshot.paymentDeadline?.toISOString() ?? null, selectableProductQuantity: snapshot.selectableProductQuantity, membershipEffect: snapshot.membershipEffect, qualificationEffect: snapshot.qualificationEffect, activeDurationUnit: snapshot.activeDurationUnit, activeDurationValue: snapshot.activeDurationValue, recognitionConfigRef: snapshot.recognitionConfigRef, packageConfigHash: snapshot.packageConfigHash, purchasedAt: snapshot.purchasedAt.toISOString(), selections: (snapshot.selections ?? []).map((row) => ({ productRuleProfileId: row.productRuleProfileId, productId: row.productId, sku: row.skuSnapshot, displayName: row.productDisplaySnapshot, quantity: row.quantity, productConfigHash: row.productConfigHash })) }, packageDownstreamStatus: setup?.setupStatus ?? (snapshot.packageClass === 'ACTIVE_DURATION' ? 'RECOGNITION_CONFIGURATION_PENDING' : 'PAYMENT_PENDING') }; }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_1.PrismaService,
        idempotency_service_1.IdempotencyService,
        audit_service_1.AuditService,
        outbox_service_1.OutboxService,
        package_config_service_1.PackageConfigService,
        sponsor_resolver_service_1.SponsorResolver,
        organization_service_1.OrganizationService,
        retail_referrer_attribution_service_1.RetailReferrerAttributionService,
        commercial_offering_service_1.CommercialOfferingService])
], OrderService);
