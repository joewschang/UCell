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
exports.FormalEnrollmentController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const member_authentication_guard_1 = require("../auth/member-authentication.guard");
const idempotency_guard_1 = require("../../common/guards/idempotency.guard");
const formal_enrollment_service_1 = require("./formal-enrollment.service");
const class_validator_1 = require("class-validator");
class SubmitEnrollmentDto {
    orderId;
    paymentMethod;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SubmitEnrollmentDto.prototype, "orderId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['BANK_TRANSFER', 'CASH']),
    __metadata("design:type", String)
], SubmitEnrollmentDto.prototype, "paymentMethod", void 0);
let FormalEnrollmentController = class FormalEnrollmentController {
    enrollment;
    constructor(enrollment) {
        this.enrollment = enrollment;
    }
    commerce(req, id, key) { return this.enrollment.payCommerce(req.user.personId, id, key, req.requestId); }
    status(req) { return this.enrollment.status(req.user.personId); }
    fee(req, key) { return this.enrollment.payFee(req.user.personId, key, req.requestId); }
    package(req, id, key) { return this.enrollment.payPackage(req.user.personId, id, key, req.requestId); }
    submit(body, req, id, key) { return this.enrollment.submit(req.user.personId, id, key, req.requestId, body); }
};
exports.FormalEnrollmentController = FormalEnrollmentController;
__decorate([
    (0, common_1.Post)('order-payments/:id'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberStageCommercePayment', summary: 'Stage 模擬支付本人的零售或重購訂單' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], FormalEnrollmentController.prototype, "commerce", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, swagger_1.ApiOperation)({ operationId: 'memberFormalEnrollment', summary: '正式會員升級狀態與申請費' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FormalEnrollmentController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('fee-payment'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberStageFormalEnrollmentFee', summary: '已停用：單獨繳費加入正式會員', description: 'Always rejects with QUALIFICATION_PACKAGE_REQUIRED.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FormalEnrollmentController.prototype, "fee", null);
__decorate([
    (0, common_1.Post)('package-payments/:id'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberStageFormalEnrollmentPackagePayment', summary: 'Stage 模擬支付本人資格套組', description: 'Owned formal-eligibility package only. Uses canonical order payment writer; separate qualification fee included in order total; no automatic formal approval.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], FormalEnrollmentController.prototype, "package", null);
__decorate([
    (0, common_1.Post)('applications/:id/submit'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberSubmitFormalEnrollment', summary: '送出附文件的正式會員申請', description: 'Paid or owned unexpired qualification order with explicit cash/bank transfer intent. Submission does not confirm payment or grant membership.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SubmitEnrollmentDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], FormalEnrollmentController.prototype, "submit", null);
exports.FormalEnrollmentController = FormalEnrollmentController = __decorate([
    (0, swagger_1.ApiTags)('Member - Formal enrollment'),
    (0, swagger_1.ApiBearerAuth)('memberBearer'),
    (0, common_1.UseGuards)(member_authentication_guard_1.MemberAuthenticationGuard),
    (0, common_1.Controller)('member/formal-enrollment'),
    __metadata("design:paramtypes", [formal_enrollment_service_1.FormalEnrollmentService])
], FormalEnrollmentController);
//# sourceMappingURL=formal-enrollment.controller.js.map