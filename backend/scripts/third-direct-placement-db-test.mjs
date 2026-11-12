import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const require = createRequire(new URL('../package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const url = new URL(process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
assert.match(process.env.GOLDEN_ISOLATION_DATABASE, /^ucell_dev_golden_[a-f0-9]{32}$/);
assert.equal(url.pathname, '/' + process.env.GOLDEN_ISOLATION_DATABASE);
const db = new PrismaClient();
const at = new Date('2026-11-12T08:00:00Z');
const earlier = new Date(at.getTime() - 1000);
const later = new Date(at.getTime() + 1000);
const rollback = new Error('Roll back successful test insertion');

async function place({
  sequence = 3,
  parent = 'sponsor',
  side = 'RIGHT',
  company = false,
  edgeFrom = earlier,
  edgeTo = null,
}) {
  await db.$transaction(async (tx) => {
    const person = await tx.person.create({ data: { legalName: 'TEST ONLY' } });
    const ball = async () =>
      (
        await tx.qualification.create({
          data: { currentHolderPersonId: person.personId, planLevelCode: 'STARTER' },
        })
      ).qualificationId;
    let sponsor = await ball();
    if (company) {
      const principal = await tx.companyPrincipal.findFirstOrThrow();
      sponsor = (
        await tx.qualification.create({
          data: {
            kind: 'COMPANY_BOOTSTRAP',
            currentCompanyPrincipalId: principal.companyPrincipalId,
          },
        })
      ).qualificationId;
    }
    const candidate = await ball();
    let parentId = sponsor;
    if (parent !== 'sponsor') {
      parentId = await ball();
      if (parent !== 'outside') {
        const branch = await ball();
        await tx.binaryPlacement.create({
          data: {
            parentQualificationId: sponsor,
            childQualificationId: branch,
            side: parent,
            effectiveFrom: edgeFrom,
            effectiveTo: edgeTo,
          },
        });
        await tx.binaryPlacement.create({
          data: {
            parentQualificationId: branch,
            childQualificationId: parentId,
            side: 'RIGHT',
            effectiveFrom: earlier,
          },
        });
      }
    }
    await tx.sponsorRelationship.create({
      data: {
        sponsorQualificationId: sponsor,
        childQualificationId: candidate,
        sponsorSequenceNo: sequence,
        effectiveFrom: earlier,
      },
    });
    await tx.$executeRaw`INSERT INTO organization.binary_placement
      (binary_placement_id,parent_qualification_id,child_qualification_id,side,effective_from)
      VALUES (${randomUUID()}::uuid,${parentId}::uuid,${candidate}::uuid,${side}::organization."SideCode",${at})`;
    throw rollback;
  });
}

try {
  for (const parent of ['sponsor', 'LEFT', 'RIGHT']) {
    for (const side of ['LEFT', 'RIGHT'])
      await assert.rejects(place({ parent, side }), (e) => e === rollback);
  }
  for (const options of [
    { parent: 'outside' },
    { parent: 'RIGHT', edgeFrom: later },
    { parent: 'LEFT', edgeTo: at },
  ]) {
    await assert.rejects(
      place(options),
      (e) => e.meta?.code === '23514' && e.meta?.message.includes('SPONSOR_SUBTREE_REQUIRED'),
    );
  }
  for (const options of [
    { sequence: 1 },
    { sequence: 2, parent: 'outside' },
    { parent: 'outside', company: true },
  ]) {
    await assert.rejects(place(options), (e) => e === rollback);
  }
  console.log(
    'THIRD_DIRECT_DB_PASS: both sides at root and descendants, effective ancestry, outside subtree, other sequences and company sponsor',
  );
} finally {
  await db.$disconnect();
}
