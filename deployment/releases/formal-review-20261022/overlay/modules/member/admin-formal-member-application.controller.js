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
exports.AdminFormalMemberApplicationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../auth/roles.decorator");
const formal_member_application_service_1 = require("./formal-member-application.service");
const formal_membership_conflict_service_1 = require("./formal-membership-conflict.service");
const formal_kyc_document_service_1 = require("./formal-kyc-document.service");
const idempotency_guard_1 = require("../../common/guards/idempotency.guard");
const class_validator_1 = require("class-validator");
class AdminPaperFormalApplicationDto {
    representativePersonId;
    paperApplicationReference;
    formalContractVersionId;
    applicantType;
    legalName;
    gender;
    birthDate;
    nationalityCode;
    identityDocumentType;
    identityDocumentNumber;
    legalEntityName;
    legalEntityRegistrationNo;
    legalEntityRegisteredAddress;
    legalEntityRegistrationCountryCode;
    representativeLegalName;
    representativeNationalityCode;
    representativeIdentityDocumentType;
    representativeIdentityDocumentNumber;
    hasSpouse = false;
    spouseName;
    spouseNationalityCode;
    spouseIdentityDocumentType;
    spouseIdentityDocumentNumber;
    communicationAddress;
    phone;
    email;
    bankCode;
    bankAccount;
    accountHolder;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "representativePersonId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "paperApplicationReference", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "formalContractVersionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['INDIVIDUAL', 'LEGAL_ENTITY'] }),
    (0, class_validator_1.IsIn)(['INDIVIDUAL', 'LEGAL_ENTITY']),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "applicantType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120 }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'INDIVIDUAL'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "legalName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 32 }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'INDIVIDUAL'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "gender", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date' }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'INDIVIDUAL'),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "birthDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'TW' }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'INDIVIDUAL'),
    (0, class_validator_1.Matches)(/^[A-Z]{2}$/),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "nationalityCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['NATIONAL_ID', 'RESIDENCE_PERMIT', 'PASSPORT', 'OTHER'] }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'INDIVIDUAL'),
    (0, class_validator_1.IsIn)(['NATIONAL_ID', 'RESIDENCE_PERMIT', 'PASSPORT', 'OTHER']),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "identityDocumentType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 64 }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'INDIVIDUAL'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "identityDocumentNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 160 }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'LEGAL_ENTITY'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "legalEntityName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 40 }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'LEGAL_ENTITY'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "legalEntityRegistrationNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500 }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'LEGAL_ENTITY'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "legalEntityRegisteredAddress", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'TW' }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'LEGAL_ENTITY'),
    (0, class_validator_1.Matches)(/^[A-Z]{2}$/),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "legalEntityRegistrationCountryCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120 }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'LEGAL_ENTITY'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "representativeLegalName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'TW' }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'LEGAL_ENTITY'),
    (0, class_validator_1.Matches)(/^[A-Z]{2}$/),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "representativeNationalityCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['NATIONAL_ID', 'RESIDENCE_PERMIT', 'PASSPORT', 'OTHER'] }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'LEGAL_ENTITY'),
    (0, class_validator_1.IsIn)(['NATIONAL_ID', 'RESIDENCE_PERMIT', 'PASSPORT', 'OTHER']),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "representativeIdentityDocumentType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 64 }),
    (0, class_validator_1.ValidateIf)(o => o.applicantType === 'LEGAL_ENTITY'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "representativeIdentityDocumentNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '是否有配偶，請明確傳入 true 或 false' }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminPaperFormalApplicationDto.prototype, "hasSpouse", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120 }),
    (0, class_validator_1.ValidateIf)(o => o.hasSpouse === true),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "spouseName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'TW' }),
    (0, class_validator_1.ValidateIf)(o => o.hasSpouse === true),
    (0, class_validator_1.Matches)(/^[A-Z]{2}$/),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "spouseNationalityCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['NATIONAL_ID', 'RESIDENCE_PERMIT', 'PASSPORT', 'OTHER'] }),
    (0, class_validator_1.ValidateIf)(o => o.hasSpouse === true),
    (0, class_validator_1.IsIn)(['NATIONAL_ID', 'RESIDENCE_PERMIT', 'PASSPORT', 'OTHER']),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "spouseIdentityDocumentType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 64 }),
    (0, class_validator_1.ValidateIf)(o => o.hasSpouse === true),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "spouseIdentityDocumentNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 500 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "communicationAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 32 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'email', maxLength: 254 }),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 16 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(16),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "bankCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 34 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(34),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "bankAccount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminPaperFormalApplicationDto.prototype, "accountHolder", void 0);
