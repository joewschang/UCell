'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  Module = require('node:module');
const assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { compile } = require('./prepare-api.cjs');
const [fullDist, pinnedDist, output, candidateDir] = process.argv.slice(2);
const { patchTree, patchWorkbench } = candidateDir
  ? require(path.resolve(candidateDir, 'install-api.cjs'))
  : require('./install-api.cjs');
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, '127.0.0.1');
assert(url.port, 'Disposable PostgreSQL is required');
const req = Module.createRequire(path.resolve(fullDist, 'main.js'));
req('reflect-metadata');
const { PrismaService } = req('@ucell/database'),
  db = new PrismaService();
const units = new Map();
function loadUnit(rel, source) {
  const name = path.resolve(fullDist, rel + '.js'),
    mod = new Module(name);
  mod.filename = name;
  mod.paths = Module._nodeModulePaths(path.dirname(name));
  const old = mod.require.bind(mod);
  mod.require = (id) => units.get(path.resolve(path.dirname(name), id + '.js')) ?? old(id);
  mod._compile(source, name);
  units.set(name, mod.exports);
  return mod.exports;
}
function pinned(rel) {
  return fs.readFileSync(path.join(pinnedDist, rel + '.js'), 'utf8');
}
for (const rel of ['common/utils/placement-ready', 'common/utils/placement-order-number'])
  loadUnit(rel, pinned(rel));
