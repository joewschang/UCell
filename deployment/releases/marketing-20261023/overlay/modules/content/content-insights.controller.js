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
exports.MemberContentShareController = exports.AdminContentInsightsController = exports.MemberContentInsightsController = void 0;
const member_share_link_service_1 = require("../member/member-share-link.service");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const member_authentication_guard_1 = require("../auth/member-authentication.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const content_insights_service_1 = require("./content-insights.service");
class InsightsQuery {
    qualificationId;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], InsightsQuery.prototype, "qualificationId", void 0);
let MemberContentInsightsController = class MemberContentInsightsController {
    service;
    constructor(service) {
        this.service = service;
    }
    get(req, query) { return this.service.read(req.user.personId, query.qualificationId); }
};
exports.MemberContentInsightsController = MemberContentInsightsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, InsightsQuery]),
    __metadata("design:returntype", void 0)
], MemberContentInsightsController.prototype, "get", null);
exports.MemberContentInsightsController = MemberContentInsightsController = __decorate([
    (0, swagger_1.ApiTags)('Member - Content'),
    (0, swagger_1.ApiBearerAuth)('memberBearer'),
    (0, common_1.UseGuards)(member_authentication_guard_1.MemberAuthenticationGuard),
    (0, common_1.Controller)('member/content-insights'),
    __metadata("design:paramtypes", [content_insights_service_1.ContentInsightsService])
], MemberContentInsightsController);
let AdminContentInsightsController = class AdminContentInsightsController {
    service;
    constructor(service) {
        this.service = service;
    }
    get() { return this.service.read(); }
};
exports.AdminContentInsightsController = AdminContentInsightsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminContentInsightsController.prototype, "get", null);
exports.AdminContentInsightsController = AdminContentInsightsController = __decorate([
    (0, swagger_1.ApiTags)('Admin - Content'),
    (0, swagger_1.ApiBearerAuth)('adminBearer'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'ORDER_OPS', 'COMPLIANCE_AUDIT'),
    (0, common_1.Controller)('admin/content-insights'),
    __metadata("design:paramtypes", [content_insights_service_1.ContentInsightsService])
], AdminContentInsightsController);
class ShareDto extends InsightsQuery {
    contentId;
    productSku;
    eventCode;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ShareDto.prototype, "contentId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^TIP-\d{3}$/),
    __metadata("design:type", String)
], ShareDto.prototype, "productSku", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[A-Z][A-Z0-9_-]{2,39}$/),
    __metadata("design:type", String)
], ShareDto.prototype, "eventCode", void 0);
let MemberContentShareController = class MemberContentShareController {
    links;
    constructor(links) {
        this.links = links;
    }
    create(req, body) { return this.links.create(req.user.personId, body.qualificationId, new Date(), body.contentId, { productSku: body.productSku, eventCode: body.eventCode }); }
    revoke(req, id, body) { return this.links.revoke(req.user.personId, body.qualificationId, id); }
};
exports.MemberContentShareController = MemberContentShareController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ShareDto]),
    __metadata("design:returntype", void 0)
], MemberContentShareController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/revoke'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, InsightsQuery]),
    __metadata("design:returntype", void 0)
], MemberContentShareController.prototype, "revoke", null);
exports.MemberContentShareController = MemberContentShareController = __decorate([
    (0, swagger_1.ApiTags)('Member - Content'),
    (0, swagger_1.ApiBearerAuth)('memberBearer'),
    (0, common_1.UseGuards)(member_authentication_guard_1.MemberAuthenticationGuard),
    (0, common_1.Controller)('member/content-share-links'),
    __metadata("design:paramtypes", [member_share_link_service_1.MemberShareLinkService])
], MemberContentShareController);
//# sourceMappingURL=content-insights.controller.js.map