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
exports.MemberController = exports.MemberAuthController = exports.MemberTreeQueryDto = exports.MemberQueryDto = exports.FormalMemberDraftDto = exports.DeliveryProfileDto = exports.MemberContractConsentDto = exports.FormalKycUploadDto = exports.MemberCreateOrderDto = exports.MemberPackageSelectionDto = exports.MemberProfileDto = exports.MemberLogoutDto = exports.MemberContextDto = exports.MemberGrowthQueryDto = exports.LineExchangeDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const create_order_dto_1 = require("../order/dto/create-order.dto");
const order_service_1 = require("../order/order.service");
const class_transformer_1 = require("class-transformer");
const idempotency_guard_1 = require("../../common/guards/idempotency.guard");
const class_validator_1 = require("class-validator");
const member_read_service_1 = require("./member-read.service");
const member_tree_read_service_1 = require("./member-tree-read.service");
const views = require("./member-view.dto");
const member_context_guard_1 = require("./member-context.guard");
const member_authentication_guard_1 = require("../auth/member-authentication.guard");
const member_service_1 = require("./member.service");
const member_share_link_service_1 = require("./member-share-link.service");
const member_contract_service_1 = require("./member-contract.service");
const delivery_profile_service_1 = require("./delivery-profile.service");
const formal_member_application_service_1 = require("./formal-member-application.service");
const formal_kyc_document_service_1 = require("./formal-kyc-document.service");
const member_growth_dto_1 = require("./member-growth.dto");
const member_growth_service_1 = require("./member-growth.service");
class LineExchangeDto {
    idToken;
}
exports.LineExchangeDto = LineExchangeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'LINE ID token; verified server-side, never logged or persisted raw' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(16384),
    __metadata("design:type", String)
], LineExchangeDto.prototype, "idToken", void 0);
class MemberGrowthQueryDto {
}
exports.MemberGrowthQueryDto = MemberGrowthQueryDto;
class MemberContextDto {
    qualificationId;
}
exports.MemberContextDto = MemberContextDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Selected Qualification; server checks authenticated Person ownership on every request' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MemberContextDto.prototype, "qualificationId", void 0);
class MemberLogoutDto {
    intent;
}
exports.MemberLogoutDto = MemberLogoutDto;
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: 'Optional fixed intent marker; no Person, session or Qualification identifiers accepted.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^LOGOUT$/),
    __metadata("design:type", String)
], MemberLogoutDto.prototype, "intent", void 0);
class MemberProfileDto {
    mobileVerificationProof;
    emailVerificationProof;
    name;
    email;
    phone;
}
exports.MemberProfileDto = MemberProfileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined),
    (0, class_validator_1.Matches)(/^[a-f0-9]{64}$/),
    __metadata("design:type", String)
], MemberProfileDto.prototype, "mobileVerificationProof", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined),
    (0, class_validator_1.Matches)(/^[a-f0-9]{64}$/),
    __metadata("design:type", String)
], MemberProfileDto.prototype, "emailVerificationProof", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, maxLength: 80, description: 'Display name only; legal identity is immutable through Member API' }),
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], MemberProfileDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, format: 'email', maxLength: 254 }),
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], MemberProfileDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, maxLength: 32, description: 'Contact data only; does not bind or authenticate an identity' }),
    (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined),
    (0, class_validator_1.Matches)(/^(?=.*[0-9])\+?[0-9 ()-]{6,32}$/),
    __metadata("design:type", String)
], MemberProfileDto.prototype, "phone", void 0);
class MemberPackageSelectionDto {
    productRuleProfileId;
    quantity;
}
exports.MemberPackageSelectionDto = MemberPackageSelectionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MemberPackageSelectionDto.prototype, "productRuleProfileId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, maximum: 10000 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10000),
    __metadata("design:type", Number)
], MemberPackageSelectionDto.prototype, "quantity", void 0);
class MemberCreateOrderDto {
    qualificationId;
    packageVersionId;
    targetQualificationId;
    legalEntityId;
    items;
    selections;
    sponsorCode;
    retailReferralCode;
    commercialOfferingCode;
    linePurpose;
}
exports.MemberCreateOrderDto = MemberCreateOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[A-Z0-9_-]{3,40}$/),
    __metadata("design:type", String)
], MemberCreateOrderDto.prototype, "couponCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-f0-9]{64}$/),
    __metadata("design:type", String)
], MemberCreateOrderDto.prototype, "quoteHash", void 0);

