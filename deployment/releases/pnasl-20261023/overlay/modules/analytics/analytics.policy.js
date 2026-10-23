"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyCounts = exports.ratio = exports.DAY = exports.ANALYTICS_POLICY = void 0;
exports.monthKey = monthKey;
exports.classifyNasl = classifyNasl;
exports.heat = heat;
exports.health = health;
exports.buildSonar = buildSonar;
exports.buildNasl = buildNasl;
/** Management policy, independent of the frozen compensation rules. Change by new version. */
exports.ANALYTICS_POLICY = {
    version: 'UCELL-MGMT-2026-10-PNASL-v2', projectionVersion: 'analytics-pnasl-v2', timezone: 'Asia/Taipei',
    activeDays: 30, lostDays: 90, generations: 12, freshnessSeconds: 900,
    smallSample: 5, elevatedRisk: .5, materialDecline: .10, growingImprovement: .05,
    growthTarget: .10,
    weights: { active: 25, repurchase: 20, growth: 15, risk: 15, balance: 10, depth: 10, engagement: 5 },
    qualifyingEvents: ['ORDER_PAID', 'REPURCHASE_RECOGNIZED'],
    denominatorZero: 'UNAVAILABLE',
    registrationBasis: 'N begins at recorded formal membership approval; P begins at valid share landing or network registration',
    suspendNeverActivated: 'S / NEVER_ACTIVATED between >30 and <=90 days since formal approval',
    activityEligibility: 'Only qualifying events at or after formal approval affect N/A/S/L; pre-approval purchases do not activate prospects',
    repurchaseBasis: 'REPURCHASE order paid or subscription installment recognized in rolling 30 days',
    refundSemantics: 'A historical payment is engagement evidence even after a return; no net-sales inference',
};
exports.DAY = 86_400_000;
const ratio = (n, d) => d === 0 ? null : n / d;
exports.ratio = ratio;
const emptyCounts = () => ({ P: 0, N: 0, A: 0, S: 0, L: 0 });
exports.emptyCounts = emptyCounts;
function monthKey(date) {
    const parts = new Intl.DateTimeFormat('en', { timeZone: exports.ANALYTICS_POLICY.timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(date));
    return `${parts.find(x => x.type === 'year').value}-${parts.find(x => x.type === 'month').value}`;
}
function classifyNasl(person, lastActivity, asOf) {
    if (person.formalAt === null)
        return { state: 'P', reason: person.anonymous ? 'ANONYMOUS_SHARE_VISITOR' : 'NETWORK_PROSPECT', joinedMonth: monthKey(person.prospectAt ?? person.joinedAt) };
    if (person.formalAt && lastActivity && lastActivity < person.formalAt)
        lastActivity = undefined;
    const joinedAt = person.formalAt ?? person.joinedAt;
    const age = (Date.parse(asOf) - Date.parse(joinedAt)) / exports.DAY;
    const idle = lastActivity === undefined ? age : (Date.parse(asOf) - Date.parse(lastActivity)) / exports.DAY;
    if (!Number.isFinite(age) || age < 0 || !Number.isFinite(idle) || idle < 0)
        throw new Error('INVALID_ANALYTICS_TIME');
    const result = (state, reason) => ({ state, reason, joinedMonth: monthKey(joinedAt) });
    if (person.closed)
        return result('L', 'RELATIONSHIP_CLOSED');
    if (lastActivity !== undefined && idle <= 30)
        return result('A', 'QUALIFYING_ACTIVITY_30D');
    if (age <= 30)
        return result('N', 'NEW_NOT_YET_ACTIVE');
    if (idle <= 90)
        return result('S', lastActivity ? 'PREVIOUSLY_ACTIVE' : 'NEVER_ACTIVATED');
    return result('L', lastActivity ? 'INACTIVE_OVER_90D' : 'NEVER_ACTIVATED_OVER_90D');
}
function heat(active, repurchase, risk, n, delta = null) {
    if (n < exports.ANALYTICS_POLICY.smallSample)
        return { label: 'INSUFFICIENT_SAMPLE', reason: 'FEWER_THAN_5_QUALIFICATIONS' };
    if (active === null || repurchase === null || risk === null)
        return { label: 'UNAVAILABLE', reason: 'MISSING_METRIC' };
    if (active < .30 && risk >= .5)
        return { label: 'CRITICAL', reason: 'ACTIVE_LT_30_AND_RISK_GE_50' };
    if (active < .40)
        return { label: 'COLD', reason: 'ACTIVE_LT_40' };
    if (active < .55 || (delta !== null && delta <= -.10))
        return { label: 'COOLING', reason: 'ACTIVE_LT_55_OR_DECLINE_10PP' };
    // HOT requires comparison evidence. High current values alone do not prove no negative trend.
    if (active >= .75 && repurchase >= .65 && delta !== null && delta > -.10)
        return { label: 'HOT', reason: 'ACTIVE_GE_75_REPURCHASE_GE_65_NO_DECLINE' };
    return { label: 'WATCH', reason: delta === null ? 'TREND_BASELINE_REQUIRED' : 'HOT_CRITERIA_NOT_MET' };
}
function health(components) {
    const rows = Object.entries(exports.ANALYTICS_POLICY.weights).map(([key, weight]) => ({ key, weight, value: components[key] }));
    const coverage = rows.filter(x => x.value !== null).reduce((sum, x) => sum + x.weight, 0);
    return { components: rows, coverage, score: coverage === 100 ? rows.reduce((sum, x) => sum + x.value * x.weight, 0) : null,
        reason: coverage === 100 ? null : 'INCOMPLETE_COMPONENTS_NO_REWEIGHTING' };
}
function generationMetrics(generation, qualifications, states, recent, asOf) {
    const human = qualifications.filter(q => !q.system), persons = [...new Set(human.map(q => q.personId))];
    const known = persons.filter(p => states[p]), counts = (0, exports.emptyCounts)();
    for (const p of known)
        counts[states[p].state]++;
    const active = human.filter(q => q.active).length, repurchase = human.filter(q => recent.has(q.id)).length;
    const fresh = human.filter(q => Date.parse(q.createdAt) > Date.parse(asOf) - 30 * exports.DAY).length;
    const activeRate = (0, exports.ratio)(active, human.length), repurchaseRate = (0, exports.ratio)(repurchase, human.length);
    const riskRate = known.length === persons.length ? (0, exports.ratio)(counts.S + counts.L, persons.length) : null;
    return { generation, qualificationCount: human.length, systemCount: qualifications.length - human.length, personCount: persons.length,
        classifiedPersonCount: known.length, nasl: counts, activeCount: active, activeRate, repurchaseCount: repurchase, repurchaseRate,
        newCount: fresh, newRate: (0, exports.ratio)(fresh, human.length), riskRate, heat: heat(activeRate, repurchaseRate, riskRate, human.length),
        qualificationIds: human.map(q => q.id).sort() };
}
function buildSonar(root, tree, facts, states, asOf, previous) {
    const byId = new Map(facts.qualifications.map(q => [q.id, q]));
    if (!byId.has(root))
        throw new Error('ROOT_NOT_FOUND');
    const children = new Map();
    for (const edge of facts[tree]) {
        const list = children.get(edge.parent) ?? [];
        list.push(edge);
        children.set(edge.parent, list);
    }
    const recent = new Set(facts.activities.filter(a => a.repurchase && Date.parse(a.at) >= Date.parse(asOf) - 30 * exports.DAY && Date.parse(a.at) <= Date.parse(asOf)).map(a => a.qualificationId));
    let frontier = [{ id: root }];
    const visited = new Set([root]), all = [], left = [], right = [], generations = [];
    for (let generation = 1; generation <= 12; generation++) {
        const next = [], rows = [];
        for (const node of frontier)
            for (const edge of children.get(node.id) ?? []) {
                if (visited.has(edge.child))
                    throw new Error('ORGANIZATION_CYCLE_OR_DUPLICATE');
                visited.add(edge.child);
                const q = byId.get(edge.child);
                if (!q)
                    throw new Error('ORGANIZATION_DANGLING_EDGE');
                const side = node.side ?? edge.side;
                next.push({ id: q.id, side });
                rows.push(q);
                all.push(q);
                if (side === 'LEFT')
                    left.push(q);
                if (side === 'RIGHT')
                    right.push(q);
            }
        generations.push(generationMetrics(generation, rows, states, recent, asOf));
        frontier = next;
    }
    const total = generationMetrics(0, all, states, recent, asOf), l = generationMetrics(0, left, states, recent, asOf), r = generationMetrics(0, right, states, recent, asOf);
    const balance = tree === 'binary' ? (0, exports.ratio)(2 * Math.min(l.qualificationCount, r.qualificationCount), l.qualificationCount + r.qualificationCount) : null;
    const delta = previous?.activeRate != null && total.activeRate !== null ? total.activeRate - previous.activeRate : null;
    const populated = generations.filter(g => g.qualificationCount > 0);
    const components = { active: total.activeRate, repurchase: total.repurchaseRate,
        growth: total.newRate === null ? null : Math.min(1, total.newRate / exports.ANALYTICS_POLICY.growthTarget),
        risk: total.riskRate === null ? null : 1 - total.riskRate, balance,
        depth: (0, exports.ratio)(populated.filter(g => g.activeRate !== null && g.activeRate >= .55).length, populated.length), engagement: null };
    return { root, tree, generations, total, left: tree === 'binary' ? l : null, right: tree === 'binary' ? r : null, balance,
        activeRateDelta: delta, heat: heat(total.activeRate, total.repurchaseRate, total.riskRate, total.qualificationCount, delta),
        growing: previous?.newRate != null && previous?.repurchaseRate != null && total.newRate !== null && total.repurchaseRate !== null
            ? total.newRate - previous.newRate >= .05 && total.repurchaseRate - previous.repurchaseRate >= .05 : null,
        health: health(components), volume: { pv: null, rpv: null, epv: null, carry: null, reason: 'AUTHORITATIVE_VOLUME_ADAPTER_NOT_CONNECTED' },
        sampleWarning: total.qualificationCount < 5 ? 'SMALL_SAMPLE' : null };
}
function buildNasl(facts, asOf, previous) {
    const last = new Map();
    for (const activity of facts.activities) {
        if (Date.parse(activity.at) > Date.parse(asOf))
            continue;
        const prev = last.get(activity.personId);
        if (!prev || activity.at > prev)
            last.set(activity.personId, activity.at);
    }
    const humanOwners = new Set(facts.qualifications.filter(q => !q.system).map(q => q.personId));
    const systemOwners = new Set(facts.qualifications.filter(q => q.system).map(q => q.personId));
    const included = facts.persons.filter(p => !p.excludeFromLifecycle && (p.registered || humanOwners.has(p.id)) && (!systemOwners.has(p.id) || humanOwners.has(p.id)));
    // A formerly anonymous visitor may now have a bound identity. Collapse its old
    // snapshot aliases before comparing, so registration is not a removal + entrant.
    let identityMerges = 0;
    if (previous) {
        const original = Object.keys(previous).length;
        previous = { ...previous };
        for (const p of included) {
            for (const alias of p.aliases ?? []) {
                if (previous[alias]) {
                    previous[p.id] ??= previous[alias];
                    delete previous[alias];
                }
            }
        }
        identityMerges = original - Object.keys(previous).length;
    }
    const states = {}, counts = (0, exports.emptyCounts)(), cohorts = {};
    let neverActivated = 0;
    for (const p of included) {
        const state = classifyNasl(p, last.get(p.id), asOf);
        states[p.id] = state;
        counts[state.state]++;
        if (state.reason === 'NEVER_ACTIVATED')
            neverActivated++;
        if (state.state !== 'P') {
            const cohort = cohorts[state.joinedMonth] ??= { total: 0, counts: (0, exports.emptyCounts)() };
            cohort.total++;
            cohort.counts[state.state]++;
        }
    }
    const transitions = {};
    let newEntrants = 0, reactivated = 0, becameLost = 0, comparable = 0, previousActive = 0, retainedActive = 0;
    const removed = previous ? Object.keys(previous).filter(id => !states[id]).length : 0;
    if (previous)
        for (const [id, state] of Object.entries(states)) {
            const old = previous[id];
            if (!old) {
                newEntrants++;
                continue;
            }
            comparable++;
            transitions[`${old.state}->${state.state}`] = (transitions[`${old.state}->${state.state}`] ?? 0) + 1;
            if ((old.state === 'S' || old.state === 'L') && state.state === 'A')
                reactivated++;
            if (old.state !== 'L' && state.state === 'L')
                becameLost++;
            if (old.state === 'A') {
                previousActive++;
                if (state.state === 'A')
                    retainedActive++;
            }
        }
    return { states, summary: { counts, total: included.length, excludedPersonRecords: facts.persons.length - included.length, neverActivated,
            rates: { P: (0, exports.ratio)(counts.P, included.length), N: (0, exports.ratio)(counts.N, included.length), A: (0, exports.ratio)(counts.A, included.length), S: (0, exports.ratio)(counts.S, included.length), L: (0, exports.ratio)(counts.L, included.length) },
            cohorts: Object.entries(cohorts).sort(([a], [b]) => a.localeCompare(b)).map(([month, c]) => ({ month, ...c, activeRate: (0, exports.ratio)(c.counts.A, c.total) })),
            transitions: previous ? { matrix: transitions, comparable, newEntrants, removed, identityMerges, reactivated, becameLost, activeRetention: (0, exports.ratio)(retainedActive, previousActive) } : null } };
}
//# sourceMappingURL=analytics.policy.js.map