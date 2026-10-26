"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inSubtree = inSubtree;
exports.assertCurrentPlacement = assertCurrentPlacement;
exports.currentTreeList = currentTreeList;
exports.currentTreeState = currentTreeState;
const common_1 = require("@nestjs/common");
const database_1 = require("@ucell/database");
function inSubtree(position, root) {
    if (root < 1n || position < root)
        return false;
    while (position > root)
        position /= 2n;
    return position === root;
}
/** Used again inside the placement transaction; browsing never reserves a slot. */
async function assertCurrentPlacement(tx, treeId, qualificationId, parentId) {
    const target = await tx.qualification.findUnique({ where: { qualificationId }, include: { ballAllocation: true, currentHolder: true, sponsorRelation: true, binaryTreeMembership: true } });
    const setup = await tx.qualificationSetup.findUnique({ where: { qualificationId } });
    if (!target || target.kind !== 'MEMBER_ORIGIN' || !target.ballNo || target.ballAllocation?.binaryTreeId !== treeId)
        throw new common_1.ConflictException({ code: 'BINARY_TREE_SCOPE_MISMATCH' });
    if (target.binaryTreeMembership)
        throw new common_1.ConflictException({ code: 'QUALIFICATION_ALREADY_PLACED' });
    if (!['DRAFT', 'EFFECTIVE'].includes(target.status) || target.currentHolder?.membershipState !== 'FORMAL_MEMBER')
        throw new common_1.ConflictException({ code: 'FORMAL_MEMBERSHIP_REQUIRED' });
    if (!setup || !['PLACEMENT_PENDING', 'PLACEMENT_OVERDUE'].includes(setup.setupStatus) || setup.finalSponsorQualificationId !== target.sponsorRelation?.sponsorQualificationId)
        throw new common_1.ConflictException({ code: 'PLACEMENT_NOT_PENDING' });
    const order = await tx.order.findUnique({ where: { orderId: setup.qualifyingOrderId }, select: { status: true } });
    if (!order || !['PAID', 'FULFILLED', 'PARTIAL_RETURN'].includes(order.status))
        throw new common_1.ConflictException({ code: 'QUALIFYING_ORDER_NOT_PAID' });
    const sponsor = target.sponsorRelation;
    if (!sponsor || sponsor.effectiveFrom > new Date() || (sponsor.effectiveTo && sponsor.effectiveTo <= new Date()))
        throw new common_1.ConflictException({ code: 'SPONSOR_CONFIRMATION_MISSING' });
    const [root, parent] = await Promise.all([tx.binaryTreeMembership.findUnique({ where: { qualificationId: sponsor.sponsorQualificationId } }), tx.binaryTreeMembership.findUnique({ where: { qualificationId: parentId } })]);
    if (root?.binaryTreeId !== treeId || parent?.binaryTreeId !== treeId || !inSubtree(parent.binaryPositionNo, root.binaryPositionNo))
        throw new common_1.ConflictException({ code: 'SPONSOR_SUBTREE_REQUIRED' });
}
const treeSelect = { binaryTreeId: true, treeCode: true, treeName: true, status: true, topologyVersion: true };
async function currentTreeList(db, commands, p, after) {
    await commands.authorize(p);
    const rows = await db.binaryTree.findMany({ where: after ? { binaryTreeId: { gt: after } } : {}, orderBy: { binaryTreeId: 'asc' }, take: 51, select: treeSelect });
    await commands.authorize(p);
    return { items: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].binaryTreeId : null };
}
async function currentTreeState(db, commands, p, id, input) {
    await commands.authorize(p);
    const result = await db.$transaction(async (tx) => {
        const tree = await tx.binaryTree.findUnique({ where: { binaryTreeId: id }, select: treeSelect });
        if (!tree)
            throw new common_1.ConflictException({ code: 'TREE_NOT_FOUND' });
        const pendingWhere = { kind: 'MEMBER_ORIGIN', ballAllocation: { binaryTreeId: id }, binaryTreeMembership: null };
        const pending = await tx.qualification.findMany({ where: { ...pendingWhere, ...(input.after ? { qualificationId: { gt: input.after } } : {}) }, orderBy: { qualificationId: 'asc' }, take: 51, select: { qualificationId: true, ballNo: true, planLevelCode: true, currentHolder: { select: { memberNo: true } }, sponsorRelation: { select: { sponsor: { select: { ballNo: true } } } } } });
        const pendingTotal = await tx.qualification.count({ where: pendingWhere });
        const mapPending = (q) => ({ qualificationId: q.qualificationId, ballNo: q.ballNo, memberNo: q.currentHolder?.memberNo, planLevelCode: q.planLevelCode, sponsorBallNo: q.sponsorRelation?.sponsor.ballNo });
        const candidate = input.candidateBallNo ? await tx.qualification.findFirst({ where: { ...pendingWhere, ballNo: input.candidateBallNo }, include: { sponsorRelation: { include: { sponsor: { select: { ballNo: true, binaryTreeMembership: true } } } } } }) : null;
        if (input.candidateBallNo && !candidate)
            throw new common_1.ConflictException({ code: 'UNPLACED_TREE_BALL_REQUIRED' });
        const sponsor = candidate?.sponsorRelation?.sponsor;
        const rootBall = input.ballNo || sponsor?.ballNo;
        const root = await tx.binaryTreeMembership.findFirst({ where: { binaryTreeId: id, ...(rootBall ? { qualification: { ballNo: rootBall } } : { binaryPositionNo: 1n }) }, include: { qualification: { select: { ballNo: true } } } });
        if (!root)
            throw new common_1.ConflictException({ code: 'TREE_BALL_NOT_FOUND' });
        if (candidate && (!sponsor?.binaryTreeMembership || !inSubtree(root.binaryPositionNo, sponsor.binaryTreeMembership.binaryPositionNo)))
            throw new common_1.ConflictException({ code: 'SPONSOR_SUBTREE_REQUIRED' });
        const positions = [root.binaryPositionNo];
        const maxPosition = 9223372036854775807n;
        for (let i = 0; i < 3 && i < positions.length; i++)
            if (positions[i] * 2n + 1n <= maxPosition)
                positions.push(positions[i] * 2n, positions[i] * 2n + 1n);
        const rows = await tx.binaryTreeMembership.findMany({ where: { binaryTreeId: id, binaryPositionNo: { in: positions }, effectiveFrom: { lte: new Date() } }, orderBy: { binaryPositionNo: 'asc' }, include: { qualification: { select: { ballNo: true, kind: true, planLevelCode: true } } } });
        const ancestors = [];
        let cursor = root.binaryPositionNo;
        const stop = sponsor?.binaryTreeMembership?.binaryPositionNo ?? 1n;
        while (cursor >= stop && cursor > 0n) {
            ancestors.unshift(cursor);
            cursor /= 2n;
        }
        const breadcrumbs = await tx.binaryTreeMembership.findMany({ where: { binaryTreeId: id, binaryPositionNo: { in: ancestors } }, orderBy: { binaryPositionNo: 'asc' }, include: { qualification: { select: { ballNo: true } } } });
        let blocked = null;
        if (candidate) {
            try {
                await assertCurrentPlacement(tx, id, candidate.qualificationId, root.qualificationId);
            }
            catch (e) {
                if (!(e instanceof common_1.ConflictException))
                    throw e;
                blocked = e.getResponse().code;
            }
        }
        const children = await tx.binaryTreeMembership.findMany({ where: { binaryTreeId: id, binaryPositionNo: { in: rows.flatMap(r => [r.binaryPositionNo * 2n, r.binaryPositionNo * 2n + 1n]).filter(n => n <= maxPosition) } }, select: { binaryPositionNo: true } });
        const occupied = new Set(children.map(r => r.binaryPositionNo.toString()));
        const designation = candidate ? await tx.companySponsorDesignation.findUnique({ where: { binaryTreeId: id } }) : null;
        const canonical = candidate ? await tx.treeCanonicalPosition.findMany({ where: { binaryTreeId: id }, select: { positionNo: true } }) : [];
        const sequence = candidate?.sponsorRelation?.sponsorSequenceNo;
        return { tree, observedAt: new Date().toISOString(), pending: { items: pending.slice(0, 50).map(mapPending), total: pendingTotal, nextCursor: pending.length > 50 ? pending[49].qualificationId : null },
            candidate: candidate ? { qualificationId: candidate.qualificationId, ballNo: candidate.ballNo, sponsorBallNo: sponsor?.ballNo, sequence, blocked } : null,
            breadcrumbs: breadcrumbs.map(r => ({ ballNo: r.qualification.ballNo })),
            nodes: rows.map(r => ({ qualificationId: r.qualificationId, ballNo: r.qualification.ballNo, position: r.binaryPositionNo.toString(), kind: r.qualification.kind, planLevelCode: r.qualification.planLevelCode,
                slots: candidate ? ['LEFT', 'RIGHT'].flatMap(side => {
                    const pos = r.binaryPositionNo * 2n + (side === 'RIGHT' ? 1n : 0n);
                    if (pos > maxPosition || occupied.has(pos.toString()))
                        return [];
                    let reason = blocked || (tree.status !== 'ACTIVE' ? 'TREE_NOT_OPEN_TO_PLACEMENT' : null);
                    if (!reason && (sequence === 1 || sequence === 3) && !inSubtree(pos, sponsor.binaryTreeMembership.binaryPositionNo * 2n))
                        reason = 'BINARY_LEFT_SUBTREE_REQUIRED';
                    if (!reason && canonical.some(c => BigInt(c.positionNo) === pos) && designation?.qualificationId !== candidate.sponsorRelation?.sponsorQualificationId)
                        reason = 'FOUNDING_COMPANY_SPONSOR_REQUIRED';
                    return [{ side, reason }];
                }) : [] })) };
    }, { isolationLevel: database_1.Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });
    await commands.authorize(p);
    return result;
}
//# sourceMappingURL=current-tree.js.map