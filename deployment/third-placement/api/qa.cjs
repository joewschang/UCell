'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const [candidate, dependencyDist] = process.argv.slice(2);
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, '127.0.0.1');
assert(url.port && !url.search, 'Choose the isolated test PostgreSQL cluster');
const req = Module.createRequire(path.resolve(dependencyDist, 'main.js'));
req('reflect-metadata');
const { PrismaService } = req('@ucell/database');
const db = new PrismaService();
const rollback = new Error('Roll back placement fixtures');

function unit(name, stubs = {}) {
  const filename = path.resolve(dependencyDist, 'modules', name + '.js');
  const module = new Module(filename);
  module.filename = filename;
  module.paths = Module._nodeModulePaths(path.dirname(filename));
  const dependencies = module.require.bind(module);
  module.require = (id) => stubs[id] ?? dependencies(id);
  module._compile(fs.readFileSync(path.join(candidate, 'modules', name + '.js'), 'utf8'), filename);
  return module.exports;
}
const scope = unit('organization/sponsor-placement-scope');
const { OrganizationService } = unit('organization/organization.service', {
  './sponsor-placement-scope': scope,
});

async function testSelectionsAndCorrections() {
  const treeId = 'tree';
  const memberNode = (position) => ({
    binaryTreeId: treeId,
    binaryPositionNo: BigInt(position),
    qualificationId: 's' + position,
    qualification: { ballNo: 'B' + position, kind: 'MEMBER_ORIGIN' },
  });
  const sponsor = memberNode(2),
    rightBranch = memberNode(5);
  let node = rightBranch;
  const relation = {
    sponsorQualificationId: sponsor.qualificationId,
    sponsorSequenceNo: 3,
    effectiveFrom: new Date(0),
    sponsor: { ...sponsor.qualification, binaryTreeMembership: sponsor },
  };
  const ball = {
    qualificationId: 'pending',
    kind: 'MEMBER_ORIGIN',
    ballNo: 'pending-ball',
    status: 'DRAFT',
    currentHolder: { membershipState: 'FORMAL_MEMBER' },
    ballAllocation: { binaryTreeId: treeId },
    sponsorRelation: relation,
  };
  const tree = { status: 'ACTIVE', topologyVersion: 5 };
  const tx = {
    binaryTree: { findUnique: async () => tree },
    qualification: { findFirst: async () => ball, findUnique: async () => ball },
    qualificationSetup: {
      findUnique: async () => ({
        setupStatus: 'PLACEMENT_PENDING',
        finalSponsorQualificationId: sponsor.qualificationId,
      }),
    },
    order: { findUnique: async () => ({ paidAt: new Date(), status: 'PAID' }) },
    binaryTreeMembership: {
      findFirst: async () => node,
      findUnique: async (q) =>
        q.where.qualificationId === sponsor.qualificationId ? sponsor : node,
      findMany: async (q) => (q.select ? [] : [node]),
    },
    treeCanonicalPosition: { findMany: async () => [] },
  };
  const api = unit('binary-tree/current-tree', {
    '../../common/utils/placement-ready': { placementReadyIds: async () => [ball.qualificationId] },
    '../qualification/placement-time-page': {
      treePlacementPage: async () => ({ pending: [], pendingTotal: 0 }),
    },
    '../../common/utils/placement-order-number': { attachPlacementOrders: async () => {} },
  });
  const view = () =>
    api.currentTreeState(
      { $transaction: (read) => read(tx) },
      { authorize: async () => {} },
      {},
      treeId,
      { ballNo: node.qualification.ballNo, candidateBallNo: ball.ballNo },
      true,
    );
  for (const pos of [2, 4, 5]) {
    node = memberNode(pos);
    const result = await view();
    assert.equal(result.candidate.sequence, 3);
    assert.deepEqual(result.nodes[0].slots, [
      { side: 'LEFT', reason: null },
      { side: 'RIGHT', reason: null },
    ]);
  }
  node = memberNode(3);
  await assert.rejects(view, (e) => e.getResponse().code === 'SPONSOR_SUBTREE_REQUIRED');

  const writes = [];
  const record = (op) => async (data) => {
    writes.push([op, data]);
  };
  let parent = rightBranch;
  const target = memberNode(8);
  const oldEdge = { side: 'LEFT', parent: { ballNo: 'B4' } };
  const writer = {
    binaryTreeMembership: {
      findUnique: async (q) =>
        q.where.qualificationId === target.qualificationId ? target : sponsor,
      findFirst: async () => null,
      update: record('membership'),
    },
    binaryTree: { findUniqueOrThrow: async () => tree, update: record('tree') },
    qualification: {
      findUniqueOrThrow: async () => ({ ...ball, ballNo: 'B8' }),
      findUnique: async () => ({
        ...parent.qualification,
        qualificationId: parent.qualificationId,
        status: 'EFFECTIVE',
        binaryTreeMembership: parent,
      }),
    },
    binaryPlacement: {
      findUnique: async () => oldEdge,
      findFirst: async () => null,
      update: record('edge'),
    },
    treeCanonicalPosition: { findFirst: async () => null },
    binaryTreeAncestry: { findFirst: async () => ({ depth: 0 }), deleteMany: record('ancestry') },
    binaryTreeProjectionCheckpoint: { update: record('checkpoint') },
    $queryRaw: async (sql) =>
      sql.join(' ').includes('leaf_placement_correction')
        ? [{ id: 'correction', at: new Date() }]
        : [],
    $executeRaw: record('closure'),
  };
  const { correctLeaf } = unit('qualification/leaf-correction', {
    '../binary-tree/current-tree': api,
  });
  const correct = (side) =>
    correctLeaf(
      writer,
      target.qualificationId,
      {
        parentBallNo: parent.qualification.ballNo,
        side,
        reason: 'QA',
        expectedPosition: '8',
        expectedVersion: 5,
      },
      'operator',
    );
  for (const side of ['LEFT', 'RIGHT']) {
    parent = rightBranch;
    const result = await correct(side);
    assert.equal(result.newSide, side);
    assert.equal(result.newParent, 'B5');
  }
  const changes = writes.length;
  parent = memberNode(3);
  await assert.rejects(() => correct('RIGHT'), /超出推薦球/);
  assert.equal(writes.length, changes);
  parent = rightBranch;
  writer.binaryPlacement.findFirst = async () => ({ childQualificationId: 'occupied' });
  await assert.rejects(() => correct('RIGHT'), /已有球/);
  assert.equal(writes.length, changes);
}

