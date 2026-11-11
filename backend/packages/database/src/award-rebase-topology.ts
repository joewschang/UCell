import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { ReplayEnvelope } from './historical-replay';
import { pending } from './parameter-snapshot';

type SponsorEdge = {childQualificationId: string; sponsorQualificationId: string};
type BinaryEdge = {childQualificationId: string; parentQualificationId: string; side: string};
type Topology = {hash: string; sponsor: SponsorEdge[]; binary: BinaryEdge[]};

export async function binaryCalculationEnvelope(tx: Prisma.TransactionClient, original: ReplayEnvelope) {
  const rebase = await tx.auditEvent.findFirst({where: {
    action: 'AWARD_REBASE_TOPOLOGY', entityType: 'SETTLEMENT_BATCH', entityId: original.sourceId,
  }, orderBy: {occurredAt: 'desc'}});
  if (!rebase) return original;
  const topology = rebase.afterData as unknown as Topology;
  const edges = [
    ...topology.sponsor.map(e => ['S', e.childQualificationId, e.sponsorQualificationId]),
    ...topology.binary.map(e => ['B', e.childQualificationId, e.parentQualificationId, e.side]),
  ].sort();
  const hash = createHash('sha256').update(JSON.stringify(edges)).digest('hex');
  if (hash !== rebase.afterHash || hash !== topology.hash) pending('REBASE_TOPOLOGY_INVALID', 'Rebase topology hash mismatch');
  const sources = (original.evidence.sources as ReplayEnvelope[]).map(source => ({
    ...source, evidence: {...source.evidence, binary: topology.binary},
  }));
  return {...original, evidence: {...original.evidence, sources}};
}
