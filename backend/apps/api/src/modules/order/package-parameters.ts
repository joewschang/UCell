import {UnprocessableEntityException} from '@nestjs/common';
import {Prisma, captureParameters} from '@ucell/database';

/** A recognition policy reference is not a Core rule version or parameter hash. */
export async function resolvePackageParameters(
  tx: Prisma.TransactionClient,
  at: Date,
  version: {recognitionConfigRef: string | null; configHash: string},
  selectedCoreVersions: string[],
) {
  const approved = ['PO_20261019_QUALIFICATION_GPV_ONLY', 'PO_20261019_REPURCHASE_60'];
  if (!version.recognitionConfigRef) throw new UnprocessableEntityException({code: 'CONFIGURATION_PENDING'});
  // Legacy packages retain their historical behavior; this does not rewrite purchases.
  if (!approved.includes(version.recognitionConfigRef)) {
    return {ruleVersionCode: version.recognitionConfigRef, parameterSnapshotHash: version.configHash};
  }
  if (!selectedCoreVersions.length || selectedCoreVersions.some(v => v !== 'R1.0B')) {
    throw new UnprocessableEntityException({code: 'PACKAGE_CORE_RULE_MISMATCH'});
  }
  const snapshot = await captureParameters(tx, at, 'R1.0B');
  const policy = snapshot.parameters.filter(p => p.code === 'OWNER_VOLUME_POLICY_20261019' && p.scope === '*');
  if (policy.length !== 1) throw new UnprocessableEntityException({code: 'PACKAGE_POLICY_CONFIGURATION_PENDING'});
  const value = policy[0].value as any;
  if (value?.gpvRate !== '0.6' || value?.rpvRate !== '0.6' || value?.epvRate !== '0.6' ||
      value?.qualificationPackage?.gpv !== true || value?.qualificationPackage?.rpv !== false ||
      value?.qualificationPackage?.epv !== false || value?.qualificationPackage?.active !== 'PAYMENT_CALENDAR_MONTH_ASIA_TAIPEI') {
    throw new UnprocessableEntityException({code: 'PACKAGE_POLICY_CONFIGURATION_CONFLICT'});
  }
  return {ruleVersionCode: snapshot.ruleVersionCode, parameterSnapshotHash: snapshot.hash};
}
