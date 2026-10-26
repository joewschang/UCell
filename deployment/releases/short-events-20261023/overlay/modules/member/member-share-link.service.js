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
exports.MemberShareLinkService = void 0;
const share_target_1 = require("../content/share-target");
const content_visibility_1 = require("../content/content-visibility");
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const database_1 = require("@ucell/database");
const qualification_access_service_1 = require("../auth/qualification-access.service");
let MemberShareLinkService = class MemberShareLinkService {
    access;
    db;
    constructor(access, db) {
        this.access = access;
        this.db = db;
    }
    configuration() {
        const secret = process.env.MEMBER_SHARE_TOKEN_SECRET;
        const base = process.env.MEMBER_REFERRAL_BASE_URL;
        const ttl = Number(process.env.MEMBER_SHARE_TOKEN_TTL_SECONDS);
        if (!secret || secret.length < 32 || !base || !Number.isSafeInteger(ttl) || ttl <= 0)
            throw new common_1.ServiceUnavailableException({ code: 'MEMBER_SHARE_CONFIGURATION_PENDING' });
        let url;
        try {
            url = new URL(base);
        }
        catch {
            throw new common_1.ServiceUnavailableException({ code: 'MEMBER_SHARE_CONFIGURATION_INVALID' });
        }
        if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
            throw new common_1.ServiceUnavailableException({ code: 'MEMBER_SHARE_CONFIGURATION_INVALID' });
        return { key: (0, crypto_1.createHash)('sha256').update(secret).digest(), url, ttl };
    }
    async create(personId, qualificationId, now = new Date(), contentId, target = {}) {
        await this.access.assertHolder(personId, qualificationId, now);
        if ([contentId, target.productSku, target.eventCode].filter(Boolean).length > 1)
            throw new common_1.UnprocessableEntityException({ code: 'SHARE_TARGET_AMBIGUOUS' });
        const resource = await (0, share_target_1.currentShareTarget)(this.db, target, now);
        if ((target.productSku || target.eventCode) && !resource)
            throw new common_1.UnprocessableEntityException({ code: 'SHARE_TARGET_UNAVAILABLE' });
        const content = contentId ? await (0, content_visibility_1.currentContent)(this.db, contentId, now) : null;
        if (contentId && (!content || !content.shareable || !['PUBLIC', 'NETWORK_MEMBER'].includes(content.audiencePolicy)))
            throw new common_1.UnprocessableEntityException({ code: 'CONTENT_NOT_SHAREABLE' });
        const { key, url, ttl } = this.configuration(), iv = (0, crypto_1.randomBytes)(12), expiresAt = new Date(now.getTime() + ttl * 1000);
        const payload = { version: 1, qualificationId, issuedAt: now.toISOString(), expiresAt: expiresAt.toISOString(), ...(resource ? target : {}), ...(content ? { contentId: content.id, contentVersionId: content.versionId } : {}) };
        const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', key, iv), encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]), tag = cipher.getAuthTag();
        const token = Buffer.concat([iv, tag, encrypted]).toString('base64url');
        const data = { tokenHash: this.hash(token), referrerQualificationId: qualificationId, policyVersion: 'NR-DEC-003-V1', createdAt: now, expiresAt };
        const shortCode = 's_' + (0, crypto_1.randomBytes)(16).toString('base64url');
        await this.db.$transaction(async (tx) => {
            const link = await tx.referralLink.create({ data });
            if (content)
                await tx.$executeRaw `INSERT INTO integration.content_share_link (referral_link_id,content_id,content_version_id) VALUES (${link.referralLinkId}::uuid,${content.id}::uuid,${content.versionId}::uuid)`;
            if (resource)
                await tx.$executeRaw `INSERT INTO integration.resource_share_link (referral_link_id,target_type,target_reference) VALUES (${link.referralLinkId}::uuid,${resource.kind},${resource.reference})`;
            await tx.$executeRaw `INSERT INTO integration.referral_short_link(short_code,referral_link_id,encrypted_token) VALUES (${shortCode},${link.referralLinkId}::uuid,${token})`;
        });
        return { qualificationId, shareUrl: new URL(`/r/${shortCode}`, url).toString(), expiresAt: expiresAt.toISOString() };
    }
    async resolveToken(token) {
        if (!token.startsWith('s_') || token.length !== 24)
            return token;
        const rows = await this.db.$queryRaw `SELECT encrypted_token FROM integration.referral_short_link WHERE short_code=${token}`;
        if (!rows[0])
            throw new common_1.NotFoundException({ code: 'SHARE_LINK_UNAVAILABLE' });
        return rows[0].encrypted_token;
    }
    async preview(token, now = new Date()) {
        token = await this.resolveToken(token);
        const payload = this.verify(token, now), link = await this.db.referralLink.findUnique({ where: { tokenHash: this.hash(token) } });
        if (!link || link.status !== 'ACTIVE' || link.expiresAt <= now || link.referrerQualificationId !== payload.qualificationId)
            throw new common_1.NotFoundException({ code: 'SHARE_LINK_UNAVAILABLE' });
        if (payload.productSku || payload.eventCode) {
            const resource = await (0, share_target_1.currentShareTarget)(this.db, payload, now);
            if (!resource)
                throw new common_1.NotFoundException({ code: 'SHARE_TARGET_UNAVAILABLE' });
            return { content: null, resource, requiresLogin: false, expiresAt: link.expiresAt.toISOString(), destination: resource.destination };
        }
        if (!payload.contentId)
            return { content: null, requiresLogin: false, expiresAt: link.expiresAt.toISOString(), destination: '/' };
        const row = await (0, content_visibility_1.currentContent)(this.db, payload.contentId, now);
        if (!row || !row.shareable || !['PUBLIC', 'NETWORK_MEMBER'].includes(row.audiencePolicy))
            throw new common_1.NotFoundException({ code: 'SHARE_CONTENT_UNAVAILABLE' });
        return { content: row.audiencePolicy === 'PUBLIC' ? row : null, requiresLogin: row.audiencePolicy !== 'PUBLIC', expiresAt: link.expiresAt.toISOString(), destination: '/content/' + row.id };
    }
    async revoke(personId, qualificationId, id) { await this.access.assertHolder(personId, qualificationId); const result = await this.db.referralLink.updateMany({ where: { referralLinkId: id, referrerQualificationId: qualificationId, status: 'ACTIVE' }, data: { status: 'REVOKED' } }); return { revoked: result.count > 0 }; }
    hash(token) { return (0, crypto_1.createHash)('sha256').update(token).digest('hex'); }
    createTransition(input) {
        const { key } = this.configuration(), iv = (0, crypto_1.randomBytes)(12), payload = { version: 1, kind: 'REFERRAL_TRANSITION', anonymousId: input.anonymousId, referralAttributionId: input.referralAttributionId, referrerQualificationId: input.referrerQualificationId, attributionVersion: input.attributionVersion, issuedAt: input.issuedAt.toISOString(), expiresAt: input.expiresAt.toISOString() };
        const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', key, iv), encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]), tag = cipher.getAuthTag();
        return Buffer.concat([iv, tag, encrypted]).toString('base64url');
    }
    verifyTransition(token, now = new Date()) {
        const { key } = this.configuration();
        try {
            if (!/^[A-Za-z0-9_-]{1,4096}$/.test(token))
                throw new Error('format');
            const bytes = Buffer.from(token, 'base64url');
            if (bytes.length < 29)
                throw new Error('short');
            const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', key, bytes.subarray(0, 12));
            decipher.setAuthTag(bytes.subarray(12, 28));
            const payload = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
            const issuedAt = new Date(payload.issuedAt), expiresAt = new Date(payload.expiresAt);
            if (payload.version !== 1 || payload.kind !== 'REFERRAL_TRANSITION' || !payload.anonymousId || !payload.referralAttributionId || !payload.referrerQualificationId || !Number.isSafeInteger(payload.attributionVersion) || payload.attributionVersion < 1 || !Number.isFinite(issuedAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || issuedAt > now || expiresAt <= issuedAt || expiresAt <= now)
                throw new Error('invalid');
            return payload;
        }
        catch {
            throw new common_1.ServiceUnavailableException({ code: 'REFERRAL_TRANSITION_INVALID' });
        }
    }
    verify(token, now = new Date()) {
        const { key } = this.configuration();
        try {
            if (!/^[A-Za-z0-9_-]{1,4096}$/.test(token))
                throw new Error('format');
            const bytes = Buffer.from(token, 'base64url');
            if (bytes.length < 29)
                throw new Error('short');
            const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', key, bytes.subarray(0, 12));
            decipher.setAuthTag(bytes.subarray(12, 28));
            const payload = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
            const issuedAt = new Date(payload.issuedAt), expiresAt = new Date(payload.expiresAt);
            if (payload.version !== 1 || !payload.qualificationId || !Number.isFinite(issuedAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || issuedAt > now || expiresAt <= issuedAt || expiresAt <= now)
                throw new Error('invalid');
            return payload;
        }
        catch {
            throw new common_1.ServiceUnavailableException({ code: 'MEMBER_SHARE_TOKEN_INVALID' });
        }
    }
};
exports.MemberShareLinkService = MemberShareLinkService;
exports.MemberShareLinkService = MemberShareLinkService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [qualification_access_service_1.QualificationAccessService, database_1.PrismaService])
], MemberShareLinkService);
//# sourceMappingURL=member-share-link.service.js.map