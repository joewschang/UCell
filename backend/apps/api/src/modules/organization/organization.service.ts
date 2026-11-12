import { assertSponsorPlacementScope } from './sponsor-placement-scope';
import { attachTreePlacement, TreePlacementMeta } from './tree-placement';
import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService, SideCode } from '@ucell/database';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}


  async previewPlacement(input:{
    sponsorQualificationId:string;
    binaryParentQualificationId:string;
    binarySide:'LEFT'|'RIGHT';
  }){
    return this.prisma.$transaction(async tx=>{
      const [sponsor,parent]=await Promise.all([
        tx.qualification.findUnique({
          where:{qualificationId:input.sponsorQualificationId},
          include:{currentHolder:true}
        }),
        tx.qualification.findUnique({
          where:{qualificationId:input.binaryParentQualificationId},
          include:{currentHolder:true}
        }),
      ]);
      if(!sponsor || !parent){
        return {valid:false,code:'RESOURCE_NOT_FOUND',message:'Sponsor或Binary Parent不存在。'};
      }

      const agg=await tx.sponsorRelationship.aggregate({
        where:{sponsorQualificationId:input.sponsorQualificationId},
        _max:{sponsorSequenceNo:true}
      });
      const nextSponsorSequenceNo=(agg._max.sponsorSequenceNo ?? 0)+1;
      const side=input.binarySide as SideCode;

      try{
        const membership=await tx.binaryTreeMembership.findUnique({where:{qualificationId:input.binaryParentQualificationId},include:{binaryTree:true}});
        if(membership && membership.binaryTree.status!=='ACTIVE')throw new ConflictException({code:'TREE_NOT_OPEN_TO_PLACEMENT'});
        if(membership){
          const positions=await tx.treeCanonicalPosition.findMany({where:{binaryTreeId:membership.binaryTreeId}});
          const parentPosition=positions.find(p=>p.occupantQualificationId===input.binaryParentQualificationId);
          const canonical=parentPosition && positions.find(p=>p.parentPositionNo===parentPosition.positionNo && p.side===side);
          const designation=await tx.companySponsorDesignation.findUnique({where:{binaryTreeId:membership.binaryTreeId}});
          if(canonical && input.sponsorQualificationId!==designation?.qualificationId)throw new ConflictException({code:'FOUNDING_COMPANY_SPONSOR_REQUIRED'});
        }
        await this.assertBinarySlotAvailable(tx,input.binaryParentQualificationId,side);
        await this.assertSponsorPlacementScope(
          tx,input.sponsorQualificationId,nextSponsorSequenceNo,
          input.binaryParentQualificationId);
        return {
          valid:true,
          nextSponsorSequenceNo,
          firstThirdLeftRequired:false,
          sponsor:{qualificationId:sponsor.qualificationId,holder:sponsor.currentHolder},
          binaryParent:{qualificationId:parent.qualificationId,holder:parent.currentHolder},
          side,
        };
      }catch(error:any){
        const response=error?.getResponse?.();
        return {
          valid:false,
          nextSponsorSequenceNo,
          firstThirdLeftRequired:false,
          code:response?.code ?? 'PLACEMENT_INVALID',
          message:response?.message ?? error?.message ?? 'Binary placement invalid',
          side,
        };
      }
    });
  }

  async createBinaryPlacement(tx: Prisma.TransactionClient, data: {parentQualificationId:string;childQualificationId:string;side:SideCode;effectiveFrom:Date}, meta:TreePlacementMeta) {
    await attachTreePlacement(tx,data,meta);
    return tx.binaryPlacement.create({data});
  }
  async allocateSponsorSequence(
    tx: Prisma.TransactionClient,
    sponsorQualificationId: string,
  ): Promise<number> {
    // Serialize sequence allocation per sponsor.
    await tx.$queryRaw`
      SELECT qualification_id
      FROM membership.qualification
      WHERE qualification_id = ${sponsorQualificationId}::uuid
      FOR UPDATE
    `;

    const agg = await tx.sponsorRelationship.aggregate({
      where: { sponsorQualificationId },
      _max: { sponsorSequenceNo: true },
    });
    return (agg._max.sponsorSequenceNo ?? 0) + 1;
  }

  async assertBinarySlotAvailable(
    tx: Prisma.TransactionClient,
    parentQualificationId: string,
    side: SideCode,
  ) {
    const existing = await tx.binaryPlacement.findFirst({
      where: { parentQualificationId, side, effectiveTo: null },
      select: { childQualificationId: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'BINARY_SLOT_OCCUPIED',
        message: '指定二元位置已被使用。',
        details: { parentQualificationId, side },
      });
    }
  }

  async assertNoBinaryCycle(
    tx: Prisma.TransactionClient,
    childQualificationId: string,
    parentQualificationId: string,
  ) {
    if (childQualificationId === parentQualificationId) {
      throw new UnprocessableEntityException({
        code: 'DOMAIN_RULE_VIOLATION',
        message: 'Binary parent 不得為自己。',
      });
    }

    const rows = await tx.$queryRaw<Array<{ found: boolean }>>`
      WITH RECURSIVE ancestors AS (
        SELECT bp.parent_qualification_id
        FROM organization.binary_placement bp
        WHERE bp.child_qualification_id = ${parentQualificationId}::uuid
          AND bp.effective_to IS NULL
          AND EXISTS(SELECT 1 FROM organization.binary_placement outgoing
            WHERE outgoing.parent_qualification_id=${childQualificationId}::uuid AND outgoing.effective_to IS NULL)
        UNION ALL
        SELECT bp.parent_qualification_id
        FROM organization.binary_placement bp
        JOIN ancestors a ON bp.child_qualification_id = a.parent_qualification_id
        WHERE bp.effective_to IS NULL
      )
      SELECT EXISTS(
        SELECT 1 FROM ancestors WHERE parent_qualification_id = ${childQualificationId}::uuid
      ) AS found
    `;

    if (rows[0]?.found) {
      throw new UnprocessableEntityException({
        code: 'DOMAIN_RULE_VIOLATION',
        message: 'Binary 安置會形成循環。',
      });
    }
  }

  readonly assertSponsorPlacementScope = assertSponsorPlacementScope;
}
