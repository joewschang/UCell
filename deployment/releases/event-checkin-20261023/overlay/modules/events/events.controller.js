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
exports.MemberEventsController = exports.PublicEventImagesController = exports.AdminEventsController = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../auth/roles.decorator");
const member_authentication_guard_1 = require("../auth/member-authentication.guard");
const idempotency_guard_1 = require("../../common/guards/idempotency.guard");
const events_service_1 = require("./events.service");
class EventDto {
    eventCode;
    title;
    description;
    eventType;
    startsAt;
    endsAt;
    locationReference;
    onlineJoinReference;
    capacity;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.Matches)(/^[A-Z][A-Z0-9_-]{2,39}$/),
    __metadata("design:type", String)
], EventDto.prototype, "eventCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 160),
    __metadata("design:type", String)
], EventDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], EventDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['ONLINE', 'OFFLINE', 'HYBRID'] }),
    (0, class_validator_1.IsIn)(['ONLINE', 'OFFLINE', 'HYBRID']),
    __metadata("design:type", String)
], EventDto.prototype, "eventType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EventDto.prototype, "startsAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EventDto.prototype, "endsAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], EventDto.prototype, "locationReference", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], EventDto.prototype, "onlineJoinReference", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(1000000),
    __metadata("design:type", Number)
], EventDto.prototype, "capacity", void 0);
class PublishDto {
    approvalReference;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], PublishDto.prototype, "approvalReference", void 0);