for (const unit of ['placement-time-page', 'placement-monitor']) {
  const source = compile(unit),
    candidate = candidateDir
      ? fs.readFileSync(path.join(candidateDir, unit + '.js'), 'utf8')
      : source;
  assert.equal(candidate, source, 'Candidate/source drift in ' + unit);
  loadUnit('modules/qualification/' + unit, candidate);
}
const { placementMonitor } = loadUnit(
  'modules/qualification/placement-workbench',
  patchWorkbench(pinned('modules/qualification/placement-workbench')),
);
const { currentTreeState } = loadUnit(
  'modules/binary-tree/current-tree',
  patchTree(pinned('modules/binary-tree/current-tree')),
);
const rollback = new Error('QA fixture rollback');
const observed = new Date('2026-11-12T08:00:00Z');
async function seed(tx) {
  assert.equal(
    await tx.qualificationSetup.count(),
    0,
    'Dedicated empty placement QA data required',
  );
  const holder = await tx.person.create({
    data: { legalName: '安置測試會員', membershipState: 'FORMAL_MEMBER', status: 'EFFECTIVE' },
  });
  const company = await tx.companyPrincipal.findFirstOrThrow(),
    profile = await tx.binaryTreeBootstrapProfile.findFirstOrThrow();
  const tree = await tx.binaryTree.create({
    data: {
      treeCode: 'QA_TIME',
      treeName: '安置測試',
      status: 'DRAFT',
      companyPrincipalId: company.companyPrincipalId,
      bootstrapProfileId: profile.bootstrapProfileId,
      bootstrapProfileCode: profile.profileCode,
      bootstrapProfileVersion: String(profile.version),
      bootstrapCompanyBallCount: profile.companyBallCount,
      bootstrapProfileSnapshot: {},
      createdByActorId: randomUUID(),
      effectiveAt: observed,
    },
  });
  const root = await tx.qualification.create({
    data: {
      kind: 'COMPANY_BOOTSTRAP',
      currentCompanyPrincipalId: company.companyPrincipalId,
      status: 'EFFECTIVE',
    },
  });
  const ev = await tx.placementTreeEvidence.create({
    data: {
      binaryTreeId: tree.binaryTreeId,
      binaryPositionNo: 1n,
      qualificationId: root.qualificationId,
      placementKind: 'BOOTSTRAP_ROOT',
      sourceType: 'QA',
      actorType: 'SYSTEM',
      reason: '測試',
      effectiveAt: observed,
      topologyVersion: 1,
      correlationId: randomUUID(),
      evidenceHash: 'a'.repeat(64),
    },
  });
  await tx.binaryTreeMembership.create({
    data: {
      binaryTreeId: tree.binaryTreeId,
      binaryPositionNo: 1n,
      qualificationId: root.qualificationId,
      effectiveFrom: observed,
      placementTreeEvidenceId: ev.placementTreeEvidenceId,
    },
  });
  const all = [];
  for (const [g, status] of ['PLACEMENT_PENDING', 'PLACEMENT_OVERDUE', 'PLACED'].entries()) {
    for (let i = 0; i < 54; i++) {
      const n = g * 100 + i,
        qualId = '00000000-0000-4000-8000-' + String(90000 - n).padStart(12, '0');
      const hour = String(Math.floor(i / 3)).padStart(2, '0');
      const instant = (day) =>
        i >= 52
          ? null
          : '2026-11-' +
            day +
            'T' +
            hour +
            ':12:00.' +
            (i === 48 || i === 49 || i === 50 ? '000111' : i % 3 === 0 ? '000400' : '000120') +
            'Z';
      const requested = instant(g === 0 ? '11' : '08'),
        placed = g === 2 && i !== 51 ? instant('10') : null;
      all.push({ qualificationId: qualId, orderId: randomUUID(), status, requested, placed, n });
    }
  }
  // On page 2 UUID-only filtering used to admit this unpaid ball.
  const bad = {
    ...all[0],
    qualificationId: 'ffffffff-ffff-4fff-bfff-fffffffffff1',
    orderId: randomUUID(),
    n: 999,
    bad: true,
  };
  const rows = [...all, bad];
  await tx.qualification.createMany({
    data: rows.map((r) => ({
      qualificationId: r.qualificationId,
      currentHolderPersonId: holder.personId,
      planLevelCode: 'STARTER',
      status: 'EFFECTIVE',
    })),
  });
  await tx.order.createMany({
    data: rows.map((r) => ({
      orderId: r.orderId,
      qualificationId: r.qualificationId,
      purpose: 'ENTRY',
      status: r.bad ? 'CONFIRMED' : 'PAID',
      paidAt: r.bad ? null : observed,
      grossAmount: '100',
      discountAmount: '0',
      netAmount: '100',
      ruleVersionCode: 'QA',
    })),
  });
  await tx.ballNoAllocation.createMany({
    data: rows.map((r) => ({
      qualificationId: r.qualificationId,
      binaryTreeId: tree.binaryTreeId,
      sequenceNo: BigInt(r.n + 1000),
      ruleVersion: 'TREE_SEQUENCE_V2',
    })),
  });
  await tx.$executeRaw`UPDATE membership.qualification SET ball_no=organization.member_ball_no(qualification_id) WHERE qualification_id=ANY(${rows.map((r) => r.qualificationId)}::uuid[])`;
  await tx.qualificationSetup.createMany({
    data: rows.map((r) => ({
      qualificationId: r.qualificationId,
      ownerPersonId: holder.personId,
      qualifyingOrderId: r.orderId,
      packageType: 'STARTER',
      setupStatus:
        r.status === 'PLACEMENT_OVERDUE' && r.requested && r.n % 2 ? 'PLACEMENT_PENDING' : r.status,
      finalSponsorQualificationId: root.qualificationId,
      setupPolicyVersion: 'QA',
    })),
  });
  await tx.$executeRaw`UPDATE membership.qualification_setup s SET placement_requested_at=u.requested::timestamptz,placement_due_at=u.requested::timestamptz+interval '72 hours',placed_at=u.placed::timestamptz FROM unnest(${rows.map((r) => r.qualificationId)}::uuid[],${rows.map((r) => r.requested)}::text[],${rows.map((r) => r.placed)}::text[]) u(id,requested,placed) WHERE s.qualification_id=u.id`;
  return { all, treeId: tree.binaryTreeId, bad };
}
const byId = (a, b) =>
  a.qualificationId < b.qualificationId ? -1 : a.qualificationId > b.qualificationId ? 1 : 0;
