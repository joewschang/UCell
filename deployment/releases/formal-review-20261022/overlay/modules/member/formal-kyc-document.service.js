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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormalKycDocumentService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@ucell/database");
const node_crypto_1 = require("node:crypto");
const audit_service_1 = require("../../common/audit/audit.service");
const formal_kyc_storage_service_1 = require("./formal-kyc-storage.service");
const pii_crypto_service_1 = require("../../common/security/pii-crypto.service");
const kyc_image_validation_1 = require("./kyc-image-validation");
const REQUIRED_WEB = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'BANKBOOK_COVER'];
const WEB_TYPES = [...REQUIRED_WEB, 'SIGNED_APPLICATION_AGREEMENT'];
function validDocument(bytes, mime) { return mime === 'application/pdf' ? bytes.subarray(0, 1024).toString('latin1').startsWith('%PDF-') && bytes.subarray(-1024).toString('latin1').includes('%%EOF') : (0, kyc_image_validation_1.validKycImage)(bytes, mime); }
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png']);
const MAX_BYTES = 10 * 1024 * 1024;
let FormalKycDocumentService = class FormalKycDocumentService {
    db;
    storage;
    audit;
    constructor(db, storage, audit) {
        this.db = db;
        this.storage = storage;
        this.audit = audit;
    }
    async listOwn(personId, applicationId) {
        const app = await this.db.formalMemberApplication.findFirst({ where: { formalMemberApplicationId: applicationId, personId } });
        if (!app)
            throw new common_1.NotFoundException({ code: 'FORMAL_APPLICATION_NOT_FOUND' });
        const rows = await this.db.formalApplicationDocument.findMany({ where: { formalMemberApplicationId: applicationId, status: { not: 'SUPERSEDED' } }, orderBy: { createdAt: 'desc' } });
        const snapshot = await this.db.formalMemberApplicationSnapshot.findFirst({ where: { formalMemberApplicationId: applicationId }, orderBy: { version: 'desc' } });
        const payload = snapshot ? new pii_crypto_service_1.PiiCryptoService().decrypt(snapshot.payloadCiphertext, snapshot.keyVersion) : null;
        const contract = payload?.formalContractVersionId ? await this.db.contractDocumentVersion.findUnique({ where: { contractDocumentVersionId: payload.formalContractVersionId }, select: { title: true, versionCode: true, contentHash: true } }) : null;
        return { applicationId, signingContext: contract ? { name: payload.legalName ?? '', contract: { title: contract.title, version: contract.versionCode, contentHash: contract.contentHash } } : null, required: app.sourceChannel === 'MEMBER_WEB' && app.applicantType === 'INDIVIDUAL' ? [...WEB_TYPES] : [], documents: rows.map(r => ({ id: r.formalApplicationDocumentId, type: r.documentType, status: r.status, scanRequired: false, scanStatus: r.malwareScanStatus, mimeType: r.mimeType, sizeBytes: r.sizeBytes, uploadedAt: r.uploadedAt?.toISOString() ?? null })) };
    }
    async upload(personId, applicationId, type, mimeType, contentBase64, requestId, admin = false) {
        if (admin && !personId)
            throw new common_1.ForbiddenException({ code: 'ADMIN_PERSON_ID_REQUIRED' });
        if (admin ? type !== 'SIGNED_APPLICATION_AGREEMENT' : !WEB_TYPES.includes(type))
            throw new common_1.UnprocessableEntityException({ code: 'FORMAL_KYC_DOCUMENT_TYPE_NOT_ALLOWED' });
        if (!ALLOWED_MIME.has(mimeType) && !(admin && mimeType === 'application/pdf'))
            throw new common_1.BadRequestException({ code: 'FORMAL_KYC_DOCUMENT_MIME_NOT_ALLOWED' });
        if (typeof contentBase64 !== 'string' || contentBase64.length > 4 * Math.ceil(MAX_BYTES / 3))
            throw new common_1.BadRequestException({ code: 'FORMAL_KYC_DOCUMENT_SIZE_INVALID' });
        if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64))
            throw new common_1.BadRequestException({ code: 'FORMAL_KYC_DOCUMENT_ENCODING_INVALID' });
        const bytes = Buffer.from(contentBase64, 'base64');
        if (bytes.toString('base64') !== contentBase64)
            throw new common_1.BadRequestException({ code: 'FORMAL_KYC_DOCUMENT_ENCODING_INVALID' });
        if (!bytes.length || bytes.length > MAX_BYTES)
            throw new common_1.BadRequestException({ code: 'FORMAL_KYC_DOCUMENT_SIZE_INVALID' });
        if (!validDocument(bytes, mimeType))
            throw new common_1.BadRequestException({ code: 'FORMAL_KYC_DOCUMENT_CONTENT_INVALID' });
        const app = await this.db.formalMemberApplication.findFirst({ where: { formalMemberApplicationId: applicationId, ...(admin ? {} : { personId }) } });
        if (!app)
            throw new common_1.NotFoundException({ code: 'FORMAL_APPLICATION_NOT_FOUND' });
        if (admin ? app.sourceChannel !== 'ADMIN_PAPER' : app.sourceChannel !== 'MEMBER_WEB' || app.applicantType !== 'INDIVIDUAL')
            throw new common_1.ForbiddenException({ code: 'FORMAL_KYC_WEB_UPLOAD_NOT_ALLOWED' });
        if (!(admin ? ['DRAFT', 'SUBMITTED', 'NEEDS_MORE_INFO', 'UNDER_REVIEW'] : ['DRAFT', 'NEEDS_MORE_INFO']).includes(app.status))
            throw new common_1.ForbiddenException({ code: 'FORMAL_APPLICATION_LOCKED' });
        const objectKey = 'formal/' + applicationId + '/' + type + '/' + (0, node_crypto_1.randomUUID)();
        const sha = (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex');
        await this.storage.put(objectKey, bytes, mimeType);
        const now = new Date();
        let row;
        try {
            row = await this.db.$transaction(async (tx) => {
                const current = await tx.formalMemberApplication.findFirst({ where: { formalMemberApplicationId: applicationId, ...(admin ? {} : { personId }) } });
                if (!current || !(admin ? ['DRAFT', 'SUBMITTED', 'NEEDS_MORE_INFO', 'UNDER_REVIEW'] : ['DRAFT', 'NEEDS_MORE_INFO']).includes(current.status))
                    throw new common_1.ForbiddenException({ code: 'FORMAL_APPLICATION_LOCKED' });
                await tx.formalApplicationDocument.updateMany({ where: { formalMemberApplicationId: applicationId, documentType: type, status: 'PRESENT' }, data: { status: 'SUPERSEDED' } });
                const created = await tx.formalApplicationDocument.create({ data: { formalMemberApplicationId: applicationId, documentType: type, status: 'PRESENT', storageObjectKey: objectKey, contentSha256: sha, mimeType, sizeBytes: bytes.length, malwareScanStatus: 'PENDING', uploadedByPersonId: personId, uploadedAt: now } });
                await this.audit.write(tx, { actorType: admin ? 'ADMIN' : 'MEMBER', actorId: personId, action: 'FORMAL_KYC_DOCUMENT_UPLOADED', entityType: 'FormalApplicationDocument', entityId: created.formalApplicationDocumentId, afterData: { applicationId, documentType: type, mimeType, sizeBytes: bytes.length, contentSha256: sha, applicationSnapshotHash: current.currentSnapshotHash, source: admin ? 'PAPER_SCAN' : 'MEMBER_WEB' }, requestId, correlationId: (0, node_crypto_1.randomUUID)() });
                return created;
            }, { isolationLevel: database_1.Prisma.TransactionIsolationLevel.Serializable });
        }
        catch (error) {
            if (error.code === 'P2034')
                throw new common_1.ConflictException({ code: 'RETRYABLE_CONFLICT' });
            throw error;
        }
        return { id: row.formalApplicationDocumentId, type: row.documentType, status: row.status, scanStatus: row.malwareScanStatus, mimeType: row.mimeType, sizeBytes: row.sizeBytes, uploadedAt: row.uploadedAt?.toISOString() ?? null };
    }
    async adminList(applicationId) {
        const app = await this.db.formalMemberApplication.findUnique({ where: { formalMemberApplicationId: applicationId } });
        if (!app)
            throw new common_1.NotFoundException({ code: 'FORMAL_APPLICATION_NOT_FOUND' });
        const rows = await this.db.formalApplicationDocument.findMany({ where: { formalMemberApplicationId: applicationId }, orderBy: { createdAt: 'desc' } });
        return rows.map(r => ({ id: r.formalApplicationDocumentId, type: r.documentType, status: r.status, scanRequired: false, scanStatus: r.malwareScanStatus, mimeType: r.mimeType, sizeBytes: r.sizeBytes, uploadedAt: r.uploadedAt?.toISOString() ?? null, reviewedAt: r.reviewedAt?.toISOString() ?? null }));
    }
    async adminContent(documentId, actorId, requestId) {
        if (!actorId)
            throw new common_1.ForbiddenException({ code: 'ADMIN_PERSON_ID_REQUIRED' });
        const stored = await this.db.formalApplicationDocument.findUnique({ where: { formalApplicationDocumentId: documentId } });
        const row = stored;
        if (!row || !row.storageObjectKey || row.status === 'SUPERSEDED')
            throw new common_1.NotFoundException({ code: 'FORMAL_KYC_DOCUMENT_NOT_FOUND' });
        if (row.status !== 'PRESENT')
            throw new common_1.UnprocessableEntityException({ code: 'FORMAL_KYC_DOCUMENT_REJECTED' });
        const blob = await this.storage.get(row.storageObjectKey);
        if (!row.mimeType || blob.bytes.length !== row.sizeBytes || (0, node_crypto_1.createHash)('sha256').update(blob.bytes).digest('hex') !== row.contentSha256 || !validDocument(blob.bytes, row.mimeType))
            throw new common_1.UnprocessableEntityException({ code: 'FORMAL_KYC_DOCUMENT_INTEGRITY_FAILED' });
        await this.db.$transaction(tx => this.audit.write(tx, { actorType: 'ADMIN', actorId, action: 'FORMAL_KYC_DOCUMENT_VIEWED', entityType: 'FormalApplicationDocument', entityId: documentId, afterData: { applicationId: row.formalMemberApplicationId, documentType: row.documentType }, requestId, correlationId: (0, node_crypto_1.randomUUID)() }));
        return { bytes: blob.bytes, mimeType: row.mimeType };
    }
    async recordScan(documentId, status, actorId, requestId) {
        if (!actorId)
            throw new common_1.ForbiddenException({ code: 'ADMIN_PERSON_ID_REQUIRED' });
        const row = await this.db.formalApplicationDocument.findUnique({ where: { formalApplicationDocumentId: documentId } });
        if (!row || row.status !== 'PRESENT')
            throw new common_1.NotFoundException({ code: 'FORMAL_KYC_DOCUMENT_NOT_FOUND' });
        const updated = await this.db.formalApplicationDocument.update({ where: { formalApplicationDocumentId: documentId }, data: { malwareScanStatus: status, status: status === 'INFECTED' ? 'REJECTED' : 'PRESENT', reviewedBy: actorId, reviewedAt: new Date() } });
        await this.db.$transaction(tx => this.audit.write(tx, { actorType: 'ADMIN', actorId, action: 'FORMAL_KYC_DOCUMENT_SCAN_RECORDED', entityType: 'FormalApplicationDocument', entityId: documentId, afterData: { scanStatus: status }, requestId, correlationId: (0, node_crypto_1.randomUUID)() }));
        return { id: updated.formalApplicationDocumentId, status: updated.status, scanStatus: updated.malwareScanStatus };
    }
};
exports.FormalKycDocumentService = FormalKycDocumentService;
exports.FormalKycDocumentService = FormalKycDocumentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_1.PrismaService, formal_kyc_storage_service_1.FormalKycStorageService, audit_service_1.AuditService])
], FormalKycDocumentService);
//# sourceMappingURL=formal-kyc-document.service.js.map