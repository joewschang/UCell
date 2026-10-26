"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberPlacementBranch = memberPlacementBranch;
exports.placementMonitor = placementMonitor;
const common_1 = require("@nestjs/common");
const qualification_access_service_1 = require("../auth/qualification-access.service");
const current_tree_1 = require("../binary-tree/current-tree");
/** Member projection: authorize the confirmed sponsor before reading any tree. */
async function memberPlacementBranch(db, personId, reference, ballNo) {
    const match = /^P([1-9]\d{0,18})$/.exec(reference);
    if (!match || BigInt(match[1]) > 9223372036854775807n || ballNo && !/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6}|\d{6,19})$/.test(ballNo))
        throw new common_1.UnprocessableEntityException({ code: 'PLACEMENT_REFERENCE_INVALID' });
    const target = await db.qualification.findUnique({ where: { qualificationNo: BigInt(match[1]) }, include: { ballAllocation: true } });
    const authorize = async () => {
        const setup = target && await db.qualificationSetup.findUnique({ where: { qualificationId: target.qualificationId } });
        if (!setup?.finalSponsorQualificationId || !target.ballAllocation)
            throw new common_1.ForbiddenException({ code: 'PLACEMENT_AUTHORITY_DENIED' });
        await new qualification_access_service_1.QualificationAccessService(db).assertHolder(personId, setup.finalSponsorQualificationId);
    };
    await authorize();
    const state = await (0, current_tree_1.currentTreeState)(db, { authorize }, {}, target.ballAllocation.binaryTreeId, { candidateBallNo: target.ballNo, ballNo });
    return { observedAt: state.observedAt, ballNo: state.candidate.ballNo, sponsorBallNo: state.candidate.sponsorBallNo, sequence: state.candidate.sequence, blocked: state.candidate.blocked,
        breadcrumbs: state.breadcrumbs, nodes: state.nodes.map(n => ({ ballNo: n.ballNo, position: n.position, slots: n.slots })) };
}
async function placementMonitor(db, input = {}, now = new Date()) {
    const statuses = ['PLACEMENT_PENDING', 'PLACEMENT_OVERDUE', 'PLACED'];
    if (input.status && !statuses.includes(input.status) || input.aging && !['0_24H', '24_48H', '48_72H', 'OVERDUE'].includes(input.aging) || input.after && !/^[0-9a-f-]{36}$/i.test(input.after))
        throw new common_1.UnprocessableEntityException({ code: 'PLACEMENT_FILTER_INVALID' });
    const take = Math.min(Math.max(Number.isFinite(input.take) ? input.take : 50, 1), 100);
    const pending = { setupStatus: 'PLACEMENT_PENDING', OR: [{ placementDueAt: null }, { placementDueAt: { gt: now } }] };
    const overdue = { OR: [{ setupStatus: 'PLACEMENT_OVERDUE' }, { setupStatus: 'PLACEMENT_PENDING', placementDueAt: { lte: now } }] };
    const age = input.aging === 'OVERDUE' ? overdue : input.aging ? { setupStatus: { not: 'PLACED' }, placementRequestedAt: { gt: new Date(now.getTime() - ({ '0_24H': 24, '24_48H': 48, '48_72H': 72 }[input.aging]) * 3600000), lte: new Date(now.getTime() - ({ '0_24H': 0, '24_48H': 24, '48_72H': 48 }[input.aging]) * 3600000) } } : {};
    const where = { AND: [{ setupStatus: { in: statuses } }, input.status === 'PLACEMENT_PENDING' ? pending : input.status === 'PLACEMENT_OVERDUE' ? overdue : input.status ? { setupStatus: input.status } : {}, age] };
    const [rows, total, waiting, late, done] = await Promise.all([
        db.qualificationSetup.findMany({ where: { ...where, ...(input.after ? { qualificationId: { gt: input.after } } : {}) }, orderBy: { qualificationId: 'asc' }, take: take + 1 }), db.qualificationSetup.count({ where }), db.qualificationSetup.count({ where: pending }), db.qualificationSetup.count({ where: overdue }), db.qualificationSetup.count({ where: { setupStatus: 'PLACED' } })
    ]);
    const ids = [...new Set(rows.flatMap((r) => [r.qualificationId, r.finalSponsorQualificationId]).filter(Boolean))];
    const balls = await db.qualification.findMany({ where: { qualificationId: { in: ids } }, select: { qualificationId: true, ballNo: true, ballAllocation: { select: { binaryTreeId: true } }, currentHolder: { select: { memberNo: true } } } });
    const byId = new Map(balls.map((b) => [b.qualificationId, b]));
    return { items: rows.slice(0, take).map((r) => { const b = byId.get(r.qualificationId); return { ballNo: b?.ballNo, memberNo: b?.currentHolder?.memberNo, treeId: b?.ballAllocation?.binaryTreeId, sponsorBallNo: byId.get(r.finalSponsorQualificationId)?.ballNo, packageType: r.packageType, status: r.setupStatus === 'PLACEMENT_PENDING' && r.placementDueAt && r.placementDueAt <= now ? 'PLACEMENT_OVERDUE' : r.setupStatus, requestedAt: r.placementRequestedAt?.toISOString() ?? null, dueAt: r.placementDueAt?.toISOString() ?? null, placedAt: r.placedAt?.toISOString() ?? null }; }), total, nextCursor: rows.length > take ? rows[take - 1].qualificationId : null, counts: { pending: waiting, overdue: late, placed: done }, observedAt: now.toISOString() };
}
//# sourceMappingURL=placement-workbench.js.map