function expected(rows, mode) {
  const field = (r) =>
    mode === 'PLACED' ? r.placed : mode === 'ALL' ? (r.placed ?? r.requested) : r.requested;
  const newest = mode === 'ALL' || mode === 'PLACED';
  return [...rows]
    .sort((a, b) => {
      const x = field(a),
        y = field(b);
      if (x === y) return byId(a, b);
      if (!x) return 1;
      if (!y) return -1;
      return (x < y ? -1 : 1) * (newest ? -1 : 1);
    })
    .map((r) => r.qualificationId);
}
async function run(tx) {
  const { all, treeId, bad } = await seed(tx),
    data = {};
  const scoped = {
    $transaction: async (read, options) => {
      assert.equal(options.isolationLevel, 'RepeatableRead');
      return read(tx);
    },
  };
  for (const status of ['ALL', 'PLACED', 'PLACEMENT_PENDING', 'PLACEMENT_OVERDUE']) {
    const pages = [],
      rows = all.filter((r) => status === 'ALL' || r.status === status);
    let after;
    do {
      const page = await placementMonitor(
        scoped,
        { status: status === 'ALL' ? undefined : status, after },
        observed,
      );
      pages.push(page);
      after = page.nextCursor;
      assert(pages.length < 10);
    } while (after);
    data[status] = pages;
    const ids = pages.flatMap((p) => p.items.map((r) => r.qualificationId));
    assert.deepEqual(ids, expected(rows, status), status);
    assert.equal(pages[0].total, rows.length);
    assert.deepEqual(pages[0].counts, { pending: 54, overdue: 54, placed: 54 });
    const legacy = await placementMonitor(
      scoped,
      { status: status === 'ALL' ? undefined : status, after: pages[0].items[49].qualificationId },
      observed,
    );
    assert.deepEqual(legacy.items, pages[1].items, status + ' old UUID');
  }
  await assert.rejects(() =>
    placementMonitor(scoped, { status: 'PLACED', after: data.ALL[0].nextCursor }, observed),
  );
  for (const [aging, min, max] of [
    ['0_24H', 0, 24],
    ['24_48H', 24, 48],
    ['48_72H', 48, 72],
    ['OVERDUE', null, null],
  ]) {
    const rows = all.filter((r) => {
      if (aging === 'OVERDUE') return r.status === 'PLACEMENT_OVERDUE';
      if (r.status === 'PLACED' || !r.requested) return false;
      const hours = (observed.valueOf() - Date.parse(r.requested)) / 3600000;
      return hours >= min && hours < max;
    });
    const page = await placementMonitor(scoped, { aging, take: 100 }, observed);
    assert.equal(page.total, rows.length, aging);
    assert.deepEqual(
      page.items.map((row) => row.qualificationId),
      expected(rows, 'ALL').slice(0, 100),
      aging,
    );
  }
  const scopedTree = scoped,
    access = { authorize: async () => {} },
    pages = [];
  let after;
  do {
    const tree = await currentTreeState(scopedTree, access, {}, treeId, { after }, true);
    pages.push(tree);
    after = tree.pending.nextCursor;
    assert(pages.length < 10);
  } while (after);
  const ids = pages.flatMap((p) => p.pending.items.map((r) => r.qualificationId));
  assert.deepEqual(
    ids,
    expected(
      all.filter((r) => r.status !== 'PLACED'),
      'waiting',
    ),
  );
  assert(!ids.includes(bad.qualificationId));
  data.perTree = pages;
  const last = pages[0].pending.items[49].qualificationId;
  await tx.qualificationSetup.update({
    where: { qualificationId: last },
    data: { setupStatus: 'PLACED', placedAt: observed },
  });
  const continued = await currentTreeState(scopedTree, access, {}, treeId, { after: last }, true);
  assert.deepEqual(
    continued.pending.items,
    pages[1].pending.items,
    'Previous last candidate placed before continuation',
  );
  await assert.rejects(() =>
    currentTreeState(scopedTree, access, {}, treeId, { after: randomUUID() }, true),
  );
  if (output) fs.writeFileSync(output, JSON.stringify(data));
  console.log(
    'PASS four dashboard filters, true UTC microseconds, nulls last, equal timestamps, legacy UUIDs, bad cursor, 50-row page boundaries, actual tree-state eligibility on every page; database transaction rolled back',
  );
}
(async () => {
  try {
    await db.$transaction(
      async (tx) => {
        await run(tx);
        throw rollback;
      },
      { timeout: 90000 },
    );
  } catch (e) {
    if (e !== rollback) throw e;
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