__decorate([
    (0, swagger_1.ApiProperty)({ required: false, format: 'uuid', description: 'Required for retail orders; for active packages this must match targetQualificationId.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MemberCreateOrderDto.prototype, "qualificationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, format: 'uuid', description: 'Published package version. When supplied, items are rejected and immutable package snapshots are created.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MemberCreateOrderDto.prototype, "packageVersionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, format: 'uuid' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MemberCreateOrderDto.prototype, "targetQualificationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, format: 'uuid', description: 'Optional represented formal LegalEntity purchasing/operating context. Backend verifies current primary representative authority.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MemberCreateOrderDto.prototype, "legalEntityId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, type: [create_order_dto_1.CreateOrderItemDto], description: 'Retail product IDs and quantities. Mutually exclusive with packageVersionId.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => create_order_dto_1.CreateOrderItemDto),
    __metadata("design:type", Array)
], MemberCreateOrderDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, type: [MemberPackageSelectionDto], description: 'Exact package selection by versioned product rule profile.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(0),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MemberPackageSelectionDto),
    __metadata("design:type", Array)
], MemberCreateOrderDto.prototype, "selections", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ pattern: '^[A-Z][A-Z0-9_-]{1,39}$', description: 'Untrusted Sponsor Ball or governed Company Alias candidate. Accepted only for a qualification package; server resolves it again and records evidence. It never creates a relationship for retail orders.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[A-Z][A-Z0-9_-]{1,39}$/),
    __metadata("design:type", String)
], MemberCreateOrderDto.prototype, "sponsorCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ pattern: '^[A-Z][A-Z0-9_-]{0,39}(?:X\\d{6,}|\\d{6,})$', description: 'Optional WEB_MEMBER retail referral Ball candidate. Validation is non-binding; the server revalidates it only when the first attributed retail order is committed.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6,}|\d{6,})$/),
    __metadata("design:type", String)
], MemberCreateOrderDto.prototype, "retailReferralCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ pattern: '^[A-Z][A-Z0-9_-]{1,39}$', description: 'Optional governed Commercial Offering code. Server resolves one effective version for the requested channel and stores its immutable line snapshot.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[A-Z][A-Z0-9_-]{1,39}$/),
    __metadata("design:type", String)
], MemberCreateOrderDto.prototype, "commercialOfferingCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ pattern: '^[A-Z][A-Z0-9_]{1,39}$', description: 'Optional line purpose. This describes purchase context and never changes Offering category.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[A-Z][A-Z0-9_]{1,39}$/),
    __metadata("design:type", String)
], MemberCreateOrderDto.prototype, "linePurpose", void 0);
class FormalKycUploadDto {
    documentType;
    mimeType;
    contentBase64;
}
exports.FormalKycUploadDto = FormalKycUploadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['IDENTITY_FRONT', 'IDENTITY_BACK', 'BANKBOOK_COVER', 'SIGNED_APPLICATION_AGREEMENT'] }),
    (0, class_validator_1.IsIn)(['IDENTITY_FRONT', 'IDENTITY_BACK', 'BANKBOOK_COVER', 'SIGNED_APPLICATION_AGREEMENT']),
    __metadata("design:type", String)
], FormalKycUploadDto.prototype, "documentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['image/jpeg', 'image/png'] }),
    (0, class_validator_1.IsIn)(['image/jpeg', 'image/png']),
    __metadata("design:type", String)
], FormalKycUploadDto.prototype, "mimeType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Base64-encoded image bytes. Temporary server-mediated upload path; private Blob storage remains authoritative.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], FormalKycUploadDto.prototype, "contentBase64", void 0);
class MemberContractConsentDto {
    accepted;
    channel;
}
exports.MemberContractConsentDto = MemberContractConsentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: [true], description: 'Explicit acceptance is required; false is never recorded as consent.' }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.Equals)(true),
    __metadata("design:type", Boolean)
], MemberContractConsentDto.prototype, "accepted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['MEMBER_WEB', 'LIFF'] }),
    (0, class_validator_1.IsIn)(['MEMBER_WEB', 'LIFF']),
    __metadata("design:type", String)
], MemberContractConsentDto.prototype, "channel", void 0);
class DeliveryProfileDto {
    recipientName;
    phone;
    countryCode;
    postalCode;
    region;
    city;
    address;
}
exports.DeliveryProfileDto = DeliveryProfileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 80 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], DeliveryProfileDto.prototype, "recipientName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 32 }),
    (0, class_validator_1.Matches)(/^(?=.*[0-9])\+?[0-9 ()-]{6,32}$/),
    __metadata("design:type", String)
], DeliveryProfileDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'TW' }),
    (0, class_validator_1.Matches)(/^[A-Z]{2}$/),
    __metadata("design:type", String)
], DeliveryProfileDto.prototype, "countryCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, maxLength: 16 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(16),
    __metadata("design:type", String)
], DeliveryProfileDto.prototype, "postalCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 80 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], DeliveryProfileDto.prototype, "region", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 80 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], DeliveryProfileDto.prototype, "city", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 300 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MinLength)(5),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], DeliveryProfileDto.prototype, "address", void 0);
class FormalMemberDraftDto {
    sponsorBallNo;
    formalContractVersionId;
    applicantType = 'INDIVIDUAL';
    legalName;
    gender;
    birthDate;
    nationalityCode;
    identityDocumentType;
    identityDocumentNumber;
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
exports.FormalMemberDraftDto = FormalMemberDraftDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '推薦球號，正式送出前必填' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(48),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "sponsorBallNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "formalContractVersionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['INDIVIDUAL'], description: 'Applicant type; omitted input defaults to INDIVIDUAL.' }),
    (0, class_validator_1.IsIn)(['INDIVIDUAL']),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "applicantType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "legalName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 32 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "gender", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "birthDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'TW', description: 'ISO-style nationality code' }),
    (0, class_validator_1.Matches)(/^[A-Z]{2}$/),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "nationalityCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['NATIONAL_ID', 'RESIDENCE_PERMIT', 'PASSPORT', 'OTHER'] }),
    (0, class_validator_1.IsIn)(['NATIONAL_ID', 'RESIDENCE_PERMIT', 'PASSPORT', 'OTHER']),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "identityDocumentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 64, description: '身分證號、居留證號、護照號碼或其他核准身分證明號碼' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "identityDocumentNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '是否有配偶，請明確傳入 true 或 false' }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FormalMemberDraftDto.prototype, "hasSpouse", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, maxLength: 120 }),
    (0, class_validator_1.ValidateIf)(o => o.hasSpouse === true),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "spouseName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: 'TW' }),
    (0, class_validator_1.ValidateIf)(o => o.hasSpouse === true),
    (0, class_validator_1.Matches)(/^[A-Z]{2}$/),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "spouseNationalityCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, enum: ['NATIONAL_ID', 'RESIDENCE_PERMIT', 'PASSPORT', 'OTHER'] }),
    (0, class_validator_1.ValidateIf)(o => o.hasSpouse === true),
    (0, class_validator_1.IsIn)(['NATIONAL_ID', 'RESIDENCE_PERMIT', 'PASSPORT', 'OTHER']),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "spouseIdentityDocumentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, maxLength: 64 }),
    (0, class_validator_1.ValidateIf)(o => o.hasSpouse === true),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "spouseIdentityDocumentNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 500 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "communicationAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 32 }),
    (0, class_validator_1.Matches)(/^(?=.*[0-9])\+?[0-9 ()-]{6,32}$/),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'email', maxLength: 254 }),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 16 }),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9-]{2,16}$/),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "bankCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 34 }),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9 -]{4,34}$/),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "bankAccount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/\S/),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], FormalMemberDraftDto.prototype, "accountHolder", void 0);
