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
exports.AnalyticsService = void 0;
exports.requireUuid = requireUuid;
exports.freshness = freshness;
const common_1 = require("@nestjs/common");
const database_1 = require("@ucell/database");
const crypto_1 = require("crypto");
const audit_service_1 = require("../../common/audit/audit.service");
const analytics_policy_1 = require("./analytics.policy");
const analytics_source_1 = require("./analytics.source");
const analytics_history_1 = require("./analytics.history");
const analytics_volume_1 = require("./analytics.volume");
const analytics_prospects_1 = require("./analytics.prospects");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function requireUuid(value) { if (!uuid.test(value))
    throw new common_1.BadRequestException('VALID_UUID_REQUIRED'); return value; }
function freshness(asOf, now = new Date()) {
    const lagSeconds = Math.max(0, Math.floor((now.getTime() - asOf.getTime()) / 1000));
    return { status: lagSeconds > analytics_policy_1.ANALYTICS_POLICY.freshnessSeconds ? 'STALE' : 'AVAILABLE', lagSeconds };
}
let AnalyticsService = class AnalyticsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    metadata(row) {
        return { snapshotId: row.snapshot_id, asOf: row.as_of.toISOString(), policyVersion: row.policy_version,
            projectionVersion: row.payload.policy?.projectionVersion ?? 'analytics-v1', ...freshness(row.as_of), issues: row.payload.issues, comparisonAsOf: row.payload.comparisonAsOf };
    }
    async latest(scope) {
        const rows = scope === undefined
            ? await this.prisma.$queryRaw `SELECT * FROM integration.management_analytics_snapshot WHERE policy_version=${analytics_policy_1.ANALYTICS_POLICY.version} ORDER BY as_of DESC,snapshot_id DESC LIMIT 1`
            : await this.prisma.$queryRaw `SELECT * FROM integration.management_analytics_snapshot WHERE scope_key=${scope} AND policy_version=${analytics_policy_1.ANALYTICS_POLICY.version} ORDER BY as_of DESC,snapshot_id DESC LIMIT 1`;
        return rows[0];
    }
    async overview() {
        const row = await this.latest();
        return row ? { ...this.metadata(row), scope: 'ALL_COMPANY_PERSONS', ...row.payload.nasl.summary, policy: row.payload.policy }
            : { status: 'UNAVAILABLE', reason: 'PROJECTION_NOT_BUILT', asOf: null, policy: analytics_policy_1.ANALYTICS_POLICY };
    }
    async roots(q) {
        if (q && !/^[A-Za-z0-9]{1,24}$/.test(q))
            throw new common_1.BadRequestException('BALL_NUMBER_REQUIRED');
        const rows = await this.prisma.qualification.findMany({ where: q ? (/^\d{1,18}$/.test(q) ? { qualificationNo: BigInt(q) } : { ballNo: { startsWith: q.toUpperCase() } }) : {}, take: 30, orderBy: { qualificationNo: 'asc' }, select: { qualificationId: true, qualificationNo: true, ballNo: true } });
        return rows.map(row => ({ id: row.qualificationId, label: row.ballNo ?? `尚未編號 #${row.qualificationNo}` }));
    }
    async sonar(tree, root) {
        requireUuid(root);
        const row = await this.latest(root);
        if (!row?.payload.sonar)
            return { status: 'UNAVAILABLE', reason: 'ROOT_PROJECTION_NOT_BUILT', root, tree };
        const report = row.payload.sonar[tree];
        // Contributor identities are available only through the bounded, privileged drilldown.
        const strip = (g) => { const { qualificationIds, ...safe } = g; return safe; };
        return { ...this.metadata(row), ...report, total: strip(report.total), generations: report.generations.map(strip), left: report.left ? strip(report.left) : null, right: report.right ? strip(report.right) : null };
    }
    async drilldown(tree, root, generation) {
        requireUuid(root);
        if (!Number.isInteger(generation) || generation < 1 || generation > 12)
            throw new common_1.BadRequestException('GENERATION_1_TO_12_REQUIRED');
        const row = await this.latest(root);
        if (!row?.payload.sonar)
            throw new common_1.NotFoundException('ROOT_PROJECTION_NOT_BUILT');
        const ids = row.payload.sonar[tree].generations[generation - 1].qualificationIds;
        return { ...this.metadata(row), generation, total: ids.length, qualificationIds: ids.slice(0, 100), truncated: ids.length > 100 };
    }
    async volumes(tree, root) {
        requireUuid(root);
        const row = await this.latest(root);
        if (!row?.payload.volumes)
            return { status: 'UNAVAILABLE', reason: 'VOLUME_PROJECTION_NOT_BUILT', root, tree };
        const { sponsor, binary, carry, ...report } = row.payload.volumes;
        return { ...this.metadata(row), ...report, freshness: this.metadata(row).status, root, tree, volumes: tree === 'sponsor' ? sponsor : binary, carry: tree === 'binary' ? carry : null };
    }
    async history(input = {}) {
        const range = (0, analytics_history_1.historyRange)(input);
        const rows = await this.prisma.$queryRaw `
      SELECT snapshot_id,as_of,policy_version,jsonb_build_object('nasl',jsonb_build_object('summary',payload#>'{nasl,summary}'),'issues',payload->'issues','comparisonAsOf',payload->'comparisonAsOf','policy',payload->'policy') AS payload
      FROM (SELECT DISTINCT ON ((as_of AT TIME ZONE 'Asia/Taipei')::date) snapshot_id,as_of,policy_version,payload
      FROM integration.management_analytics_snapshot WHERE as_of>=${range.from} AND as_of<${range.to} AND policy_version=${range.policyVersion}
      ORDER BY (as_of AT TIME ZONE 'Asia/Taipei')::date DESC,as_of DESC,snapshot_id DESC) daily ORDER BY as_of DESC LIMIT 366`;
        return { policyVersion: range.policyVersion, from: range.fromDate, toExclusive: range.toDateExclusive, timezone: range.timezone, rows: rows.reverse().map(row => ({ ...this.metadata(row), ...row.payload.nasl.summary })),
            basis: 'CAPTURED_SNAPSHOTS_ONLY_NO_SYNTHETIC_BACKFILL' };
    }
    async cohorts(input = {}) {
        const range = (0, analytics_history_1.historyRange)(input), now = new Date();
        const rows = await this.prisma.$queryRaw `
      SELECT DISTINCT ON (date_trunc('month',as_of AT TIME ZONE 'Asia/Taipei')) as_of,policy_version,payload#>'{nasl,states}' AS states
      FROM integration.management_analytics_snapshot
      WHERE as_of>=${range.from} AND as_of<${range.to} AND as_of<=${now} AND policy_version=${range.policyVersion}
        AND (as_of AT TIME ZONE 'Asia/Taipei')::date=(date_trunc('month',as_of AT TIME ZONE 'Asia/Taipei')+interval '1 month - 1 day')::date
      ORDER BY date_trunc('month',as_of AT TIME ZONE 'Asia/Taipei'),as_of DESC,snapshot_id DESC LIMIT 13`;
        return (0, analytics_history_1.cohortRetention)(rows.map(r => ({ asOf: r.as_of.toISOString(), policyVersion: r.policy_version, states: r.states })), range, now);
    }
    async policyVersions() {
        const rows = await this.prisma.$queryRaw `SELECT DISTINCT policy_version FROM integration.management_analytics_snapshot ORDER BY policy_version DESC LIMIT 30`;
        return [...new Set([analytics_policy_1.ANALYTICS_POLICY.version, ...rows.map(r => r.policy_version)])];
    }
    async scopeFreshness(scopes) {
        const rows = await this.prisma.$queryRaw `SELECT DISTINCT ON(scope_key) scope_key,as_of FROM integration.management_analytics_snapshot
      WHERE scope_key IN (${database_1.Prisma.join(scopes)}) AND policy_version=${analytics_policy_1.ANALYTICS_POLICY.version} ORDER BY scope_key,as_of DESC`;
        return scopes.map(scope => { const row = rows.find(r => r.scope_key === scope); return row ? { scope, asOf: row.as_of.toISOString(), ...freshness(row.as_of) } : { scope, asOf: null, status: 'UNAVAILABLE', lagSeconds: null }; });
    }
    async rebuild(id, root, actorKey, actorId) {
        requireUuid(id);
        if (root)
            requireUuid(root);
        const scope = root ?? 'GLOBAL';
        return this.prisma.$transaction(async (tx) => {
            // Serialize projector writers. Return promptly when another rebuild owns the lock.
            const [lock] = await tx.$queryRaw `SELECT pg_try_advisory_xact_lock(19670919,1301) AS locked`;
            if (!lock.locked)
                throw new common_1.ConflictException('ANALYTICS_REBUILD_IN_PROGRESS');
            const existing = await tx.$queryRaw `SELECT * FROM integration.management_analytics_snapshot WHERE snapshot_id=${id}::uuid`;
            if (existing[0]) {
                if (existing[0].scope_key !== scope || existing[0].actor_key !== actorKey)
                    throw new common_1.ConflictException('IDEMPOTENCY_KEY_REUSED');
                return { snapshotId: id, asOf: existing[0].as_of.toISOString(), replayed: true };
            }
            const [clock] = await tx.$queryRaw `SELECT transaction_timestamp() AS at`;
            const at = clock.at, previous = (await tx.$queryRaw `SELECT * FROM integration.management_analytics_snapshot WHERE policy_version=${analytics_policy_1.ANALYTICS_POLICY.version} ORDER BY as_of DESC,snapshot_id DESC LIMIT 1`)[0];
            const facts = await (0, analytics_source_1.captureAnalyticsFacts)(tx, at);
            if (root && !facts.qualifications.some(q => q.id === root))
                throw new common_1.NotFoundException('QUALIFICATION_NOT_FOUND');
            const base = (0, analytics_policy_1.buildNasl)(facts, at.toISOString(), previous?.payload.nasl.states);
            const included = facts.persons.filter(p => base.states[p.id]);
            const nasl = { ...base, summary: { ...base.summary, prospectWindows: Object.fromEntries([7, 30, 90].map(days => [days, (0, analytics_prospects_1.prospectConversion)(included, at.toISOString(), days)])), excludedMissingFormalDates: facts.persons.filter(p => p.excludeFromLifecycle).length } };
            let sonar = null;
            if (root) {
                const before = new Date(at.getTime() - 30 * analytics_policy_1.DAY), after = new Date(at.getTime() - 31 * analytics_policy_1.DAY);
                const baseline = (await tx.$queryRaw `SELECT * FROM integration.management_analytics_snapshot WHERE scope_key=${scope} AND policy_version=${analytics_policy_1.ANALYTICS_POLICY.version} AND as_of<=${before} AND as_of>=${after} ORDER BY as_of DESC LIMIT 1`)[0];
                try {
                    sonar = { sponsor: (0, analytics_policy_1.buildSonar)(root, 'sponsor', facts, nasl.states, at.toISOString(), baseline?.payload.sonar?.sponsor.total), binary: (0, analytics_policy_1.buildSonar)(root, 'binary', facts, nasl.states, at.toISOString(), baseline?.payload.sonar?.binary.total) };
                }
                catch (error) {
                    throw new common_1.ServiceUnavailableException(error instanceof Error ? error.message : 'SONAR_PROJECTION_FAILED');
                }
            }
            const volumes = root ? await (0, analytics_volume_1.captureVolumeProjection)(tx, root, at) : null;
            const sourceHash = (0, crypto_1.createHash)('sha256').update(JSON.stringify({ facts, volumes, asOf: at.toISOString(), policy: analytics_policy_1.ANALYTICS_POLICY })).digest('hex');
            const payload = { nasl, sonar, volumes, issues: facts.issues, comparisonAsOf: previous?.as_of.toISOString() ?? null, policy: analytics_policy_1.ANALYTICS_POLICY };
            await tx.$executeRaw `INSERT INTO integration.management_analytics_snapshot(snapshot_id,actor_key,scope_key,as_of,policy_version,source_hash,payload)
        VALUES(${id}::uuid,${actorKey},${scope},${at},${analytics_policy_1.ANALYTICS_POLICY.version},${sourceHash},${JSON.stringify(payload)}::jsonb)`;
            await this.audit.write(tx, { actorType: actorId ? 'USER' : 'SYSTEM', actorId, action: 'MANAGEMENT_ANALYTICS_PROJECTED', entityType: 'ANALYTICS_SNAPSHOT', entityId: id,
                afterData: { scope, sourceHash, policyVersion: analytics_policy_1.ANALYTICS_POLICY.version }, requestId: id, correlationId: id });
            return { snapshotId: id, asOf: at.toISOString(), replayed: false };
        }, { isolationLevel: database_1.Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60_000 });
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_1.PrismaService, audit_service_1.AuditService])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map