async function run(tx) {
  const time = new Date('2026-10-01T05:10:00Z');
  const earlier = new Date(time.valueOf() - 2000),
    later = new Date(time.valueOf() + 2000);
  const p = await tx.person.create({ data: { legalName: 'Placement QA' } });
  async function ball() {
    return (
      await tx.qualification.create({
        data: { currentHolderPersonId: p.personId, planLevelCode: 'STARTER' },
      })
    ).qualificationId;
  }
  const sponsor = await ball(),
    left = await ball(),
    right = await ball(),
    outside = await ball();
  const service = new OrganizationService({ $transaction: (read) => read(tx) });
  for (const sponsorSequenceNo of [1, 2]) {
    await tx.sponsorRelationship.create({
      data: {
        sponsorQualificationId: sponsor,
        childQualificationId: await ball(),
        sponsorSequenceNo,
        effectiveFrom: earlier,
      },
    });
  }
  for (const side of ['LEFT', 'RIGHT']) {
    const preview = await service.previewPlacement({
      sponsorQualificationId: sponsor,
      binaryParentQualificationId: sponsor,
      binarySide: side,
    });
    assert.deepEqual(
      [preview.valid, preview.nextSponsorSequenceNo, preview.firstThirdLeftRequired],
      [true, 3, false],
    );
  }
  const invalid = await service.previewPlacement({
    sponsorQualificationId: sponsor,
    binaryParentQualificationId: outside,
    binarySide: 'RIGHT',
  });
  assert.equal(invalid.code, 'SPONSOR_SUBTREE_REQUIRED');
  for (const [side, child, from, to] of [
    ['LEFT', left, earlier, later],
    ['RIGHT', right, later, null],
  ]) {
    await tx.binaryPlacement.create({
      data: {
        parentQualificationId: sponsor,
        childQualificationId: child,
        side,
        effectiveFrom: from,
        effectiveTo: to,
      },
    });
  }
  const check = (parent, at) => service.assertSponsorPlacementScope(tx, sponsor, 3, parent, at);
  const denied = (fn) =>
    assert.rejects(fn, (e) => e.getResponse().code === 'SPONSOR_SUBTREE_REQUIRED');
  await check(left, earlier);
  await check(left, time);
  await denied(() => check(left, later));
  await denied(() => check(right, time));
  await check(right, later);
  await denied(() => check(outside, later));
  await service.assertSponsorPlacementScope(tx, sponsor, 2, outside, later);
  const occupied = await service.previewPlacement({
    sponsorQualificationId: sponsor,
    binaryParentQualificationId: sponsor,
    binarySide: 'RIGHT',
  });
  assert.equal(occupied.code, 'BINARY_SLOT_OCCUPIED');
  assert.equal(occupied.firstThirdLeftRequired, false);
}
(async () => {
  try {
    await testSelectionsAndCorrections();
    await db.$transaction(async (tx) => {
      await run(tx);
      throw rollback;
    });
  } catch (e) {
    if (e !== rollback) throw e;
  }
  console.log(
    'PASS compiled current-tree selection and leaf correction (both sides, parent & left/right subtrees, outside & occupied guards); compiled R2 actual OrganizationService and PostgreSQL: preview LEFT/RIGHT, sequence=3 and compatibility flag, outside/occupied denial, included start, excluded end, future end and future start, seq2 compatibility.',
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
