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
exports.BinaryTreeReadController = void 0;
const class_transformer_1 = require("class-transformer");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../auth/roles.decorator");
const binary_tree_read_service_1 = require("./binary-tree-read.service");
const binary_tree_service_1 = require("./binary-tree.service");
class CurrentTreeQuery {
    after;
    ballNo;
    candidateBallNo;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CurrentTreeQuery.prototype, "after", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[A-Z][A-Z0-9_-]{0,70}$/),
    __metadata("design:type", String)
], CurrentTreeQuery.prototype, "ballNo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[A-Z][A-Z0-9_-]{0,70}$/),
    __metadata("design:type", String)
], CurrentTreeQuery.prototype, "candidateBallNo", void 0);
class TreeTimeQuery {
    timezone;
    asOf;
    periodStart;
    periodEnd;
    knowledgeCutoff;
}
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['Asia/Taipei'] }),
    (0, class_validator_1.IsIn)(['Asia/Taipei']),
    __metadata("design:type", String)
], TreeTimeQuery.prototype, "timezone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TreeTimeQuery.prototype, "asOf", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TreeTimeQuery.prototype, "periodStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TreeTimeQuery.prototype, "periodEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TreeTimeQuery.prototype, "knowledgeCutoff", void 0);
class TreeListQuery extends TreeTimeQuery {
    after;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TreeListQuery.prototype, "after", void 0);