class EventEditDto {
    baseVersion;
    baseHash;
    title;
    description;
    media;
}
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], EventEditDto.prototype, "baseVersion", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^[a-f0-9]{64}$/),
    __metadata("design:type", String)
], EventEditDto.prototype, "baseHash", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 160),
    __metadata("design:type", String)
], EventEditDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], EventEditDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], EventEditDto.prototype, "media", void 0);
class EventImageDto {
    mimeType;
    contentBase64;
}
__decorate([
    (0, class_validator_1.IsIn)(['image/jpeg', 'image/png', 'image/webp']),
    __metadata("design:type", String)
], EventImageDto.prototype, "mimeType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(699052),
    __metadata("design:type", String)
], EventImageDto.prototype, "contentBase64", void 0);
class ArchiveDto {
    reason;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 500),
    __metadata("design:type", String)
], ArchiveDto.prototype, "reason", void 0);
class CheckInDto {
    checkInToken;
    eventCode;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9_-]{43}$/),
    __metadata("design:type", String)
], CheckInDto.prototype, "checkInToken", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[A-Z][A-Z0-9_-]{2,39}$/),
    __metadata("design:type", String)
], CheckInDto.prototype, "eventCode", void 0);
class MemberCheckInDto {
    memberNo;
    addMissing;
    reason;
}
__decorate([
    (0, class_validator_1.Matches)(/^\d{10}$/),
    __metadata("design:type", String)
], MemberCheckInDto.prototype, "memberNo", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MemberCheckInDto.prototype, "addMissing", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], MemberCheckInDto.prototype, "reason", void 0);
class EventReminderDto {
    memberNo;
    reason;
}
__decorate([
    (0, swagger_1.ApiProperty)({ pattern: '^[0-9]{10}$' }),
    (0, class_validator_1.Matches)(/^\d{10}$/),
    __metadata("design:type", String)
], EventReminderDto.prototype, "memberNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 500 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 500),
    __metadata("design:type", String)
], EventReminderDto.prototype, "reason", void 0);
class AttendanceDto {
    memberNo;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.Matches)(/^\d{10}$/),
    __metadata("design:type", String)
], AttendanceDto.prototype, "memberNo", void 0);
let AdminEventsController = class AdminEventsController {
    s;
    constructor(s) {
        this.s = s;
    }
    candidate(eventCode, memberNo) { return this.s.checkInCandidate(eventCode, memberNo); }
    memberCheckIn(eventCode, body, key, req) { return this.s.checkInMember(eventCode, body.memberNo, body.addMissing, body.reason, req.user?.personId ?? req.user?.subject, key, req.requestId ?? (0, node_crypto_1.randomUUID)()); }
    upload(body, key, req) { return this.s.uploadImage(body.mimeType, body.contentBase64, req.user?.personId ?? req.user?.subject, key, req.requestId ?? (0, node_crypto_1.randomUUID)()); }
    async image(id) { const image = await this.s.image(id, true); return new common_1.StreamableFile(image.content, { type: image.mime_type }); }
    edit(code, body, key, req) { return this.s.edit(code, body, req.user?.personId ?? req.user?.subject, key, req.requestId ?? (0, node_crypto_1.randomUUID)()); }
    remind(eventCode, body, key, req) { return this.s.remind(eventCode, body.memberNo, body.reason, req.user?.personId ?? req.user?.subject, key, req.requestId ?? (0, node_crypto_1.randomUUID)()).then(data => ({ data })); }
    list() { return this.s.adminList().then(data => ({ data })); }
    registrations(eventCode) { return this.s.adminRegistrations(eventCode).then(data => ({ data })); }
    create(body, key, req) { return this.s.create(body, req.user?.personId ?? req.user?.subject, key, req.requestId ?? (0, node_crypto_1.randomUUID)()).then(data => ({ data })); }
    publish(eventCode, body, key, req) { return this.s.publish(eventCode, body?.approvalReference, req.user?.personId ?? req.user?.subject, key, req.requestId ?? (0, node_crypto_1.randomUUID)()).then(data => ({ data })); }
    archive(eventCode, body, key, req) { return this.s.archive(eventCode, body?.reason, req.user?.personId ?? req.user?.subject, key, req.requestId ?? (0, node_crypto_1.randomUUID)()).then(data => ({ data })); }
    checkIn(body, key, req) { return this.s.checkIn(body?.checkInToken, req.user?.personId ?? req.user?.subject, key, req.requestId ?? (0, node_crypto_1.randomUUID)(), body.eventCode).then(data => ({ data })); }
    attend(eventCode, body, key, req) { return this.s.attend(eventCode, body.memberNo, req.user?.personId ?? req.user?.subject, key, req.requestId ?? (0, node_crypto_1.randomUUID)()).then(data => ({ data })); }
};
exports.AdminEventsController = AdminEventsController;
__decorate([
    (0, common_1.Get)(':eventCode/check-in-member'),
    __param(0, (0, common_1.Param)('eventCode')),
    __param(1, (0, common_1.Query)('memberNo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminEventsController.prototype, "candidate", null);
__decorate([
    (0, common_1.Post)(':eventCode/check-in-member'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    __param(0, (0, common_1.Param)('eventCode')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, MemberCheckInDto, String, Object]),
    __metadata("design:returntype", void 0)
], AdminEventsController.prototype, "memberCheckIn", null);
__decorate([
    (0, common_1.Post)('images'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [EventImageDto, String, Object]),
    __metadata("design:returntype", void 0)
], AdminEventsController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)('images/:id'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminEventsController.prototype, "image", null);
__decorate([
    (0, common_1.Post)(':eventCode/content'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    __param(0, (0, common_1.Param)('eventCode')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, EventEditDto, String, Object]),
    __metadata("design:returntype", void 0)
], AdminEventsController.prototype, "edit", null);
__decorate([
    (0, common_1.Post)(':eventCode/remind'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'adminEventReminder', summary: '已報名會員的個別活動提醒，僅存入 UCell 個人訊息中心' }),
    __param(0, (0, common_1.Param)('eventCode')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, EventReminderDto, String, Object]),
    __metadata("design:returntype", void 0)
], AdminEventsController.prototype, "remind", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminEventsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':eventCode/registrations'),
    __param(0, (0, common_1.Param)('eventCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminEventsController.prototype, "registrations", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [EventDto, String, Object]),
    __metadata("design:returntype", void 0)
], AdminEventsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':eventCode/publish'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    __param(0, (0, common_1.Param)('eventCode')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PublishDto, String, Object]),
    __metadata("design:returntype", void 0)
], AdminEventsController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)(':eventCode/archive'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    __param(0, (0, common_1.Param)('eventCode')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ArchiveDto, String, Object]),
    __metadata("design:returntype", void 0)
], AdminEventsController.prototype, "archive", null);
__decorate([
    (0, common_1.Post)('check-in'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CheckInDto, String, Object]),
    __metadata("design:returntype", void 0)
], AdminEventsController.prototype, "checkIn", null);
__decorate([
    (0, common_1.Post)(':eventCode/attend'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    __param(0, (0, common_1.Param)('eventCode')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, AttendanceDto, String, Object]),
    __metadata("design:returntype", void 0)
], AdminEventsController.prototype, "attend", null);
exports.AdminEventsController = AdminEventsController = __decorate([
    (0, swagger_1.ApiTags)('Admin - Events'),
    (0, swagger_1.ApiBearerAuth)('adminBearer'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'ORDER_OPS'),
    (0, common_1.Controller)('admin/events'),
    __metadata("design:paramtypes", [events_service_1.MemberEventsService])
], AdminEventsController);
let PublicEventImagesController = class PublicEventImagesController {
    s;
    constructor(s) {
        this.s = s;
    }
    async image(id) { const image = await this.s.image(id); return new common_1.StreamableFile(image.content, { type: image.mime_type }); }
};
exports.PublicEventImagesController = PublicEventImagesController;
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, common_1.Header)('X-Content-Type-Options', 'nosniff'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicEventImagesController.prototype, "image", null);
exports.PublicEventImagesController = PublicEventImagesController = __decorate([
    (0, common_1.Controller)('event-images'),
    __metadata("design:paramtypes", [events_service_1.MemberEventsService])
], PublicEventImagesController);
let MemberEventsController = class MemberEventsController {
    s;
    constructor(s) {
        this.s = s;
    }
    list(req) { return this.s.memberList(req.user.personId).then(data => ({ data })); }
    detail(req, code) { return this.s.memberDetail(req.user.personId, code).then(data => ({ data })); }
    register(req, code, key) { return this.s.register(req.user.personId, code, key, req.requestId ?? (0, node_crypto_1.randomUUID)()).then(data => ({ data })); }
    cancel(req, code, key) { return this.s.cancel(req.user.personId, code, key, req.requestId ?? (0, node_crypto_1.randomUUID)()).then(data => ({ data })); }
    credential(req, code, key) { return this.s.credential(req.user.personId, code, key, req.requestId ?? (0, node_crypto_1.randomUUID)()).then(data => ({ data })); }
};
exports.MemberEventsController = MemberEventsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MemberEventsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':eventCode'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('eventCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MemberEventsController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':eventCode/register'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('eventCode')),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], MemberEventsController.prototype, "register", null);
__decorate([
    (0, common_1.Post)(':eventCode/cancel'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('eventCode')),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], MemberEventsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':eventCode/credential'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('eventCode')),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], MemberEventsController.prototype, "credential", null);
exports.MemberEventsController = MemberEventsController = __decorate([
    (0, swagger_1.ApiTags)('Member - Events'),
    (0, swagger_1.ApiBearerAuth)('memberBearer'),
    (0, common_1.UseGuards)(member_authentication_guard_1.MemberAuthenticationGuard),
    (0, common_1.Controller)('member/events'),
    __metadata("design:paramtypes", [events_service_1.MemberEventsService])
], MemberEventsController);
//# sourceMappingURL=events.controller.js.map