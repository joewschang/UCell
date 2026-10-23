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
exports.MemberMarketingController = exports.AdminMarketingController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const node_crypto_1 = require("node:crypto");
const roles_decorator_1 = require("../auth/roles.decorator");
const member_authentication_guard_1 = require("../auth/member-authentication.guard");
const idempotency_guard_1 = require("../../common/guards/idempotency.guard");
const marketing_service_1 = require("./marketing.service");
class Filter {
    search;
    segment;
    page;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 50),
    __metadata("design:type", String)
], Filter.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(marketing_service_1.marketingSegments),
    __metadata("design:type", String)
], Filter.prototype, "segment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100000),
    __metadata("design:type", Number)
], Filter.prototype, "page", void 0);
class Scope {
    qualificationId;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], Scope.prototype, "qualificationId", void 0);
class Encouragement extends Scope {
    memberNo;
    body;
}
__decorate([
    (0, class_validator_1.Matches)(/^\d{10}$/),
    __metadata("design:type", String)
], Encouragement.prototype, "memberNo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 600),
    __metadata("design:type", String)
], Encouragement.prototype, "body", void 0);
let AdminMarketingController = class AdminMarketingController {
    service;
    constructor(service) {
        this.service = service;
    }
    read(input) { return this.service.read(input); }
    encourage(input, key, req) { return this.service.encourage(input, req.user.personId ?? req.user.subject, key, req.requestId ?? (0, node_crypto_1.randomUUID)()); }
};
exports.AdminMarketingController = AdminMarketingController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Filter]),
    __metadata("design:returntype", void 0)
], AdminMarketingController.prototype, "read", null);
__decorate([
    (0, common_1.Post)('encouragements'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'ORDER_OPS'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Encouragement, String, Object]),
    __metadata("design:returntype", void 0)
], AdminMarketingController.prototype, "encourage", null);
exports.AdminMarketingController = AdminMarketingController = __decorate([
    (0, common_1.Controller)('admin/marketing'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'ORDER_OPS', 'COMPLIANCE_AUDIT'),
    __metadata("design:paramtypes", [marketing_service_1.MarketingService])
], AdminMarketingController);
let MemberMarketingController = class MemberMarketingController {
    service;
    constructor(service) {
        this.service = service;
    }
    read(req, input) { return this.service.personal(req.user.personId, input.qualificationId); }
};
exports.MemberMarketingController = MemberMarketingController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Scope]),
    __metadata("design:returntype", void 0)
], MemberMarketingController.prototype, "read", null);
exports.MemberMarketingController = MemberMarketingController = __decorate([
    (0, common_1.Controller)('member/sharing-progress'),
    (0, common_1.UseGuards)(member_authentication_guard_1.MemberAuthenticationGuard),
    __metadata("design:paramtypes", [marketing_service_1.MarketingService])
], MemberMarketingController);
//# sourceMappingURL=marketing.controller.js.map