class TreeNodeQuery extends TreeListQuery {
    parentQualificationId;
    snapshotToken;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Expand direct children within the same tree-wide snapshot; never downloads the entire tree.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TreeNodeQuery.prototype, "parentQualificationId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'First-page snapshot identity, required with after; bound to actor, role, tree and time. Conflict/expiry: 409.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TreeNodeQuery.prototype, "snapshotToken", void 0);
class TreePreviewQuery {
    qualificationId;
    qualificationMemberNo;
    binaryParentQualificationId;
    binaryParentBallNo;
    side;
    expectedVersion;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Legacy technical identifier. Prefer qualificationMemberNo.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TreePreviewQuery.prototype, "qualificationId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Public Member Number for the single unplaced Member-origin qualification.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{10}$/),
    __metadata("design:type", String)
], TreePreviewQuery.prototype, "qualificationMemberNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Legacy technical identifier. Prefer binaryParentBallNo.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TreePreviewQuery.prototype, "binaryParentQualificationId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Immutable public Ball Number of the parent within this Tree.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TreePreviewQuery.prototype, "binaryParentBallNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['LEFT', 'RIGHT'] }),
    (0, class_validator_1.IsIn)(['LEFT', 'RIGHT']),
    __metadata("design:type", String)
], TreePreviewQuery.prototype, "side", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], TreePreviewQuery.prototype, "expectedVersion", void 0);
let BinaryTreeReadController = class BinaryTreeReadController {
    service;
    commands;
    constructor(service, commands) {
        this.service = service;
        this.commands = commands;
    }
    async currentList(req, query) { return { data: await this.service.currentList(req.user, query.after) }; }
    async currentState(req, id, query) { return { data: await this.service.currentState(req.user, id, query) }; }
    async list(req, input) { const { after, ...time } = input; return { data: await this.service.list(req.user, time, after) }; }
    async detail(req, id, time) { return { data: await this.service.detail(req.user, id, { ...time }) }; }
    async nodes(req, id, input) { const { after, snapshotToken, parentQualificationId, ...time } = input; return { data: await this.service.nodes(req.user, id, time, after, snapshotToken, parentQualificationId) }; }
    async preview(req, id, input) {
        const binaryParentQualificationId = input.binaryParentBallNo ? await this.commands.resolveTreeBall(req.user, id, input.binaryParentBallNo) : input.binaryParentQualificationId;
        if (!binaryParentQualificationId)
            throw new common_1.UnprocessableEntityException({ code: 'BINARY_PARENT_BALL_REQUIRED' });
        const qualificationId = input.qualificationMemberNo ? await this.commands.resolveUnplacedMemberQualification(req.user, input.qualificationMemberNo) : input.qualificationId;
        if (!qualificationId)
            throw new common_1.UnprocessableEntityException({ code: 'QUALIFICATION_MEMBER_NO_REQUIRED' });
        return { data: await this.commands.preview(req.user, id, { ...input, qualificationId, binaryParentQualificationId }) };
    }
};
exports.BinaryTreeReadController = BinaryTreeReadController;
__decorate([
    (0, common_1.Get)('current'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CurrentTreeQuery]),
    __metadata("design:returntype", Promise)
], BinaryTreeReadController.prototype, "currentList", null);
__decorate([
    (0, common_1.Get)(':id/current-state'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CurrentTreeQuery]),
    __metadata("design:returntype", Promise)
], BinaryTreeReadController.prototype, "currentState", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminListBinaryTrees', summary: '依指定時間與記錄截點列出樹' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, TreeListQuery]),
    __metadata("design:returntype", Promise)
], BinaryTreeReadController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminReadBinaryTree', summary: '讀取樹與七個標準位置的非金額歷史統計', description: 'Company position LEADER presentation is returned only from a sealed effective profile binding. Missing or ambiguous evidence is UNAVAILABLE; clients must not infer LEADER from a position number or Company ownership.' }),
    (0, swagger_1.ApiResponse)({ status: 200, schema: { type: 'object', required: ['data'], properties: { data: { type: 'object', required: ['status', 'time', 'result'], properties: {
                        status: { type: 'string', enum: ['PARTIAL', 'UNAVAILABLE'] },
                        time: { type: 'object' },
                        result: { type: 'object', nullable: true, properties: { positions: { type: 'array', items: { type: 'object', properties: {
                                            positionNo: { type: 'integer' }, ballNo: { type: 'string', nullable: true }, ownerType: { type: 'string', nullable: true }, activeLabel: { type: 'string', nullable: true },
                                            companyProfile: { type: 'object', nullable: true, description: 'Bounded Company bootstrap profile read; no rule/parameter/snapshot evidence is returned.', required: ['status', 'planCode', 'profileVersion'], properties: { status: { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE'] }, planCode: { type: 'string', nullable: true, enum: ['LEADER'] }, profileVersion: { type: 'string', nullable: true } } }
                                        } } } } }
                    } } } } }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Admin authentication required' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Tree role policy denies access' }),
    (0, swagger_1.ApiResponse)({ status: 422, description: 'Invalid historical time context' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, TreeTimeQuery]),
    __metadata("design:returntype", Promise)
], BinaryTreeReadController.prototype, "detail", null);
__decorate([
    (0, common_1.Get)(':id/nodes'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminReadBinaryTreeNodes', summary: '分頁讀取指定時間的完整樹節點；總數不受頁面上限限制' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, TreeNodeQuery]),
    __metadata("design:returntype", Promise)
], BinaryTreeReadController.prototype, "nodes", null);
__decorate([
    (0, common_1.Get)(':id/placement-preview'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminPreviewTreePlacement', summary: '預檢實際 Sponsor 與指定位置，回傳版本綁定 token' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, TreePreviewQuery]),
    __metadata("design:returntype", Promise)
], BinaryTreeReadController.prototype, "preview", null);
exports.BinaryTreeReadController = BinaryTreeReadController = __decorate([
    (0, swagger_1.ApiTags)('Admin - Binary Trees'),
    (0, swagger_1.ApiBearerAuth)('adminBearer'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'QUALIFICATION_PLACEMENT_OVERRIDE', 'COMPLIANCE_AUDIT'),
    (0, common_1.Controller)('admin/organization/trees'),
    __metadata("design:paramtypes", [binary_tree_read_service_1.BinaryTreeReadService, binary_tree_service_1.BinaryTreeService])
], BinaryTreeReadController);
//# sourceMappingURL=binary-tree-read.controller.js.map