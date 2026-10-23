"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureAnalyticsFacts = captureAnalyticsFacts;
const common_1 = require("@nestjs/common");
const analytics_prospects_1 = require("./analytics.prospects");
const LIMIT = 25_000, EVENT_LIMIT = 100_000;
function bounded(rows, limit, name) {
    if (rows.length > limit)
        throw new common_1.ServiceUnavailableException(`ANALYTICS_SOURCE_LIMIT:${name}; no partial projection published`);
    return rows;
}
/** A bounded, repeatable-read source capture. No money is calculated or written. */
async function captureAnalyticsFacts(tx, at) {
    const persons = bounded(await tx.person.findMany({ where: { createdAt: { lte: at } }, take: LIMIT + 1, orderBy: { personId: 'asc' }, select: { personId: true, createdAt: true, status: true, membershipState: true } }), LIMIT, 'persons');
    const qs = bounded(await tx.qualification.findMany({ where: { createdAt: { lte: at } }, take: LIMIT + 1, orderBy: { qualificationId: 'asc' }, select: { qualificationId: true, currentHolderPersonId: true, currentHolderLegalEntityId: true, status: true, createdAt: true } }), LIMIT, 'qualifications');
    const holders = bounded(await tx.qualificationHolderHistory.findMany({ where: { effectiveFrom: { lte: at } }, take: EVENT_LIMIT + 1, orderBy: { holderHistoryId: 'asc' }, select: { qualificationId: true, holderPersonId: true, holderLegalEntityId: true, effectiveFrom: true, effectiveTo: true } }), EVENT_LIMIT, 'holder_history');
    const paid = bounded(await tx.order.findMany({ where: { paidAt: { lte: at } }, take: EVENT_LIMIT + 1, orderBy: { orderId: 'asc' }, select: { orderId: true, qualificationId: true, paidAt: true, purpose: true } }), EVENT_LIMIT, 'paid_orders');
    const recognized = bounded(await tx.monthlyRecognitionSchedule.findMany({ where: { recognizedAt: { lte: at }, status: { in: ['RECOGNIZED', 'REVERSED'] } }, take: EVENT_LIMIT + 1, orderBy: { recognitionId: 'asc' }, select: { recognitionId: true, recognizedAt: true, subscription: { select: { qualificationId: true } } } }), EVENT_LIMIT, 'recognitions');
    const periods = bounded(await tx.activePeriod.findMany({ where: { activeFrom: { lte: at }, OR: [{ activeTo: null }, { activeTo: { gt: at } }] }, take: EVENT_LIMIT + 1, orderBy: { activePeriodId: 'asc' }, select: { qualificationId: true } }), EVENT_LIMIT, 'active_periods');
    // Explicitly designated system balls only; no inference from names or arbitrary company people.
    const system = bounded(await tx.systemAssignmentPoolEntry.findMany({ where: { enabledFrom: { lte: at } }, take: LIMIT + 1, orderBy: { systemAssignmentPoolEntryId: 'asc' }, select: { qualificationId: true, enabledFrom: true, enabledTo: true } }), LIMIT, 'system_pool');
    const sponsor = bounded(await tx.sponsorRelationship.findMany({ where: { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] }, take: LIMIT + 1, orderBy: { sponsorRelationshipId: 'asc' }, select: { sponsorQualificationId: true, childQualificationId: true } }), LIMIT, 'sponsor');
    const binary = bounded(await tx.binaryPlacement.findMany({ where: { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] }, take: LIMIT + 1, orderBy: { binaryPlacementId: 'asc' }, select: { parentQualificationId: true, childQualificationId: true, side: true } }), LIMIT, 'binary');
    const personIds = new Set(persons.map(p => p.personId)), systemIds = new Set(system.filter(q => !q.enabledTo || q.enabledTo > at).map(q => q.qualificationId)), activeIds = new Set(periods.map(q => q.qualificationId));
    const holderMap = new Map();
    for (const h of holders) {
        const rows = holderMap.get(h.qualificationId) ?? [];
        rows.push(h);
        holderMap.set(h.qualificationId, rows);
    }
    const activities = [];
    const push = (id, qualificationId, time, repurchase) => {
        if (system.some(s => s.qualificationId === qualificationId && s.enabledFrom <= time && (!s.enabledTo || s.enabledTo > time)))
            return;
        const candidates = (holderMap.get(qualificationId) ?? []).filter(h => h.effectiveFrom <= time && (!h.effectiveTo || h.effectiveTo > time));
        // Without event-time ownership, even an apparent zero for NASL can be false. Fail the capture.
        const holder = candidates[0];
        if (candidates.length !== 1 || !holder || holder.holderLegalEntityId || !holder.holderPersonId || !personIds.has(holder.holderPersonId))
            throw new common_1.ServiceUnavailableException('ANALYTICS_EVENT_OWNER_UNAVAILABLE');
        activities.push({ id, qualificationId, personId: holder.holderPersonId, at: time.toISOString(), repurchase });
    };
    for (const o of paid)
        if (o.qualificationId)
            push(`ORDER_PAID:${o.orderId}`, o.qualificationId, o.paidAt, o.purpose === 'REPURCHASE');
    for (const r of recognized)
        push(`REPURCHASE_RECOGNIZED:${r.recognitionId}`, r.subscription.qualificationId, r.recognizedAt, true);
    const prospectPersons = await (0, analytics_prospects_1.captureProspectFacts)(tx, persons, at);
    return { persons: prospectPersons,
        qualifications: qs.flatMap(q => q.currentHolderPersonId === null || q.currentHolderLegalEntityId !== null ? [] : [{ id: q.qualificationId, personId: q.currentHolderPersonId, createdAt: q.createdAt.toISOString(), system: systemIds.has(q.qualificationId), active: q.status === 'EFFECTIVE' && activeIds.has(q.qualificationId) }]),
        activities: activities.sort((a, b) => a.id.localeCompare(b.id)),
        sponsor: sponsor.map(e => ({ parent: e.sponsorQualificationId, child: e.childQualificationId })),
        binary: binary.map(e => ({ parent: e.parentQualificationId, child: e.childQualificationId, side: e.side })),
        issues: ['FORMAL_APPROVAL_STARTS_N', 'ANONYMOUS_VISITORS_ARE_BROWSER_IDENTITIES', 'SYSTEM_SCOPE_USES_EXPLICIT_POOL', 'ENGAGEMENT_EVENTS_NOT_CONNECTED', 'VOLUME_REQUIRES_SEPARATE_ROOT_PROJECTION', 'LEGAL_ENTITY_ANALYTICS_REQUIRES_PARTY_PROJECTION', ...(prospectPersons.some(p => p.excludeFromLifecycle) ? ['FORMAL_APPROVAL_DATE_MISSING'] : [])] };
}
//# sourceMappingURL=analytics.source.js.map