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
exports.AdminQualificationPlacementController = exports.MemberQualificationPlacementController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const idempotency_guard_1 = require("../../common/guards/idempotency.guard");
const member_authentication_guard_1 = require("../auth/member-authentication.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const qualification_placement_service_1 = require("./qualification-placement.service");
class PlaceQualificationDto {
    binaryParentQualificationId;
    side;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PlaceQualificationDto.prototype, "binaryParentQualificationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['LEFT', 'RIGHT'] }),
    (0, class_validator_1.IsEnum)(['LEFT', 'RIGHT']),
    __metadata("design:type", String)
], PlaceQualificationDto.prototype, "side", void 0);
class AdminPlaceQualificationDto extends PlaceQualificationDto {
    reasonCode;
}
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminPlaceQualificationDto.prototype, "reasonCode", void 0);
class QualificationReturnReviewDto {
    planLevelCode;
    reasonCode;
}
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['STARTER', 'ELITE', 'LEADER'] }),
    (0, class_validator_1.IsEnum)(['STARTER', 'ELITE', 'LEADER']),
    __metadata("design:type", String)
], QualificationReturnReviewDto.prototype, "planLevelCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], QualificationReturnReviewDto.prototype, "reasonCode", void 0);
class MemberPlaceQualificationDto {
    binaryParentBallNo;
    side;
}
__decorate([
    (0, swagger_1.ApiProperty)({ pattern: '^[A-Z][A-Z0-9_-]{0,39}(?:X\\d{6}|\\d{6,19})$', description: 'Public parent Ball number. UUIDs are not accepted in the member flow.' }),
    (0, class_validator_1.Matches)(/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6}|\d{6,19})$/),
    __metadata("design:type", String)
], MemberPlaceQualificationDto.prototype, "binaryParentBallNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['LEFT', 'RIGHT'] }),
    (0, class_validator_1.IsEnum)(['LEFT', 'RIGHT']),
    __metadata("design:type", String)
], MemberPlaceQualificationDto.prototype, "side", void 0);
let MemberQualificationPlacementController = class MemberQualificationPlacementController {
    service;
    constructor(service) {
        this.service = service;
    }
    branch(req, reference, ballNo) { return this.service.branch(req.user.personId, reference, ballNo); }
    pending(req) { return this.service.pendingForSponsorOwner(req.user.personId); }
    place(req, placementReference, body, key) { return this.service.placeBySponsorOwnerReference(req.user.personId, { placementReference, ...body }, key, req.requestId); }
};
exports.MemberQualificationPlacementController = MemberQualificationPlacementController;
__decorate([
    (0, common_1.Get)('placements/pending/:placementReference/branch'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('placementReference')),
    __param(2, (0, common_1.Query)('ballNo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], MemberQualificationPlacementController.prototype, "branch", null);
__decorate([
    (0, common_1.Get)('placements/pending'),
    (0, swagger_1.ApiOperation)({ operationId: 'memberPendingQualificationPlacements', description: 'Balls awaiting placement for which the authenticated Person owns the confirmed Sponsor Ball.' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MemberQualificationPlacementController.prototype, "pending", null);
__decorate([
    (0, common_1.Post)('placements/pending/:placementReference/place'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberPlaceQualification', description: 'Serializable placement commit using a pending-placement reference and public parent Ball number; Sponsor owner authorization and Binary legality are revalidated server-side.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('placementReference')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, MemberPlaceQualificationDto, String]),
    __metadata("design:returntype", void 0)
], MemberQualificationPlacementController.prototype, "place", null);
exports.MemberQualificationPlacementController = MemberQualificationPlacementController = __decorate([
    (0, swagger_1.ApiTags)('Member - Qualification Placement'),
    (0, swagger_1.ApiBearerAuth)('memberBearer'),
    (0, common_1.UseGuards)(member_authentication_guard_1.MemberAuthenticationGuard),
    (0, common_1.Controller)('member'),
    __metadata("design:paramtypes", [qualification_placement_service_1.QualificationPlacementService])
], MemberQualificationPlacementController);
let AdminQualificationPlacementController = class AdminQualificationPlacementController {
    service;
    constructor(service) {
        this.service = service;
    }
    dashboard(status, after) { return this.service.dashboard({ status: status || undefined, after: after || undefined }); }
    returnReviews() { return this.service.returnReviews(); }
    approveReturnReview(req, id, body, key) { return this.service.approveReturnReview(req.user?.personId, id, body, key, req.requestId); }
    monitor(status, aging, take) { return this.service.monitor({ status: status || undefined, aging: aging || undefined, take: Number(take ?? 50) }); }
    sweep(req, key) { return this.service.sweepOverdue(req.user?.personId, key, req.requestId); }
    place(req, id, body, key) { return this.service.placeByAdmin(req.user?.personId, { qualificationId: id, ...body }, key, req.requestId); }
};
exports.AdminQualificationPlacementController = AdminQualificationPlacementController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'COMPLIANCE_AUDIT', 'QUALIFICATION_PLACEMENT_OVERRIDE'),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('after')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminQualificationPlacementController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('return-reviews'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminQualificationReturnReviews' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminQualificationPlacementController.prototype, "returnReviews", null);
__decorate([
    (0, common_1.Post)(':id/return-review'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'adminApproveQualificationReturnReview' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, QualificationReturnReviewDto, String]),
    __metadata("design:returntype", void 0)
], AdminQualificationPlacementController.prototype, "approveReturnReview", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ operationId: 'adminQualificationPlacementMonitor' }),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('aging')),
    __param(2, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AdminQualificationPlacementController.prototype, "monitor", null);
__decorate([
    (0, common_1.Post)('sweep-overdue'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'QUALIFICATION_PLACEMENT_OVERRIDE'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'adminSweepOverdueQualificationPlacements' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminQualificationPlacementController.prototype, "sweep", null);
__decorate([
    (0, common_1.Post)(':id/place'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'QUALIFICATION_PLACEMENT_OVERRIDE'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'adminOverrideQualificationPlacement', description: 'Requires explicit placement override role and reason. Same legality/concurrency checks as Sponsor owner placement.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, AdminPlaceQualificationDto, String]),
    __metadata("design:returntype", void 0)
], AdminQualificationPlacementController.prototype, "place", null);
exports.AdminQualificationPlacementController = AdminQualificationPlacementController = __decorate([
    (0, swagger_1.ApiTags)('Admin - Qualification Placement'),
    (0, swagger_1.ApiBearerAuth)('adminBearer'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'COMPLIANCE_AUDIT'),
    (0, common_1.Controller)('admin/qualification-placements'),
    __metadata("design:paramtypes", [qualification_placement_service_1.QualificationPlacementService])
], AdminQualificationPlacementController);
//# sourceMappingURL=qualification-placement.controller.js.map