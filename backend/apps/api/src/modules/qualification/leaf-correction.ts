import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, childPosition } from '@ucell/database';
import { inSubtree } from '../binary-tree/current-tree';

export type CorrectionInput = {
  parentBallNo: string;
  side: 'LEFT' | 'RIGHT';
  reason: string;
  expectedPosition: string;
  expectedVersion: number;
};
export async function correctLeaf(
  tx: Prisma.TransactionClient,
  id: string,
  input: CorrectionInput,
  actor: string,
) {
  const reason = input.reason.trim();
  if (!reason || reason.length > 300)
    throw new BadRequestException('請填寫異動原因（最多 300 字）。');
  const node = await tx.binaryTreeMembership.findUnique({ where: { qualificationId: id } });
  if (!node) throw new NotFoundException('找不到已安置的球。');
  const treeId = node.binaryTreeId;
  await tx.$queryRaw`SELECT binary_tree_id FROM organization.binary_tree WHERE binary_tree_id=${treeId}::uuid FOR UPDATE`;
  const tree = await tx.binaryTree.findUniqueOrThrow({ where: { binaryTreeId: treeId } });
  if (
    tree.status !== 'ACTIVE' ||
    tree.topologyVersion !== input.expectedVersion ||
    node.binaryPositionNo.toString() !== input.expectedPosition
  )
    throw new ConflictException('組織位置已更新，請重新載入後確認。');
  const edge = await tx.binaryPlacement.findUnique({
    where: { childQualificationId: id },
    include: { parent: { select: { ballNo: true } } },
  });
  const child = await tx.qualification.findUniqueOrThrow({
    where: { qualificationId: id },
    include: {
      sponsorRelation: { include: { sponsor: { select: { kind: true } } } },
      canonicalPosition: true,
    },
  });
  if (child.kind !== 'MEMBER_ORIGIN' || child.canonicalPosition || !edge || edge.effectiveTo)
    throw new ConflictException('此球為固定位置或沒有有效安置。');
  if (
    (await tx.binaryPlacement.findFirst({
      where: { parentQualificationId: id, effectiveTo: null },
    })) ||
    (await tx.binaryTreeMembership.findFirst({
      where: {
        binaryTreeId: treeId,
        binaryPositionNo: {
          in: [node.binaryPositionNo * 2n, node.binaryPositionNo * 2n + 1n].filter(
            (n) => n <= 9223372036854775807n,
          ),
        },
      },
    }))
  )
    throw new ConflictException('此球下方已有球，不能更正安置。');
  const parent = await tx.qualification.findUnique({
    where: { ballNo: input.parentBallNo.trim().toUpperCase() },
    include: { binaryTreeMembership: true },
  });
  const pm = parent?.binaryTreeMembership;
  if (
    !parent ||
    parent.status !== 'EFFECTIVE' ||
    !pm ||
    pm.binaryTreeId !== treeId ||
    parent.qualificationId === id
  )
    throw new ConflictException('請選擇同一棵樹中有效的其他父球。');
  const pos = childPosition(pm.binaryPositionNo, input.side);
  if (pos > 9223372036854775807n) throw new ConflictException('此位置超出組織樹深度。');
  if (pos === node.binaryPositionNo) throw new ConflictException('新位置與目前位置相同。');
  const sponsor = child.sponsorRelation;
  const sm =
    sponsor &&
    (await tx.binaryTreeMembership.findUnique({
      where: { qualificationId: sponsor.sponsorQualificationId },
    }));
  const companySponsor = sponsor?.sponsor.kind === 'COMPANY_BOOTSTRAP';
  if (
    !sponsor ||
    sponsor.effectiveTo ||
    sm?.binaryTreeId !== treeId ||
    (!companySponsor && !inSubtree(pm.binaryPositionNo, sm.binaryPositionNo))
  )
    throw new ConflictException('目標位置超出推薦球的安置範圍。');
  if (
    (await tx.binaryTreeMembership.findFirst({
      where: { binaryTreeId: treeId, binaryPositionNo: pos },
    })) ||
    (await tx.binaryPlacement.findFirst({
      where: { parentQualificationId: parent.qualificationId, side: input.side, effectiveTo: null },
    }))
  )
    throw new ConflictException('目標位置已有球。');
  const fixedParent = await tx.treeCanonicalPosition.findFirst({
    where: { binaryTreeId: treeId, occupantQualificationId: parent.qualificationId },
    select: { positionNo: true },
  });
  if (
    fixedParent &&
    (await tx.treeCanonicalPosition.findFirst({
      where: { binaryTreeId: treeId, parentPositionNo: fixedParent.positionNo, side: input.side },
    }))
  )
    throw new ConflictException('目標是保留的創始席位，請選擇一般安置位置。');
  const parentSelf = await tx.binaryTreeAncestry.findFirst({
    where: {
      binaryTreeId: treeId,
      descendantQualificationId: parent.qualificationId,
      ancestorQualificationId: parent.qualificationId,
      depth: 0,
    },
  });
  if (!parentSelf) throw new ConflictException('目標父球的組織資料尚未完整，請重新整理。');
  const nextVersion = tree.topologyVersion + 1;
  const [result] = await tx.$queryRaw<{ id: string; at: Date }[]>`WITH old_rows AS (
  SELECT jsonb_agg(to_jsonb(a)) data FROM organization.binary_tree_ancestry a WHERE binary_tree_id=${treeId}::uuid AND descendant_qualification_id=${id}::uuid
 ), new_rows AS (
  SELECT a.binary_tree_id,a.ancestor_qualification_id,${id}::uuid descendant_qualification_id,a.depth+1 depth,
   CASE WHEN a.depth=0 THEN ${input.side}::organization."SideCode" ELSE a.first_side END first_side,
   m.effective_from,m.recorded_at
  FROM organization.binary_tree_ancestry a JOIN organization.tree_canonical_position c ON c.binary_tree_id=a.binary_tree_id AND c.occupant_qualification_id=a.ancestor_qualification_id
  JOIN organization.binary_tree_membership m ON m.qualification_id=${id}::uuid
  WHERE a.binary_tree_id=${treeId}::uuid AND a.descendant_qualification_id=${parent.qualificationId}::uuid
  UNION ALL SELECT a.* FROM organization.binary_tree_ancestry a WHERE a.descendant_qualification_id=${id}::uuid AND a.depth=0
 ) INSERT INTO organization.leaf_placement_correction(tree_id,child_id,old_parent,new_parent,old_side,new_side,old_position,new_position,
   actor_id,reason,effective_at,topology_version,old_edge,old_ancestry,new_ancestry)
  SELECT ${treeId}::uuid,${id}::uuid,b.parent_qualification_id,${parent.qualificationId}::uuid,b.side,${input.side}::organization."SideCode",
   ${node.binaryPositionNo},${pos},${actor}::uuid,${reason},greatest(date_trunc('milliseconds',clock_timestamp()),date_trunc('milliseconds',b.effective_from)+interval '1 millisecond'),${nextVersion},b,(SELECT data FROM old_rows),(SELECT jsonb_agg(to_jsonb(n)) FROM new_rows n)
  FROM organization.binary_placement b WHERE b.child_qualification_id=${id}::uuid RETURNING id,effective_at AS at`;
  await tx.binaryPlacement.update({
    where: { childQualificationId: id },
    data: {
      parentQualificationId: parent.qualificationId,
      side: input.side,
      effectiveFrom: result.at,
    },
  });
  await tx.binaryTreeMembership.update({
    where: { qualificationId: id },
    data: { binaryPositionNo: pos },
  });
  await tx.binaryTreeAncestry.deleteMany({
    where: { binaryTreeId: treeId, descendantQualificationId: id },
  });
  await tx.$executeRaw`INSERT INTO organization.binary_tree_ancestry SELECT a.* FROM organization.leaf_placement_correction c
  CROSS JOIN LATERAL jsonb_populate_recordset(NULL::organization.binary_tree_ancestry,c.new_ancestry) a WHERE c.id=${result.id}::uuid`;
  await tx.binaryTree.update({
    where: { binaryTreeId: treeId },
    data: { topologyVersion: nextVersion },
  });
  await tx.binaryTreeProjectionCheckpoint.update({
    where: { binaryTreeId: treeId },
    data: {
      sourceVersion: nextVersion,
      dataThrough: result.at,
      recordedAt: result.at,
      status: 'READY',
    },
  });
  return {
    correctionId: result.id,
    binaryTreeId: treeId,
    topologyVersion: nextVersion,
    ballNo: child.ballNo,
    oldParent: edge.parent.ballNo,
    oldSide: edge.side,
    newParent: parent.ballNo,
    newSide: input.side,
    effectiveAt: result.at.toISOString(),
  };
}
