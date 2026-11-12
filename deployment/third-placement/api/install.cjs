'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const checksums = {
  'organization/organization.service': '513f22a96bf520fffff31774c549b090a0296d5e7620c08eb51f686d33da2b0a',
  'binary-tree/current-tree': 'c4f4f7af83445d0efe295da6104a96a492f310a9b03c027fe9b204f0f83e1837',
  'qualification/leaf-correction': '43cb4d197940aafb7634c6a57159de4efa79d670830625c19bf52e941f978340',
  'application/membership-application.service': 'f031fd1e4b9dbc8d8aad6d10fbc8b75b71c3d28ee36a1160891226e65f2dd730',
  'binary-tree/binary-tree.service': 'f765243bfcb77e1388ffa77da6b6102d409310fe71bf3ef636beebf679e53c87',
  'qualification/place-deferred-qualification': 'bde247d9cd39a6091fc9f30abfc5ab513bb461ab53cc671f445736c2c461083a',
  'qualification/qualification-placement.service': '023e1a554591debbc83632dac53d4a025b016fe05c86fa469814fc624d4fcea4',
  'qualification/qualification.service': '82cd3c0cd877d830e5a59ce5bd2f9f3add4d5b7718441cfe52f457ae798971a7',
  'qualification/system-assignment.service': '29e46a18c9af2dd5c0fdf912d7c3ed08d5e77b2a801fc4584aeefc07f1de579b',
};

// Use the same instant for the scope check and the placement record. Previews use now.
function updateCalls(text, times) {
  let calls = 0;
  const updated = text.replace(/assertFirstThirdLeftRule\((tx, [^;\n]+?), (?:side|input\.side|slot\.side)\);/g, (_, args) => {
    const instant = times[calls++];
    return 'assertSponsorPlacementScope(' + args + (instant ? ', ' + instant : '') + ');';
  });
  assert.equal(calls, times.length);
  return updated;
}
function patch(rel, original) {
  assert.equal(createHash('sha256').update(original).digest('hex'), checksums[rel], rel + ' drift');
  if (rel === 'organization/organization.service') {
    const start = original.indexOf('    async assertFirstThirdLeftRule(');
    const end = original.indexOf('\n};', start);
    assert(start > 0 && end > start);
    const method = '    assertSponsorPlacementScope = require("./sponsor-placement-scope").assertSponsorPlacementScope;';
    const updated = original.slice(0, start) + method + original.slice(end);
    const response = "firstThirdLeftRequired: sponsor.kind !== 'COMPANY_BOOTSTRAP' && nextSponsorSequenceNo === 3";
    assert.equal(updated.split(response).length, 3);
    return updateCalls(updated.replaceAll(response, 'firstThirdLeftRequired: false'), [null]);
  }
  if (rel === 'qualification/qualification.service' || rel === 'qualification/system-assignment.service')
    return updateCalls(original, ['effectiveAt']);
  if (rel === 'binary-tree/binary-tree.service') return updateCalls(original, ['at', null]);
  if (rel === 'application/membership-application.service') {
    const updated = original.replace(/( +)(await this\.organization\.assertFirstThirdLeftRule\([^;]+;)(\r?\n) +const effectiveAt = new Date\(\);/, '$1const effectiveAt = new Date();$3$1$2');
    assert.notEqual(updated, original);
    return updateCalls(updated, ['effectiveAt']);
  }
  if (rel === 'qualification/place-deferred-qualification' || rel === 'qualification/qualification-placement.service') {
    const updated = original.replace(/( +)(await (?:this\.)?organization\.assertFirstThirdLeftRule\([^;]+;)(\r?\n) +const placedAt = new Date\(\), correlationId =/, '$1const placedAt = new Date();$3$1$2$3$1const correlationId =');
    assert.notEqual(updated, original);
    return updateCalls(updated, ['placedAt']);
  }
  const line = rel === 'binary-tree/current-tree'
    ? /[ \t]+if \(!reason && !companySponsor && sequence === 3 && !inSubtree\([^\n]+\r?\n +reason = 'BINARY_LEFT_SUBTREE_REQUIRED';\r?\n/
    : /[ \t]+if \(!companySponsor && sponsor\.sponsorSequenceNo === 3 && [^\n]+\r?\n +throw new common_1\.ConflictException\([^\n]+\r?\n/;
  assert(line.test(original), rel + ' conditional');
  return original.replace(line, '');
}
function install(dist, release) {
  const writes = Object.keys(checksums).map((rel) => {
    const file = path.join(dist, 'modules', rel + '.js');
    return [file, patch(rel, fs.readFileSync(file, 'utf8'))];
  });
  fs.copyFileSync(path.join(release, 'sponsor-placement-scope.js'), path.join(dist, 'modules/organization/sponsor-placement-scope.js'));
  for (const [file, data] of writes) fs.writeFileSync(file, data);
}
module.exports = { install, patch, checksums };
if (require.main === module) install('/app/apps/api/dist', __dirname);
