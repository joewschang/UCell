import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@ucell/database';

export type CommercialOfferingSnapshot = {
  commercialOfferingVersionId: string;
  offeringCode: string;
  offeringType: string;
  version: number;
  snapshotHash: string;
  approvalReference: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  channels: unknown;
  composition: unknown;
  selectionRule: unknown;
  recognitionProfile: unknown;
};

@Injectable()
export class CommercialOfferingService {
  async resolveEffective(
    tx: Prisma.TransactionClient,
    input: { offeringCode: string; channel: string; at?: Date },
  ): Promise<CommercialOfferingSnapshot> {
    const at = input.at ?? new Date();
    const offering = await tx.commercialOffering.findUnique({
      where: { offeringCode: input.offeringCode },
      include: {
        versions: {
          where: {
            status: 'ACTIVE',
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });
    if (!offering || offering.status !== 'ACTIVE') {
      throw new ConflictException({ code: 'COMMERCIAL_OFFERING_NOT_AVAILABLE' });
    }
    if (offering.versions.length !== 1) {
      throw new UnprocessableEntityException({ code: 'COMMERCIAL_OFFERING_CONFIGURATION_PENDING' });
    }
    const version = offering.versions[0];
    const channels = Array.isArray(version.channels) ? version.channels : [];
    if (!channels.includes(input.channel)) {
      throw new ConflictException({ code: 'COMMERCIAL_OFFERING_CHANNEL_NOT_ALLOWED' });
    }
    return {
      commercialOfferingVersionId: version.commercialOfferingVersionId,
      offeringCode: offering.offeringCode,
      offeringType: offering.offeringType,
      version: version.version,
      snapshotHash: version.snapshotHash,
      approvalReference: version.approvalReference,
      effectiveFrom: version.effectiveFrom.toISOString(),
      effectiveTo: version.effectiveTo?.toISOString() ?? null,
      channels: version.channels,
      composition: version.composition,
      selectionRule: version.selectionRule,
      recognitionProfile: version.recognitionProfile,
    };
  }
}