import { UnprocessableEntityException } from '@nestjs/common';
import type { Prisma } from '@ucell/database';

/** Legacy writers relied on the third-direct rule for scope. Either branch is eligible. */
export async function assertSponsorPlacementScope(
  tx: Prisma.TransactionClient,
  sponsorQualificationId: string,
  sponsorSequenceNo: number,
  binaryParentQualificationId: string,
  effectiveAt = new Date(),
): Promise<void> {
  if (sponsorSequenceNo !== 3 || binaryParentQualificationId === sponsorQualificationId) return;
  const sponsor = await tx.qualification.findUniqueOrThrow({
    where: { qualificationId: sponsorQualificationId },
    select: { kind: true },
  });
  if (sponsor.kind === 'COMPANY_BOOTSTRAP') return;

  const [scope] = await tx.$queryRaw<{ found: boolean }[]>`
    WITH RECURSIVE ancestors(id) AS (
      SELECT ${binaryParentQualificationId}::uuid
      UNION
      SELECT edge.parent_qualification_id
      FROM organization.binary_placement edge
      JOIN ancestors ON edge.child_qualification_id = ancestors.id
      WHERE edge.effective_from <= ${effectiveAt}
        AND (edge.effective_to IS NULL OR edge.effective_to > ${effectiveAt})
    )
    SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = ${sponsorQualificationId}::uuid) AS found
  `;
  if (!scope.found) throw new UnprocessableEntityException({ code: 'SPONSOR_SUBTREE_REQUIRED' });
}