class PaperScanUploadDto {
    mimeType;
    contentBase64;
}
__decorate([
    (0, class_validator_1.IsIn)(['image/jpeg', 'image/png', 'application/pdf']),
    __metadata("design:type", String)
], PaperScanUploadDto.prototype, "mimeType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(13981016),
    __metadata("design:type", String)
], PaperScanUploadDto.prototype, "contentBase64", void 0);
class MoreInfoDto {
    note;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], MoreInfoDto.prototype, "note", void 0);
class AdminFormalUpdateDto extends (0, swagger_1.OmitType)(AdminPaperFormalApplicationDto, ['representativePersonId', 'paperApplicationReference']) {
    expectedVersion;
    reason;
    sponsorBallNo;
    paperApplicationReference;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminFormalUpdateDto.prototype, "expectedVersion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 500 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AdminFormalUpdateDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(48),
    __metadata("design:type", String)
], AdminFormalUpdateDto.prototype, "sponsorBallNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminFormalUpdateDto.prototype, "paperApplicationReference", void 0);
class AdminPaperEvidenceReviewDto {
    evidenceType;
    decision;
    sourceReference;
    note;
}
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['SIGNED_APPLICATION_AGREEMENT', 'IDENTITY_FRONT', 'IDENTITY_BACK', 'BANKBOOK_COVER', 'CORPORATE_REGISTRATION', 'REPRESENTATIVE_IDENTITY_FRONT', 'REPRESENTATIVE_IDENTITY_BACK', 'CORPORATE_BANK_PROOF', 'TAX_REGISTRATION', 'OTHER'] }),
    (0, class_validator_1.IsIn)(['SIGNED_APPLICATION_AGREEMENT', 'IDENTITY_FRONT', 'IDENTITY_BACK', 'BANKBOOK_COVER', 'CORPORATE_REGISTRATION', 'REPRESENTATIVE_IDENTITY_FRONT', 'REPRESENTATIVE_IDENTITY_BACK', 'CORPORATE_BANK_PROOF', 'TAX_REGISTRATION', 'OTHER']),
    __metadata("design:type", String)
], AdminPaperEvidenceReviewDto.prototype, "evidenceType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['REVIEWED', 'REJECTED'] }),
    (0, class_validator_1.IsIn)(['REVIEWED', 'REJECTED']),
    __metadata("design:type", String)
], AdminPaperEvidenceReviewDto.prototype, "decision", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AdminPaperEvidenceReviewDto.prototype, "sourceReference", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AdminPaperEvidenceReviewDto.prototype, "note", void 0);
let AdminFormalMemberApplicationController = class AdminFormalMemberApplicationController {
    service;
    conflicts;
    kyc;
    constructor(service, conflicts, kyc) {
        this.service = service;
        this.conflicts = conflicts;
        this.kyc = kyc;
    }
    requestMoreInfo(id, body, req) { return this.service.requestMoreInfo(id, body.note, req.user?.personId, req.requestId); }
    update(id, body, key, req) { return this.service.adminUpdate(id, body, req.user?.personId, key, req.requestId); }
    searchLegalEntities(q, take) { return this.service.adminLegalEntities({ q: q || undefined, take: Number(take ?? 20) }); }
    requiredContracts() { return this.service.adminRequiredContracts(); }
    createPaper(body, key, req) { return this.service.createPaper(body, req.user?.personId, key, req.requestId); }
    list(status, take, q) { return this.service.adminList({ status: status || undefined, take: Number(take ?? 50), q }); }
    reviewPaperEvidence(id, body, req) {
        return this.service.reviewPaperEvidence(id, body.evidenceType, body.decision, body.sourceReference, body.note, req.user?.personId, req.requestId);
    }
    beginReview(id, req) { return this.service.beginReview(id, req.user?.personId, req.requestId); }
    approve(id, req) { return this.service.approve(id, req.user?.personId, req.requestId); }
    uploadPaperScan(id, body, req) { return this.kyc.upload(req.user?.personId, id, 'SIGNED_APPLICATION_AGREEMENT', body.mimeType, body.contentBase64, req.requestId, true); }
    documents(id) { return this.kyc.adminList(id); }
    async documentContent(documentId, req) { const blob = await this.kyc.adminContent(documentId, req.user?.personId, req.requestId); return new common_1.StreamableFile(blob.bytes, { type: blob.mimeType }); }
    detail(id, req) { return this.service.adminDetail(id, req.user?.personId, req.requestId); }
    conflictsFor(id) { return this.conflicts.evaluate(id); }
    reviewCrossLine(id, req) { return this.conflicts.review(id, req.user?.personId, req.requestId); }
    verifySpouse(id, key, req) { return this.service.verifySpouse(id, req.user?.personId, key, req.requestId); }
};
exports.AdminFormalMemberApplicationController = AdminFormalMemberApplicationController;
__decorate([
    (0, common_1.Post)(':id/request-more-info'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS'),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, MoreInfoDto, Object]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "requestMoreInfo", null);
__decorate([
    (0, common_1.Get)('legal-entities/search'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminSearchFormalLegalEntities', description: 'Search active formal LegalEntity owners for Qualification/Ball application creation.' }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "searchLegalEntities", null);
__decorate([
    (0, common_1.Get)('contracts/required'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminFormalRequiredContracts', description: 'List currently effective required Formal Member contract versions for back-office paper intake.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "requiredContracts", null);
__decorate([
    (0, common_1.Post)('paper'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'adminCreatePaperFormalMemberApplication', description: 'Back-office entry for paper INDIVIDUAL or LEGAL_ENTITY formal applications. Corporate applications are paper-only. Creates no Qualification/Ball.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AdminPaperFormalApplicationDto, String, Object]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "createPaper", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ operationId: 'adminListFormalMemberApplications', description: 'Read-only metadata queue. The encrypted application payload is never decrypted or returned.' }),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('take')),
    __param(2, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':id/paper-evidence'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'adminReviewPaperFormalEvidence', description: 'Record that an authorized operator reviewed a physical paper evidence item. Does not fabricate a digital upload.' }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, AdminPaperEvidenceReviewDto, Object]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "reviewPaperEvidence", null);
__decorate([
    (0, common_1.Post)(':id/begin-review'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminBeginFormalMemberReview', description: 'Move a formal application into UNDER_REVIEW only after document/evidence, spouse and cross-line gates pass.' }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "beginReview", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminApproveFormalMember', description: 'Approve a fully reviewed Person or LegalEntity as FORMAL_MEMBER. Does not create a Qualification/Ball; packages are purchased separately.' }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/paper-scan'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS'),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PaperScanUploadDto, Object]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "uploadPaperScan", null);
__decorate([
    (0, common_1.Get)(':id/documents'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminFormalApplicationDocuments', description: 'List KYC document metadata for review; private storage object keys/URLs are not returned.' }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "documents", null);
__decorate([
    (0, common_1.Get)('documents/:documentId/content'),
    (0, common_1.Header)('Cache-Control', 'private, no-store'),
    (0, common_1.Header)('X-Content-Type-Options', 'nosniff'),
    (0, common_1.Header)('Referrer-Policy', 'no-referrer'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminFormalApplicationDocumentContent', description: 'Audited role-restricted read of one private KYC document image.' }),
    __param(0, (0, common_1.Param)('documentId', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminFormalMemberApplicationController.prototype, "documentContent", null);
__decorate([
    (0, common_1.Get)(':id/detail'),
    (0, common_1.Header)('Cache-Control', 'private, no-store'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminFormalMemberApplicationDetail', description: 'Audited KYC review detail for authorized membership/compliance staff. This dedicated endpoint may return decrypted application PII and must not be used by ordinary queues/analytics.' }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "detail", null);
__decorate([
    (0, common_1.Get)(':id/cross-line-conflicts'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminFormalMemberCrossLineConflicts', description: 'Evaluate spouse, identity, representative and legal-entity duplicate conflicts from privacy-preserving indexes. Returns codes only; no raw national ID.' }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "conflictsFor", null);
__decorate([
    (0, common_1.Post)(':id/cross-line-review'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'COMPLIANCE_AUDIT'),
    (0, swagger_1.ApiOperation)({ operationId: 'adminReviewFormalMemberCrossLine', description: 'Evaluate and persist the formal membership anti-cross-line result. BLOCKED conflicts must be resolved before any future approval workflow may proceed.' }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "reviewCrossLine", null);
__decorate([
    (0, common_1.Post)(':id/spouse-verification'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'COMPLIANCE_AUDIT'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'adminVerifyFormalMemberSpouse', description: 'Confirm spouse data against authorized KYC evidence. Persists only a masked spouse name and keyed identity fingerprint; raw spouse ID is never returned.' }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "verifySpouse", null);
exports.AdminFormalMemberApplicationController = AdminFormalMemberApplicationController = __decorate([
    (0, swagger_1.ApiTags)('Admin - Formal Member Application'),
    (0, swagger_1.ApiBearerAuth)('adminBearer'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'COMPLIANCE_AUDIT'),
    (0, common_1.Controller)('admin/formal-member-applications'),
    __metadata("design:paramtypes", [formal_member_application_service_1.FormalMemberApplicationService, formal_membership_conflict_service_1.FormalMembershipConflictService, formal_kyc_document_service_1.FormalKycDocumentService])
], AdminFormalMemberApplicationController);
//# sourceMappingURL=admin-formal-member-application.controller.js.map
__decorate([
    (0, common_1.Post)(':id/update'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'MEMBERSHIP_OPS'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'adminUpdateFormalApplication', description: 'Correct pending application data using encrypted versioned snapshots and optimistic concurrency. Does not impersonate member consent or approve membership.' }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, AdminFormalUpdateDto, String, Object]),
    __metadata("design:returntype", void 0)
], AdminFormalMemberApplicationController.prototype, "update", null);