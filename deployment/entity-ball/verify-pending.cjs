'use strict';
const assert = require('node:assert/strict');
const base = '/app/apps/api/dist/';
const { PrismaClient } = require('/app/packages/database/node_modules/@prisma/client');
const { placementReadyIds } = require(base + 'common/utils/placement-ready');
const { BinaryTreeService } = require(base + 'modules/binary-tree/binary-tree.service');
const { OrganizationService } = require(base + 'modules/organization/organization.service');
const payee = require(base + 'modules/nhi-payout/entity-payee');
const db = new PrismaClient();
async function verify(ballNo) {
  const q = await db.qualification.findFirstOrThrow({where:{ballNo}});
  assert.equal(q.kind,'MEMBER_ORIGIN');
  assert.ok(q.currentHolderLegalEntityId);
  assert.ok((await placementReadyIds(db)).includes(q.qualificationId),'pending queue');
  const group = {legalEntityId:q.currentHolderLegalEntityId,lines:[{qualificationId:q.qualificationId}]};
  assert.equal(await payee.changedOwner(db,group),false);
  for (const sample of [{kind:'COMPANY_BOOTSTRAP'},{kind:'MEMBER_ORIGIN',currentHolderPersonId:{not:null}}]) {
    const other = await db.qualification.findFirstOrThrow({where:sample});
    assert.equal(await payee.changedOwner(db,{...group,lines:[{qualificationId:other.qualificationId}]}),true);
  }
  const sponsor = await db.sponsorRelationship.findUniqueOrThrow({where:{childQualificationId:q.qualificationId}});
  const member = await db.binaryTreeMembership.findUniqueOrThrow({where:{qualificationId:sponsor.sponsorQualificationId}});
  const tree = await db.binaryTree.findUniqueOrThrow({where:{binaryTreeId:member.binaryTreeId}});
  const service = new BinaryTreeService(db,null,new OrganizationService(db));
  // Isolate the placement business rules from HTTP/session authentication.
  service.authorize = async () => {};
  const parents = await db.binaryTreeMembership.findMany({where:{binaryTreeId:tree.binaryTreeId},orderBy:{binaryPositionNo:'asc'}});
  const errors = new Set();
  for(const parent of [member,...parents.filter(p=>p.qualificationId!==member.qualificationId)]) {
    for(const side of ['LEFT','RIGHT']) {
      try {
        const preview = await service.preview(null,tree.binaryTreeId,{qualificationId:q.qualificationId,binaryParentQualificationId:parent.qualificationId,side,expectedVersion:tree.topologyVersion});
        assert.equal(preview.valid,true);
        const rollback = Error('verification complete');
        await assert.rejects(db.$transaction(async tx => {
          await service.organization.createBinaryPlacement(tx,{
            parentQualificationId:parent.qualificationId,childQualificationId:q.qualificationId,side,effectiveFrom:new Date()
          },{actorType:'SYSTEM',reason:'rollback verification',sourceType:'TREE_PLACEMENT_CONSOLE',correlationId:require('node:crypto').randomUUID()});
          await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
          assert.ok(await tx.binaryTreeMembership.findUnique({where:{qualificationId:q.qualificationId}}));
          throw rollback;
        }), e => e === rollback);
        assert.equal(await db.binaryTreeMembership.findUnique({where:{qualificationId:q.qualificationId}}),null);
        console.log(JSON.stringify({ballNo,queue:true,ownerChecks:true,placementPreview:true,writeRolledBack:true}));
        return;
      } catch(e) {errors.add(e.response?.code ?? e.message);}
    }
  }
  throw Error([...errors].join(','));
}
verify(process.argv[2]).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