class MemberQueryDto extends MemberContextDto {
    period;
    settlementBatchId;
}
exports.MemberQueryDto = MemberQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: 'Posted-event month filter using versioned accounting timezone; not an operational settlement cut-off' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-(0[1-9]|1[0-2])$/),
    __metadata("design:type", String)
], MemberQueryDto.prototype, "period", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, format: 'uuid', description: 'Immutable finalized BINARY_K1 settlement scope. Required before historical volume/carry can be disclosed; omission keeps those values unavailable.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MemberQueryDto.prototype, "settlementBatchId", void 0);
class MemberTreeQueryDto {
    ballNo;
    parentBallNo;
    timezone;
    asOf;
    periodStart;
    periodEnd;
    knowledgeCutoff;
    after;
    snapshotToken;
}
exports.MemberTreeQueryDto = MemberTreeQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Selected owned Ball number. UUIDs are not part of the member topology contract.' }),
    (0, class_validator_1.Matches)(/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6,}|\d{6,})$/),
    __metadata("design:type", String)
], MemberTreeQueryDto.prototype, "ballNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Expand one visible Ball only. Omit to expand the selected Ball.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6,}|\d{6,})$/),
    __metadata("design:type", String)
], MemberTreeQueryDto.prototype, "parentBallNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['Asia/Taipei'] }),
    (0, class_validator_1.IsIn)(['Asia/Taipei']),
    __metadata("design:type", String)
], MemberTreeQueryDto.prototype, "timezone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MemberTreeQueryDto.prototype, "asOf", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MemberTreeQueryDto.prototype, "periodStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MemberTreeQueryDto.prototype, "periodEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MemberTreeQueryDto.prototype, "knowledgeCutoff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Opaque cursor from this exact snapshot.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MemberTreeQueryDto.prototype, "after", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Snapshot token returned by page one; required with after.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MemberTreeQueryDto.prototype, "snapshotToken", void 0);
let MemberAuthController = class MemberAuthController {
    service;
    constructor(service) {
        this.service = service;
    }
    exchange(body) { return this.service.exchange(body.idToken); }
};
exports.MemberAuthController = MemberAuthController;
__decorate([
    (0, common_1.Post)('line/exchange'),
    (0, swagger_1.ApiResponse)({ status: 201, schema: views.memberEnvelope(views.LineSessionView) }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberLineExchange' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid/expired token, unbound identity or disabled Person' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'LINE_TOKEN_REPLAYED' }),
    (0, swagger_1.ApiResponse)({ status: 503, description: 'LINE configuration/provider unavailable; fail closed' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LineExchangeDto]),
    __metadata("design:returntype", void 0)
], MemberAuthController.prototype, "exchange", null);
exports.MemberAuthController = MemberAuthController = __decorate([
    (0, swagger_1.ApiExtraModels)(...views.memberViewModels),
    (0, swagger_1.ApiTags)('Member - Authentication'),
    (0, common_1.Controller)('auth/member'),
    __metadata("design:paramtypes", [member_service_1.MemberService])
], MemberAuthController);
let MemberController = class MemberController {
    service;
    reads;
    trees;
    orderService;
    shareLinks;
    contracts;
    delivery;
    formalApplications;
    growth;
    formalKyc;
    constructor(service, reads, trees, orderService, shareLinks, contracts, delivery, formalApplications, growth, formalKyc) {
        this.service = service;
        this.reads = reads;
        this.trees = trees;
        this.orderService = orderService;
        this.shareLinks = shareLinks;
        this.contracts = contracts;
        this.delivery = delivery;
        this.formalApplications = formalApplications;
        this.growth = growth;
        this.formalKyc = formalKyc;
    }
    myGrowth(req, _query) { return this.growth.read(req.user.personId); }
    me(req) { return this.service.me(req.user.personId); }
    requiredContracts(req) { return this.contracts.required(req.user.personId); }
    formalRequiredContracts(req) { return this.contracts.formalRequired(req.user.personId); }
    consentContract(req, versionId, body, key) { return this.contracts.consent(req.user.personId, versionId, body, key, req.requestId); }
    logout(req, key, _body) { return this.service.logout(req.user.personId, req.user.sessionId, key, req.requestId); }
    profile(req, body, key) { if (!Object.values(body).some(v => typeof v === 'string' && v.trim()))
        throw new common_1.UnprocessableEntityException({ code: 'PROFILE_FIELDS_REQUIRED' }); return this.service.profile(req.user.personId, body, req.requestId, key); }
    deliveryProfile(req) { return this.delivery.get(req.user.personId); }
    updateDeliveryProfile(req, body, key) { return this.delivery.update(req.user.personId, body, key, req.requestId); }
    formalDocuments(req, id) { return this.formalKyc.listOwn(req.user.personId, id); }
    uploadFormalDocument(req, id, body) { return this.formalKyc.upload(req.user.personId, id, body.documentType, body.mimeType, body.contentBase64, req.requestId, false, body.expectedSnapshotHash); }
    currentFormalApplication(req) { return this.formalApplications.current(req.user.personId); }
    saveFormalApplication(req, body, key) { return this.formalApplications.save(req.user.personId, body, key, req.requestId); }
    notifications(req, q) { return this.service.notifications(req.user.personId, q.qualificationId); }
    markRead(req, body, id, key) { return this.service.markNotificationRead(req.user.personId, body.qualificationId, id, key, req.requestId); }
    representedLegalEntities(req) { return this.service.representedLegalEntities(req.user.personId); }
    qualifications(req) { return this.service.qualifications(req.user.personId); }
    context(req, body) { return this.service.context(req.user.personId, body.qualificationId); }
    dashboard(req, q) { return this.reads.read(req.user.personId, q.qualificationId, 'dashboard', q.period); }
    sponsor(req, q) { return this.reads.read(req.user.personId, q.qualificationId, 'sponsor', q.period); }
    binary(req, q) { return this.reads.read(req.user.personId, q.qualificationId, 'binary', q.period, q.settlementBatchId); }
    tree(req, q) { return this.trees.children(req.user.personId, q); }
    referrals(req, q) { return this.reads.read(req.user.personId, q.qualificationId, 'referrals', q.period); }
    createShareLink(req, body) { return this.shareLinks.create(req.user.personId, body.qualificationId); }
    performance(req, q) { return this.reads.read(req.user.personId, q.qualificationId, 'performance', q.period); }
    bonuses(req, q) { return this.reads.read(req.user.personId, q.qualificationId, 'bonuses', q.period); }
    ledger(req, q) { return this.reads.read(req.user.personId, q.qualificationId, 'ledger', q.period); }
    repurchase(req, q) { return this.reads.read(req.user.personId, q.qualificationId, 'repurchase', q.period); }
    products() { return this.reads.products(); }
    myOrders(req) { return this.reads.myOrders(req.user.personId); }
    retailOrders(req) { return this.orderService.listWebRetailMember(req.user.personId); }
    orders(req, q) { return this.reads.read(req.user.personId, q.qualificationId, 'orders', q.period); }
    async createOrder(req, body, key) { const result = await this.orderService.createMember(body, key, req.requestId, req.user.personId), order = result.value; return { qualificationId: order.qualificationId, id: order.orderId, orderNo: order.orderNo.toString(), status: order.status, total: order.netAmount.toString(), paymentStatus: 'PENDING', shipmentStatus: 'FULFILLMENT_PENDING', createdAt: new Date(order.createdAt).toISOString(), replayed: result.replayed, lines: order.lines.map((line) => ({ productId: line.productId, name: line.productNameSnapshot, quantity: line.quantity.toString(), unitPrice: line.unitPrice.toString(), amount: line.lineAmount.toString(), pv: null })) }; }
    order(req, q, id) { return this.reads.order(req.user.personId, q.qualificationId, id); }
};
exports.MemberController = MemberController;
__decorate([
    (0, common_1.Get)('my-growth'),
    (0, swagger_1.ApiExtraModels)(...member_growth_dto_1.memberGrowthModels),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(member_growth_dto_1.MemberGrowthView) }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberMyGrowth', description: 'Server-authoritative, member-safe multi-dimensional growth view. It does not infer rank, qualification, or economics in the browser.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberGrowthQueryDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "myGrowth", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.PersonView) }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberMe' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('contracts/required'),
    (0, swagger_1.ApiOperation)({ operationId: 'memberRequiredContracts', description: 'Return currently effective required Network Member contract versions and immutable consent status.' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "requiredContracts", null);
__decorate([
    (0, common_1.Get)('contracts/formal-required'),
    (0, swagger_1.ApiOperation)({ operationId: 'memberFormalRequiredContracts', description: 'Effective Formal Member contracts and own immutable consent status.' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "formalRequiredContracts", null);
__decorate([
    (0, common_1.Post)('contracts/:versionId/consent'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberConsentContract', description: 'Append immutable consent evidence bound to the displayed content hash. Duplicate delivery is idempotent.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('versionId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, MemberContractConsentDto, String]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "consentContract", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiResponse)({ status: 201, schema: views.memberEnvelope(views.LogoutView) }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberLogout', description: 'Revoke only the authenticated UCell Member session, regardless of Member auth provider, with transactional audit. Provider sign-out is separate. Repeated delivery after revocation returns 401; other sessions are unaffected.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, MemberLogoutDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "logout", null);
__decorate([
    (0, common_1.Patch)('profile'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.PersonView) }),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberUpdateProfile', description: 'Own display/contact fields only. No legal identity, status, qualification or monetary mutation. Audited idempotent transaction.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberProfileDto, String]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "profile", null);
__decorate([
    (0, common_1.Get)('delivery-profile'),
    (0, swagger_1.ApiOperation)({ operationId: 'memberDeliveryProfile', description: 'Reads only the authenticated Person current encrypted delivery profile. No Qualification context required.' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "deliveryProfile", null);
__decorate([
    (0, common_1.Patch)('delivery-profile'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberUpdateDeliveryProfile', description: 'Creates a new encrypted delivery-profile version and closes the prior version. Audit/outbox contain no address or phone.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, DeliveryProfileDto, String]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "updateDeliveryProfile", null);
__decorate([
    (0, common_1.Get)('formal-applications/:id/documents'),
    (0, swagger_1.ApiOperation)({ operationId: 'memberFormalApplicationDocuments', description: 'List only the authenticated Person formal-application KYC document metadata; no private object URLs are returned.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "formalDocuments", null);
__decorate([
    (0, common_1.Post)('formal-applications/:id/documents'),
    (0, swagger_1.ApiOperation)({ operationId: 'memberUploadFormalApplicationDocument', description: 'Upload required natural-person formal KYC image into private storage. Application must remain editable; malware scan starts PENDING.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, FormalKycUploadDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "uploadFormalDocument", null);
__decorate([
    (0, common_1.Get)('formal-applications/current'),
    (0, swagger_1.ApiOperation)({ operationId: 'memberCurrentFormalApplication', description: 'Own current Formal Member application with masked national ID and bank account.' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "currentFormalApplication", null);
__decorate([
    (0, common_1.Post)('formal-applications'),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberSaveFormalApplicationDraft', description: 'Encrypt and append a Formal Member application draft snapshot. Does not submit, approve, create Qualification, or change membership state.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, FormalMemberDraftDto, String]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "saveFormalApplication", null);
__decorate([
    (0, common_1.Get)('notifications'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.NoticesView) }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberNotifications', description: 'Person-addressed notices plus selected owned Qualification notices, newest first, bounded 100. No LINE push or server read-state mutation.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberContextDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "notifications", null);
__decorate([
    (0, common_1.Patch)('notifications/:id/read'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.NoticeReadView) }),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberReadNotification', description: 'Append first Person read evidence; retry and repeated reads preserve original readAt. Owned Qualification audience required. No LINE push.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberContextDto, String, String]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "markRead", null);
__decorate([
    (0, common_1.Get)('represented-legal-entities'),
    (0, swagger_1.ApiOperation)({ operationId: 'memberRepresentedLegalEntities', description: 'List active formal legal entities for which the authenticated Person is the current primary operating representative. The Person is an authorized operator, not the Qualification owner.' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "representedLegalEntities", null);
__decorate([
    (0, common_1.Get)('qualifications'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.QualificationView, true) }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberQualifications', description: 'Owned temporal holder evidence only; empty array for Person without Qualification. Ordered by immutable qualification number.' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "qualifications", null);
__decorate([
    (0, common_1.Post)('context/qualification'),
    (0, swagger_1.ApiResponse)({ status: 201, schema: views.memberEnvelope(views.ContextView) }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberQualificationContext', description: 'Validate selected ball; all scoped reads must repeat server ownership authorization. No monetary mutation.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberContextDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "context", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.DashboardView) }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberQueryDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('organization/sponsor'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.SponsorView) }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberQueryDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "sponsor", null);
__decorate([
    (0, common_1.Get)('organization/binary'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.BinaryView) }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberBinaryOrganization', description: 'Current placement counts remain separate from immutable settlement metrics. Historical left/right GPV and carry are returned only for an explicitly selected finalized BINARY_K1 settlementBatchId and its sealed historical snapshot.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberQueryDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "binary", null);
__decorate([
    (0, common_1.Get)('organization/tree'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.MemberTreePageView) }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberReadBinaryTreeChildren', description: 'Server-side, bounded and snapshot-consistent binary-tree expansion. Bootstrap Company Balls #1–#3 and all Company/reservoir fields are excluded before serialization.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberTreeQueryDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "tree", null);
__decorate([
    (0, common_1.Get)('referrals'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.SponsorView) }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberQueryDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "referrals", null);
__decorate([
    (0, common_1.Post)('share-links'),
    (0, swagger_1.ApiOperation)({ operationId: 'memberCreateShareLink', description: 'Create an encrypted referral URL bound to the selected owned Qualification. Server configuration supplies base URL, key and TTL; missing configuration fails closed.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberContextDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "createShareLink", null);
__decorate([
    (0, common_1.Get)('performance'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.PerformanceView) }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberQueryDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "performance", null);
__decorate([
    (0, common_1.Get)('bonuses'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.BonusesView) }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberQueryDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "bonuses", null);
__decorate([
    (0, common_1.Get)('bonuses/ledger'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.LedgerView) }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberQueryDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "ledger", null);
__decorate([
    (0, common_1.Get)('repurchase/status'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.RepurchaseView) }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberQueryDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "repurchase", null);
__decorate([
    (0, common_1.Get)('products'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.ProductView, true) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "products", null);
__decorate([
    (0, common_1.Get)('retail-orders'),
    (0, swagger_1.ApiOperation)({ operationId: 'memberWebRetailOrders', description: 'Returns only the authenticated WEB_MEMBER retail-order history, using business order numbers and excluding Qualification, recipient, referrer, payout, and UUID fields.' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "retailOrders", null);
__decorate([
    (0, common_1.Get)('orders'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.OrdersView) }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberQueryDto]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "orders", null);
__decorate([
    (0, common_1.Post)('orders'),
    (0, swagger_1.ApiResponse)({ status: 201, schema: views.memberEnvelope(views.OrderView) }),
    (0, common_1.UseGuards)(idempotency_guard_1.IdempotencyGuard),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: true }),
    (0, swagger_1.ApiOperation)({ operationId: 'memberCreateOrder', description: 'Core-authoritative RETAIL order, pending payment/fulfillment; no PV/BV recognition. Missing/overlapping product profile fails closed 422. Retry conflicts with identical key/body. Reject client monetary results.' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberCreateOrderDto, String]),
    __metadata("design:returntype", Promise)
], MemberController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Get)('orders/:id'),
    (0, swagger_1.ApiResponse)({ status: 200, schema: views.memberEnvelope(views.OrderView) }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberQueryDto, String]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "order", null);
exports.MemberController = MemberController = __decorate([
    (0, swagger_1.ApiExtraModels)(...views.memberViewModels),
    (0, swagger_1.ApiTags)('Member'),
    (0, swagger_1.ApiBearerAuth)('memberBearer'),
    (0, common_1.UseGuards)(member_authentication_guard_1.MemberAuthenticationGuard, member_context_guard_1.MemberContextGuard),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Validation failure; unknown identity/qualification/monetary fields rejected' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Member LINE session required, expired/disabled sessions denied' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Qualification not owned' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Resource unavailable' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Conflicting operation' }),
    (0, swagger_1.ApiResponse)({ status: 422, description: 'Invalid input or pending domain decision' }),
    (0, common_1.Controller)('member'),
    __metadata("design:paramtypes", [member_service_1.MemberService, member_read_service_1.MemberReadService, member_tree_read_service_1.MemberTreeReadService, order_service_1.OrderService, member_share_link_service_1.MemberShareLinkService, member_contract_service_1.MemberContractService, delivery_profile_service_1.DeliveryProfileService, formal_member_application_service_1.FormalMemberApplicationService, member_growth_service_1.MemberGrowthService, formal_kyc_document_service_1.FormalKycDocumentService])
], MemberController);

__decorate([
    (0, common_1.Get)('my-orders'),
    (0, swagger_1.ApiOperation)({ operationId: 'memberOwnOrderHistory', description: 'Own purchases and currently authorized qualification orders, including payment and recorded ERP/logistics shipment facts. No recipient or internal provider credentials.' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MemberController.prototype, "myOrders", null);

__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[a-f0-9]{64}$/),
    __metadata("design:type", String)
], FormalKycUploadDto.prototype, "expectedSnapshotHash", void 0);