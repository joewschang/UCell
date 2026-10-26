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
exports.OrganizationGeoService = void 0;
const geo_membership_scope_1 = require("./geo-membership-scope");
const common_1 = require("@nestjs/common");
const database_1 = require("@ucell/database");
const shared_1 = require("@ucell/shared");
const tree_authorization_1 = require("../binary-tree/tree-authorization");
const tree_ancestry_integrity_1 = require("../binary-tree/tree-ancestry-integrity");
const tree_active_evidence_1 = require("../binary-tree/tree-active-evidence");
const binary_tree_metrics_1 = require("../binary-tree/binary-tree-metrics");
const geo_aggregation_1 = require("./geo-aggregation");
const geo_normalization_1 = require("./geo-normalization");
const viewRoles = ['SUPER_ADMIN', 'ORG_GEO_VIEW', 'ORG_GEO_DRILLDOWN', 'ORG_GEO_EXPORT'];
const BOUND = 500;
let OrganizationGeoService = class OrganizationGeoService {
    db;
    constructor(db) {
        this.db = db;
    }
    time(input) {
        try {
            const time = (0, shared_1.parseAsOfContext)({ timezone: 'Asia/Taipei', asOf: input.asOf, knowledgeCutoff: input.knowledgeCutoff, periodStart: input.dateFrom, periodEnd: input.dateTo });
            const now = Date.now();
            if (Date.parse(time.asOf) > now + 5000 || Date.parse(time.knowledgeCutoff) > now + 5000)
                throw new Error();
            return { ...time, asOf: new Date(Math.min(Date.parse(time.asOf), now)).toISOString(), knowledgeCutoff: new Date(Math.min(Date.parse(time.knowledgeCutoff), now)).toISOString() };
        }
        catch {
            throw new common_1.UnprocessableEntityException({ code: 'INVALID_GEO_TIME_CONTEXT' });
        }
    }
    async capture(p, input, exporting = false) {
        const roles = exporting ? ['SUPER_ADMIN', 'ORG_GEO_EXPORT'] : input.level === 'DISTRICT' || input.parentAreaCode ? ['SUPER_ADMIN', 'ORG_GEO_DRILLDOWN', 'ORG_GEO_EXPORT'] : viewRoles;
        await (0, tree_authorization_1.authorizeTreePrincipal)(this.db, p, roles);
        const time = this.time(input), at = new Date(time.asOf), known = new Date(time.knowledgeCutoff);
        const data = await this.db.$transaction(async (tx) => {
            if (!input.rootQualificationId && !input.rootBallNo)
                throw new common_1.UnprocessableEntityException({ code: 'GEO_ROOT_BALL_REQUIRED' });
            const root = await tx.qualification.findUnique({ where: input.rootBallNo ? { ballNo: input.rootBallNo } : { qualificationId: input.rootQualificationId }, select: { qualificationId: true, ballNo: true } });
            if (!root || input.rootQualificationId && input.rootQualificationId !== root.qualificationId)
                throw new common_1.NotFoundException({ code: 'GEO_ROOT_NOT_FOUND' });
            const membership = await tx.binaryTreeMembership.findFirst({ where: { qualificationId: root.qualificationId, effectiveFrom: { lte: at }, recordedAt: { lte: known } } });
            if (!membership)
                throw new common_1.NotFoundException({ code: 'GEO_ROOT_NOT_FOUND' });
            const treeId = membership.binaryTreeId;
            const base = { rootBallNo: root.ballNo, time, definitionVersion: geo_normalization_1.GEO_DEFINITION_VERSION, areaVersion: geo_normalization_1.GEO_AREA_VERSION, sourceWatermark: time.knowledgeCutoff, geographyBasis: 'APPROVED_COMMUNICATION_ADDRESS_AT_CHECKPOINT', gpvUnit: 'GPV_POINT' };
            const unavailable = (reason) => ({ ...base, status: 'UNAVAILABLE', reason, summary: null, distribution: [], branchComparison: [], carry: null, lastUpdated: null });
            if (await (0, tree_ancestry_integrity_1.treeAncestryCompleteness)(tx, treeId, time) !== '0')
                return unavailable('CANONICAL_ANCESTRY_EVIDENCE_INCOMPLETE');
            const descendants = await (0, geo_membership_scope_1.geoDescendants)(tx, treeId, membership.binaryPositionNo, time);
            if (descendants.length > BOUND)
                return unavailable('GEO_SCALE_PROJECTION_REQUIRED');
            const ids = descendants.map(d => d.descendantQualificationId);
            const members = await tx.binaryTreeMembership.findMany({ where: { binaryTreeId: treeId, qualificationId: { in: ids }, effectiveFrom: { lte: at }, recordedAt: { lte: known } } });
            const owners = await tx.qualificationOwnerInterval.findMany({ where: { qualificationId: { in: ids }, effectiveFrom: { lte: at }, recordedAt: { lte: known }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }, { closedRecordedAt: { gt: known } }] } });
            const profiles = await tx.memberGeoProfileVersion.findMany({ where: { memberId: { in: owners.flatMap(o => o.ownerType === 'MEMBER' && o.personId ? [o.personId] : []) }, sourceEffectiveAt: { lte: at }, sourceRecordedAt: { lte: known } }, orderBy: [{ sourceEffectiveAt: 'desc' }, { sourceRecordedAt: 'desc' }, { geoProfileVersionId: 'asc' }], take: 10001 });
            if (profiles.length > 10000)
                return unavailable('GEO_ADDRESS_PROJECTION_LIMIT');
            const activeEvidence = await (0, tree_active_evidence_1.readBallsActiveEvidence)(tx, owners.filter(o => o.ownerType === 'MEMBER').map(o => o.qualificationId), time);
            const facts = [];
            for (const descendant of descendants) {
                const ownerRows = owners.filter(o => o.qualificationId === descendant.descendantQualificationId), memberRows = members.filter(m => m.qualificationId === descendant.descendantQualificationId);
                if (ownerRows.length !== 1 || memberRows.length !== 1 || !['LEFT', 'RIGHT'].includes(descendant.firstSide ?? ''))
                    return unavailable('GEO_HISTORICAL_OWNER_OR_PLACEMENT_MISSING');
                const owner = ownerRows[0], personId = owner.ownerType === 'MEMBER' ? owner.personId : null;
                if (owner.ownerType === 'MEMBER' && !personId)
                    return unavailable('GEO_MEMBER_OWNER_PERSON_MISSING');
                const profile = personId ? profiles.find(g => g.memberId === personId) : undefined;
                if (profile && profiles.filter(g => g.memberId === personId && g.sourceEffectiveAt.getTime() === profile.sourceEffectiveAt.getTime() && g.sourceRecordedAt.getTime() === profile.sourceRecordedAt.getTime()).length > 1)
                    return unavailable('GEO_AMBIGUOUS_ADDRESS_HISTORY');
                const active = owner.ownerType === 'MEMBER' ? activeEvidence.get(descendant.descendantQualificationId)?.state ?? 'UNKNOWN' : 'UNKNOWN';
                facts.push({ qualificationId: descendant.descendantQualificationId, personId, ownerType: owner.ownerType, firstSide: descendant.firstSide, placedAt: memberRows[0].effectiveFrom.toISOString(), active, cityCode: profile?.cityCode ?? null, districtCode: profile?.districtCode ?? null });
            }
            const performance = await (0, binary_tree_metrics_1.readFoundingPerformance)(tx, treeId, root.qualificationId, time, true, await (0, geo_membership_scope_1.geoGpvSources)(tx, treeId, membership.binaryPositionNo, time));
            const aggregate = (0, geo_aggregation_1.aggregateGeo)(facts, performance.status === 'AVAILABLE' ? performance.sourceFacts ?? [] : [], { side: input.side ?? 'ALL', level: input.level ?? 'CITY', parentAreaCode: input.parentAreaCode, periodStart: time.periodStart, periodEnd: time.periodEnd, gpvAvailable: performance.status === 'AVAILABLE' });
            const carry = await (0, binary_tree_metrics_1.readFoundingCarry)(tx, root.qualificationId, time);
            return { ...base, ...aggregate, status: performance.status === 'AVAILABLE' && aggregate.summary.unknownActiveBalls === 0 ? 'AVAILABLE' : 'PARTIAL', reason: performance.reason ?? (aggregate.summary.unknownActiveBalls ? 'GEO_ACTIVE_EVIDENCE_INCOMPLETE' : null), carry, lastUpdated: performance.status === 'AVAILABLE' ? performance.lastUpdated : null, gpvSourceHash: performance.status === 'AVAILABLE' ? performance.sourceHash : null };
        }, { isolationLevel: database_1.Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
        await (0, tree_authorization_1.authorizeTreePrincipal)(this.db, p, roles);
        return data;
    }
    async topMarkets(p, input) {
        const result = await this.capture(p, input), metric = input.metric ?? 'BALLS';
        if (metric === 'GPV' && result.summary?.gpv == null)
            return { ...result, distribution: [], reason: 'GEO_GPV_RANKING_UNAVAILABLE' };
        const key = { BALLS: 'balls', MEMBERS: 'members', ACTIVE_BALLS: 'activeBalls', NEW_BALLS: 'newBalls', GPV: 'gpv' }[metric];
        const rows = result.distribution.filter(r => r.areaCode !== 'UNLOCATED');
        rows.sort((a, b) => new database_1.Prisma.Decimal(b[key] ?? 0).cmp(new database_1.Prisma.Decimal(a[key] ?? 0)) || a.areaCode.localeCompare(b.areaCode));
        return { ...result, distribution: rows.slice(0, Math.min(input.limit ?? 10, 20)) };
    }
    async trend(p, input) {
        const roles = input.level === 'DISTRICT' || input.parentAreaCode ? ['SUPER_ADMIN', 'ORG_GEO_DRILLDOWN', 'ORG_GEO_EXPORT'] : viewRoles;
        await (0, tree_authorization_1.authorizeTreePrincipal)(this.db, p, roles);
        const time = this.time(input);
        if (!input.rootQualificationId && !input.rootBallNo)
            throw new common_1.UnprocessableEntityException({ code: 'GEO_ROOT_BALL_REQUIRED' });
        const root = await this.db.qualification.findUnique({ where: input.rootBallNo ? { ballNo: input.rootBallNo } : { qualificationId: input.rootQualificationId }, select: { qualificationId: true } });
        if (!root || input.rootQualificationId && root.qualificationId !== input.rootQualificationId)
            throw new common_1.NotFoundException({ code: 'GEO_ROOT_NOT_FOUND' });
        const membership = await this.db.binaryTreeMembership.findFirst({ where: { qualificationId: root.qualificationId, effectiveFrom: { lte: new Date(time.asOf) }, recordedAt: { lte: new Date(time.knowledgeCutoff) } }, orderBy: { effectiveFrom: 'asc' }, select: { effectiveFrom: true } });
        if (!membership)
            throw new common_1.NotFoundException({ code: 'GEO_ROOT_NOT_FOUND' });
        const buckets = [];
        let start = new Date(Math.max(Date.parse(time.periodStart), membership.effectiveFrom.getTime()));
        const actualPeriodStart = start.toISOString();
        const until = Math.min(Date.parse(time.periodEnd), Date.parse(time.asOf));
        while (start.getTime() < until) {
            let next;
            if (input.interval === 'MONTH') {
                const taipei = new Date(start.getTime() + 8 * 3600000);
                next = new Date(Date.UTC(taipei.getUTCFullYear(), taipei.getUTCMonth() + 1, 1) - 8 * 3600000);
            }
            else
                next = new Date(start.getTime() + (input.interval === 'WEEK' ? 7 : 1) * 86400000);
            const end = new Date(Math.min(next.getTime(), until));
            buckets.push({ start: start.toISOString(), end: end.toISOString() });
            start = end;
            if (buckets.length > 31)
                throw new common_1.UnprocessableEntityException({ code: 'GEO_TREND_MAX_31_BUCKETS_SELECT_COARSER_INTERVAL' });
        }
        const rows = [];
        for (const bucket of buckets) {
            const snapshot = await this.capture(p, { ...input, dateFrom: bucket.start, dateTo: bucket.end, asOf: bucket.end });
            rows.push({ periodStart: bucket.start, periodEnd: bucket.end, status: snapshot.status, reason: snapshot.reason, summary: snapshot.summary });
        }
        await (0, tree_authorization_1.authorizeTreePrincipal)(this.db, p, roles);
        return { definitionVersion: geo_normalization_1.GEO_DEFINITION_VERSION, sourceWatermark: time.knowledgeCutoff, time, actualPeriodStart, interval: input.interval ?? 'DAY', rows };
    }
};
exports.OrganizationGeoService = OrganizationGeoService;
exports.OrganizationGeoService = OrganizationGeoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_1.PrismaService])
], OrganizationGeoService);
//# sourceMappingURL=organization-geo.service.js.map