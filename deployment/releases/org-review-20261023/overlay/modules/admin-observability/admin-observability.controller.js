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
exports.AdminObservabilityController = void 0;
const roles_decorator_1 = require("../auth/roles.decorator");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const admin_observability_service_1 = require("./admin-observability.service");
const admin_observability_dto_1 = require("./admin-observability.dto");
let AdminObservabilityController = class AdminObservabilityController {
    service;
    constructor(service) {
        this.service = service;
    }
    sponsorTree(id, depth, at) {
        return this.service.sponsorTree(id, Number(depth ?? 2), at ? new Date(at) : new Date())
            .then(data => ({ data }));
    }
    binaryTree(id, depth, at) {
        return this.service.binaryTree(id, Number(depth ?? 2), at ? new Date(at) : new Date())
            .then(data => ({ data }));
    }
    operations(id) {
        return this.service.qualificationOperations(id).then(data => ({ data }));
    }
    award(id) {
        return this.service.awardDetail(id).then(data => ({ data }));
    }
    settlements(type, take) {
        return this.service.settlementHistory({ settlementType: type, take: Number(take ?? 50) })
            .then(data => ({ data }));
    }
    pools(take) {
        return this.service.poolHistory(Number(take ?? 24)).then(data => ({ data }));
    }
    reservoirA(take) { return this.service.reservoirA(Number(take ?? 100)).then(data => ({ data })); }
    summary() { return this.service.compensationSummary().then(data => ({ data })); }
};
exports.AdminObservabilityController = AdminObservabilityController;
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'FINANCE', 'COMPLIANCE_AUDIT'),
    (0, common_1.Get)('organization/sponsor-tree/:rootQualificationId'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminSponsorTree', summary: '推薦樹視圖' }),
    __param(0, (0, common_1.Param)('rootQualificationId')),
    __param(1, (0, common_1.Query)('depth')),
    __param(2, (0, common_1.Query)('at')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AdminObservabilityController.prototype, "sponsorTree", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'FINANCE', 'COMPLIANCE_AUDIT'),
    (0, common_1.Get)('organization/binary-tree/:rootQualificationId'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminBinaryTree', summary: '二元樹視圖' }),
    __param(0, (0, common_1.Param)('rootQualificationId')),
    __param(1, (0, common_1.Query)('depth')),
    __param(2, (0, common_1.Query)('at')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AdminObservabilityController.prototype, "binaryTree", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'FINANCE', 'COMPLIANCE_AUDIT'),
    (0, common_1.Get)('qualifications/:qualificationId/operations'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminQualificationOperations', summary: 'Qualification Active/PV/Award/Carry營運視圖' }),
    __param(0, (0, common_1.Param)('qualificationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminObservabilityController.prototype, "operations", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'FINANCE', 'COMPLIANCE_AUDIT'),
    (0, common_1.Get)('awards/:bonusAwardId'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminAwardDetail', summary: '獎金來源、K值、生命週期、Recovery與Payable Drill-down' }),
    __param(0, (0, common_1.Param)('bonusAwardId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminObservabilityController.prototype, "award", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'FINANCE', 'COMPLIANCE_AUDIT'),
    (0, common_1.Get)('settlements'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminSettlementHistory', summary: 'K0/K1/K2 Settlement歷史與池壓縮' }),
    __param(0, (0, common_1.Query)('type')),
    __param(1, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminObservabilityController.prototype, "settlements", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'FINANCE', 'COMPLIANCE_AUDIT'),
    (0, common_1.Get)('pools'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminPoolHistory', summary: 'Global/Welfare Pool歷史' }),
    __param(0, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminObservabilityController.prototype, "pools", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'FINANCE', 'COMPLIANCE_AUDIT'),
    (0, common_1.Get)('reservoir-a'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminReservoirAHistory', summary: 'Reservoir A append-only effects and authoritative balance' }),
    (0, swagger_1.ApiResponse)({ status: 200, schema: { type: 'object', required: ['data'], properties: { data: { $ref: (0, swagger_1.getSchemaPath)(admin_observability_dto_1.ReservoirAView) } } } }),
    __param(0, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminObservabilityController.prototype, "reservoirA", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'FINANCE', 'COMPLIANCE_AUDIT'),
    (0, common_1.Get)('compensation/summary'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminCompensationSummary', summary: '獎金/結算/Recovery營運摘要' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminObservabilityController.prototype, "summary", null);
exports.AdminObservabilityController = AdminObservabilityController = __decorate([
    (0, swagger_1.ApiTags)('Admin - Organization & Compensation Observability'),
    (0, swagger_1.ApiBearerAuth)('adminBearer'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN'),
    (0, common_1.Controller)('admin/observability'),
    (0, swagger_1.ApiExtraModels)(admin_observability_dto_1.V3EvidenceView, admin_observability_dto_1.ReservoirAEffectView, admin_observability_dto_1.ReservoirAView),
    __metadata("design:paramtypes", [admin_observability_service_1.AdminObservabilityService])
], AdminObservabilityController);
//# sourceMappingURL=admin-observability.controller.js.map