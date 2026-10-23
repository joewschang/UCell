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
exports.FormalEnrollmentService = void 0;
const formal_application_sponsor_1 = require("./formal-application-sponsor");
const pii_crypto_service_1 = require("../../common/security/pii-crypto.service");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@ucell/database");
const node_crypto_1 = require("node:crypto");
const audit_service_1 = require("../../common/audit/audit.service");
const idempotency_service_1 = require("../../common/idempotency/idempotency.service");
const order_service_1 = require("../order/order.service");
const qualification_access_service_1 = require("../auth/qualification-access.service");
const FEE = '600.00', RULE = 'FORMAL_ENROLLMENT_V1';
let FormalEnrollmentService = class FormalEnrollmentService {
    db;
    config;
    idempotency;
    audit;
    orders;
    constructor(db, config, idempotency, audit, orders) {
        this.db = db;
        this.config = config;
        this.idempotency = idempotency;
        this.audit = audit;
        this.orders = orders;
    }
    stagePaymentEnabled() {
        if (this.config.get('UCELL_ENVIRONMENT') !== 'STAGE' || this.config.get('STAGE_PAYMENT_MODE') !== 'ASSUME_PAID')
            return false;
        try {
            const url = new URL(this.config.get('DATABASE_URL') ?? '');
            return url.hostname === 'ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com' && url.pathname === '/ucell_stage'
                || this.config.get('NODE_ENV') === 'test' && ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/ucell_jest_[a-f0-9]{32}$/.test(url.pathname);
        }
        catch {
            return false;
        }
    }
    assertStage() { if (!this.stagePaymentEnabled())
        throw new common_1.ForbiddenException({ code: 'STAGE_PAYMENT_NOT_AVAILABLE' }); }
    receipt(order) { return { orderId: order.orderId, amount: order.netAmount.toFixed(2), currency: 'TWD', status: order.status, paidAt: order.paidAt?.toISOString() ?? null, simulation: this.stagePaymentEnabled() }; }
    paidPackages(db, personId) {
        return db.$queryRaw `SELECT p.order_id AS "orderId",p.package_name AS "packageName" FROM commerce.package_purchase_snapshot p JOIN commerce."order" o ON o.order_id=p.order_id WHERE p.person_id=${personId}::uuid AND p.package_class='QUALIFICATION' AND p.membership_effect='FORMAL_ELIGIBILITY' AND o.status IN ('PAID','FULFILLED') ORDER BY p.purchased_at DESC LIMIT 20`;
    }
    async status(personId) {
        const person = await this.db.person.findUnique({ where: { personId }, select: { membershipState: true, status: true, securityStatus: true, legalName: true, birthDate: true, nationalityCode: true, mobile: true, email: true } });
        if (!person || person.status !== 'EFFECTIVE' || person.securityStatus !== 'NORMAL')
            throw new common_1.ForbiddenException({ code: 'MEMBER_PERSON_DISABLED' });
        const [fee, application, packages] = await Promise.all([
            this.db.order.findFirst({ where: { purchaserPersonId: personId, purpose: 'FORMAL_MEMBERSHIP_FEE', status: { in: ['CONFIRMED', 'PAID'] } }, orderBy: { createdAt: 'desc' } }),
            this.db.formalMemberApplication.findFirst({ where: { personId, applicantType: 'INDIVIDUAL' }, select: { formalMemberApplicationId: true, status: true, decisionReasonCode: true, createdAt: true, updatedAt: true, submittedAt: true, reviewedAt: true }, orderBy: { updatedAt: 'desc' } }),
            this.paidPackages(this.db, personId),
        ]);
        const packageOrders = await this.db.$queryRaw `SELECT p.order_id AS "orderId",p.package_name AS "packageName",o.net_amount::text AS amount,o.status::text AS status FROM commerce.package_purchase_snapshot p JOIN commerce."order" o ON o.order_id=p.order_id WHERE p.person_id=${personId}::uuid AND p.package_class='QUALIFICATION' ORDER BY p.purchased_at DESC LIMIT 20`;
        const pendingPackages = await this.db.packagePurchaseSnapshot.findMany({ where: { personId, packageClass: 'QUALIFICATION', paymentDeadline: { gt: new Date() } }, orderBy: { purchasedAt: 'desc' }, take: 20 });
        const pendingOrders = await this.db.order.findMany({ where: { orderId: { in: pendingPackages.map(p => p.orderId) }, status: 'CONFIRMED' }, select: { orderId: true, netAmount: true } });
        return { pendingPackages: pendingPackages.filter(p => pendingOrders.some(o => o.orderId === p.orderId)).map(p => ({ orderId: p.orderId, packageName: p.packageName, total: pendingOrders.find(o => o.orderId === p.orderId).netAmount.toString(), paymentDeadline: p.paymentDeadline.toISOString(), couponCode: p.couponCode, qualificationFee: p.qualificationFee.toString(), goodsAmount: p.priceAmount.toString(), selectableProductQuantity: p.selectableProductQuantity })), packageOrders, prefill: { legalName: person.legalName ?? '', gender: 'UNDISCLOSED', birthDate: person.birthDate?.toISOString().slice(0, 10) ?? '', nationalityCode: person.nationalityCode ?? 'TW', phone: person.mobile ?? '', email: person.email ?? '' }, membershipState: person.membershipState, feeAmount: FEE, currency: 'TWD', stagePaymentEnabled: this.stagePaymentEnabled(), feeReceipt: fee?.status === 'PAID' ? this.receipt(fee) : null, feeOrder: fee ? this.receipt(fee) : null, application: application ? { id: application.formalMemberApplicationId, status: application.status, reviewNote: application.decisionReasonCode, createdAt: application.createdAt.toISOString(), updatedAt: application.updatedAt.toISOString(), submittedAt: application.submittedAt?.toISOString() ?? null, reviewedAt: application.reviewedAt?.toISOString() ?? null } : null, paidPackages: packages };
    }
    async pending(tx, personId, sourceId) {
        const person = await tx.person.findUniqueOrThrow({ where: { personId } });
        if (person.status !== 'EFFECTIVE' || person.securityStatus !== 'NORMAL' || !['NETWORK_MEMBER', 'FORMAL_PENDING', 'FORMAL_MEMBER'].includes(person.membershipState ?? ''))
            throw new common_1.ConflictException({ code: 'NETWORK_MEMBERSHIP_REQUIRED' });
        if (person.membershipState === 'NETWORK_MEMBER') {
            await tx.person.update({ where: { personId }, data: { membershipState: 'FORMAL_PENDING' } });
            await tx.personMembershipStateEvent.create({ data: { personId, fromState: 'NETWORK_MEMBER', toState: 'FORMAL_PENDING', reasonCode: 'FORMAL_ENROLLMENT_PENDING', sourceType: 'ORDER', sourceId, correlationId: (0, node_crypto_1.randomUUID)() } });
        }
    }
    async payFee(personId, key, requestId) {
        throw new common_1.ConflictException({ code: 'QUALIFICATION_PACKAGE_REQUIRED', message: '請選擇會員資格套組；不再提供單獨繳費加入正式會員。' });
    }
    async payCommerce(personId, orderId, key, requestId) {
        this.assertStage();
        const person = await this.db.person.findUnique({ where: { personId } });
        if (!person || person.status !== 'EFFECTIVE' || person.securityStatus !== 'NORMAL')
            throw new common_1.ForbiddenException({ code: 'MEMBER_PERSON_DISABLED' });
        const order = await this.db.order.findUnique({ where: { orderId } });
        if (!order || !['RETAIL', 'REPURCHASE'].includes(order.purpose))
            throw new common_1.NotFoundException({ code: 'STAGE_COMMERCE_ORDER_NOT_FOUND' });
        if (order.qualificationId)
            await new qualification_access_service_1.QualificationAccessService(this.db).assertHolder(personId, order.qualificationId);
        else if (order.purchaserPersonId !== personId)
            throw new common_1.NotFoundException({ code: 'STAGE_COMMERCE_ORDER_NOT_FOUND' });
        if (order.status !== 'PAID')
            await this.orders.confirmPayment(orderId, { amount: order.netAmount.toFixed(2), paymentMethod: 'STAGE_SIMULATED', referenceNo: 'STAGE-TEST:' + orderId, occurredAt: new Date().toISOString(), note: 'Stage-only assumed commerce payment; no real charge' }, key, requestId);
        return this.receipt(await this.db.order.findUniqueOrThrow({ where: { orderId } }));
    }
    async payPackage(personId, orderId, key, requestId) {
        this.assertStage();
        const person = await this.db.person.findUnique({ where: { personId } });
        if (!person || person.status !== 'EFFECTIVE' || person.securityStatus !== 'NORMAL' || !['NETWORK_MEMBER', 'FORMAL_PENDING', 'FORMAL_MEMBER'].includes(person.membershipState ?? ''))
            throw new common_1.ConflictException({ code: 'FORMAL_ENROLLMENT_NOT_AVAILABLE' });
        const purchase = await this.db.packagePurchaseSnapshot.findUnique({ where: { orderId } });
        if (!purchase || purchase.personId !== personId || purchase.packageClass !== 'QUALIFICATION' || purchase.membershipEffect !== 'FORMAL_ELIGIBILITY')
            throw new common_1.NotFoundException({ code: 'ENROLLMENT_PACKAGE_ORDER_NOT_FOUND' });
        // Use the canonical payment writer; never fabricate a provider receipt or bypass
        // the existing qualification setup/sponsor validation. The server fixes amount.
        const order = await this.db.order.findUniqueOrThrow({ where: { orderId } });
        if (order.status !== 'PAID')
            await this.orders.confirmPayment(orderId, { amount: order.netAmount.toFixed(2), paymentMethod: 'STAGE_SIMULATED', referenceNo: 'STAGE-TEST:' + orderId, occurredAt: new Date().toISOString(), note: 'Stage-only assumed payment; not a real provider transaction' }, key, requestId);
        await this.db.$transaction(async (tx) => { await tx.$queryRaw `SELECT person_id FROM identity.person WHERE person_id=${personId}::uuid FOR UPDATE`; await this.pending(tx, personId, orderId); });
        const paid = await this.db.order.findUniqueOrThrow({ where: { orderId } });
        return { ...this.receipt(paid), route: 'PACKAGE', qualificationId: paid.qualificationId };
    }
    async submit(personId, applicationId, key, requestId) {
        return this.idempotency.execute('member:formal-enrollment:submit:' + personId, key, { applicationId }, async (tx) => {
            await tx.$queryRaw `SELECT formal_member_application_id FROM identity.formal_member_application WHERE formal_member_application_id=${applicationId}::uuid FOR UPDATE`;
            const app = await tx.formalMemberApplication.findUnique({ where: { formalMemberApplicationId: applicationId } });
            if (!app || app.personId !== personId || app.sourceChannel !== 'MEMBER_WEB')
                throw new common_1.NotFoundException({ code: 'FORMAL_APPLICATION_NOT_FOUND' });
            if (['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(app.status))
                return { applicationId, status: app.status };
            if (!['DRAFT', 'NEEDS_MORE_INFO'].includes(app.status))
                throw new common_1.ConflictException({ code: 'FORMAL_APPLICATION_NOT_SUBMITTABLE' });
            const fee = await tx.order.findFirst({ where: { purchaserPersonId: personId, purpose: 'FORMAL_MEMBERSHIP_FEE', status: 'PAID' } });
            const purchase = (await this.paidPackages(tx, personId))[0];
            if (!purchase)
                throw new common_1.ConflictException({ code: 'FORMAL_ENROLLMENT_PAYMENT_REQUIRED' });
            const docs = await tx.formalApplicationDocument.findMany({ where: { formalMemberApplicationId: applicationId, status: 'PRESENT', documentType: { in: ['IDENTITY_FRONT', 'IDENTITY_BACK', 'BANKBOOK_COVER'] } } });
            if (['IDENTITY_FRONT', 'IDENTITY_BACK', 'BANKBOOK_COVER'].some(type => !docs.some(d => d.documentType === type)))
                throw new common_1.ConflictException({ code: 'FORMAL_ENROLLMENT_DOCUMENTS_REQUIRED' });
            await this.pending(tx, personId, purchase.orderId);
            await tx.formalMemberApplication.update({ where: { formalMemberApplicationId: applicationId }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
            await this.audit.write(tx, { actorType: 'MEMBER', actorId: personId, action: 'FORMAL_ENROLLMENT_SUBMITTED', entityType: 'FormalMemberApplication', entityId: applicationId, afterData: { status: 'SUBMITTED', paymentOrderId: purchase.orderId, scanApprovalGranted: false }, requestId, correlationId: (0, node_crypto_1.randomUUID)() });
            return { applicationId, status: 'SUBMITTED' };
        });
    }
};
exports.FormalEnrollmentService = FormalEnrollmentService;
exports.FormalEnrollmentService = FormalEnrollmentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_1.PrismaService, config_1.ConfigService, idempotency_service_1.IdempotencyService, audit_service_1.AuditService, order_service_1.OrderService])
], FormalEnrollmentService);
