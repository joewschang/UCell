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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberContextGuard = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const database_1 = require("@ucell/database");
const audit_service_1 = require("../../common/audit/audit.service");
const qualification_access_service_1 = require("../auth/qualification-access.service");
let MemberContextGuard = class MemberContextGuard {
    access;
    prisma;
    audit;
    constructor(access, prisma, audit) {
        this.access = access;
        this.prisma = prisma;
        this.audit = audit;
    }
    async denied(request, code) {
        if (!this.prisma || !this.audit)
            return;
        try {
            await this.prisma.$transaction(tx => this.audit.write(tx, { actorType: 'USER', action: 'ACCESS_DENIED', eventCode: 'ACCESS_DENIED', entityType: 'MemberQualificationAuthorization', afterData: { path: String(request.url ?? '').split('?')[0], code }, reasonCode: code, result: 'DENIED', severity: 'WARNING', requestId: request.requestId ?? (0, node_crypto_1.randomUUID)(), correlationId: request.correlationId ?? (0, node_crypto_1.randomUUID)() }));
        }
        catch { /* audit availability must not alter BOLA denial */ }
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest(), path = request.url.split('?')[0];
        if (['/api/v1/member/my-orders', '/api/v1/member/my-growth', '/api/v1/member/me', '/api/v1/member/qualifications', '/api/v1/member/products', '/api/v1/member/profile', '/api/v1/member/delivery-profile', '/api/v1/member/logout', '/api/v1/member/organization/tree', '/api/v1/member/retail-orders'].includes(path) || path.startsWith('/api/v1/member/contracts/') || (path === '/api/v1/member/orders' && request.method === 'POST' && request.body?.packageVersionId))
            return true;
        if (path === '/api/v1/member/represented-legal-entities' && request.method === 'GET')
            return true;
        // These routes operate on the authenticated Person; application services enforce ownership.
        if ((path === '/api/v1/member/formal-applications' && request.method === 'POST') ||
            (path === '/api/v1/member/formal-applications/current' && request.method === 'GET') ||
            (/^\/api\/v1\/member\/formal-applications\/[0-9a-f-]{36}\/documents$/i.test(path) && ['GET', 'POST'].includes(request.method)))
            return true;
        const id = ['POST', 'PATCH'].includes(request.method) ? request.body?.qualificationId : request.query?.qualificationId;
        if (typeof id !== 'string' || !id) {
            await this.denied(request, 'QUALIFICATION_CONTEXT_REQUIRED');
            throw new common_1.UnprocessableEntityException({ code: 'QUALIFICATION_CONTEXT_REQUIRED' });
        }
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            await this.denied(request, 'QUALIFICATION_NOT_OWNED');
            throw new common_1.ForbiddenException({ code: 'QUALIFICATION_NOT_OWNED' });
        }
        try {
            await this.access.assertHolder(request.user.personId, id);
        }
        catch (error) {
            if (error instanceof common_1.ForbiddenException) {
                await this.denied(request, 'QUALIFICATION_NOT_OWNED');
                throw new common_1.ForbiddenException({ code: 'QUALIFICATION_NOT_OWNED' });
            }
            throw error;
        }
        return true;
    }
};
exports.MemberContextGuard = MemberContextGuard;
exports.MemberContextGuard = MemberContextGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [qualification_access_service_1.QualificationAccessService, database_1.PrismaService, audit_service_1.AuditService])
], MemberContextGuard);
//# sourceMappingURL=member-context.guard.js.map