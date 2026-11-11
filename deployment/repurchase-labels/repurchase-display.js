"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatRepurchaseNames = formatRepurchaseNames;
const terms = {
    ACTIVE_QUARTER: '重銷（三個月）', ACTIVE_HALF_YEAR: '重銷（六個月）', ACTIVE_YEAR: '重銷（十二個月）'
};
const previousNames = Object.fromEntries([['ACTIVE_QUARTER', '季重銷', '季活躍', '季方案'], ['ACTIVE_HALF_YEAR', '半年重銷', '半年活躍', '半年方案'],
    ['ACTIVE_YEAR', '年重銷', '年活躍', '一年方案', '年度方案']]
    .flatMap(([code, ...names]) => names.map(name => [name, terms[code]])));
// Format only package/plan fields in JSON responses. Snapshot records and signed originals remain available for audit.
function formatRepurchaseNames(value) {
    if (!value || typeof value !== 'object')
        return;
    if (Array.isArray(value)) {
        value.forEach(formatRepurchaseNames);
        return;
    }
    const code = value.packageCode ?? value.stableCode ?? value.profile?.stableCode;
    const canonical = typeof code === 'string' && Object.prototype.hasOwnProperty.call(terms, code) ? terms[code] : undefined;
    for (const field of ['packageName', 'planName', 'packageDisplayName', 'displayName', 'name', 'label', 'title']) {
        const original = value[field];
        if (typeof original !== 'string')
            continue;
        const isPackage = canonical || value.packageProfileVersionId || value.packageVersionId || value.subscriptionPlanId || value.planCode;
        if (field !== 'packageName' && field !== 'planName' && field !== 'packageDisplayName' && !isPackage)
            continue;
        if (canonical || Object.prototype.hasOwnProperty.call(previousNames, original))
            value[field] = canonical ?? previousNames[original];
    }
    Object.values(value).forEach(formatRepurchaseNames);
}
