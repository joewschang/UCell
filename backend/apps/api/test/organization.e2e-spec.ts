import { OrganizationController } from '../src/modules/organization/organization.controller';
import { OrganizationService } from '../src/modules/organization/organization.service';
import { SideCode } from '@ucell/database';
describe('Organization guardrails (P0)', () => {
  it('sponsor tree and binary tree remain independent', async () => {
    const tx = { binaryTreeMembership: { findUnique: jest.fn(async()=>null) },
      qualification: { findUnique: jest.fn(async ({ where }: any) => ({ qualificationId: where.qualificationId, currentHolder: { personId: where.qualificationId + '-holder' } })) },
      sponsorRelationship: { aggregate: jest.fn(async () => ({ _max: { sponsorSequenceNo: 1 } })) },
      binaryPlacement: { findFirst: jest.fn(async () => null) },
    };
    const service = new OrganizationService({ $transaction: async (work: any) => work(tx) } as any);
    const result = await service.previewPlacement({ sponsorQualificationId: 'sponsor-A', binaryParentQualificationId: 'parent-B', binarySide: 'LEFT' });
    expect(result).toMatchObject({ valid: true, nextSponsorSequenceNo: 2, sponsor: { qualificationId: 'sponsor-A' }, binaryParent: { qualificationId: 'parent-B' } });
    expect(tx.sponsorRelationship.aggregate).toHaveBeenCalledWith({ where: { sponsorQualificationId: 'sponsor-A' }, _max: { sponsorSequenceNo: true } });
    expect(tx.binaryPlacement.findFirst).toHaveBeenCalledWith({ where: { parentQualificationId: 'parent-B', side: 'LEFT', effectiveTo: null }, select: { childQualificationId: true } });
  });
  it('binary occupied slot is rejected',async()=>{
    const findFirst=jest.fn(async()=>({childQualificationId:'occupied'}));
    await expect(new OrganizationService({} as any).assertBinarySlotAvailable({binaryPlacement:{findFirst}} as any,'parent',SideCode.RIGHT)).rejects.toMatchObject({response:{code:'BINARY_SLOT_OCCUPIED'}});
    expect(findFirst).toHaveBeenCalledWith({where:{parentQualificationId:'parent',side:SideCode.RIGHT,effectiveTo:null},select:{childQualificationId:true}});
  });
  it('binary cycle is rejected',async()=>{
    const service=new OrganizationService({} as any),query=jest.fn(async()=>[{found:true}]);
    await expect(service.assertNoBinaryCycle({$queryRaw:query} as any,'child','parent')).rejects.toMatchObject({response:{code:'DOMAIN_RULE_VIOLATION'}});
    await expect(service.assertNoBinaryCycle({$queryRaw:query} as any,'child','child')).rejects.toMatchObject({response:{code:'DOMAIN_RULE_VIOLATION'}});
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('1st and 3rd direct recruit must be within sponsor LEFT subtree',async()=>{
    const service=new OrganizationService({} as any),tx={binaryPlacement:{findFirst:jest.fn(async()=>({childQualificationId:'left'}))},$queryRaw:jest.fn(async()=>[{found:false}])};
    for(const sequence of [1,3]){
      await expect(service.assertFirstThirdLeftRule(tx as any,'sponsor',sequence,'sponsor',SideCode.RIGHT)).rejects.toMatchObject({response:{code:'BINARY_LEFT_SUBTREE_REQUIRED'}});
      await expect(service.assertFirstThirdLeftRule(tx as any,'sponsor',sequence,'outside',SideCode.LEFT)).rejects.toMatchObject({response:{code:'BINARY_LEFT_SUBTREE_REQUIRED'}});
      await expect(service.assertFirstThirdLeftRule(tx as any,'sponsor',sequence,'sponsor',SideCode.LEFT)).resolves.toBeUndefined();
    }
    await expect(service.assertFirstThirdLeftRule(tx as any,'sponsor',2,'sponsor',SideCode.RIGHT)).resolves.toBeUndefined();
  });
  it('sponsor sequence is permanent and never renumbered after exit',async()=>{
    const aggregate=jest.fn(async()=>({_max:{sponsorSequenceNo:7}})),query=jest.fn(async()=>[]),tx={$queryRaw:query,sponsorRelationship:{aggregate}};
    expect(await new OrganizationService({} as any).allocateSponsorSequence(tx as any,'sponsor')).toBe(8);
    // Closed recruits must remain included: no effectiveTo/status filter is permitted.
    expect(aggregate).toHaveBeenCalledWith({where:{sponsorQualificationId:'sponsor'},_max:{sponsorSequenceNo:true}});
    expect(query).toHaveBeenCalledTimes(1);
  });
});



describe('Organization legacy placement endpoint', () => {
  it('delegates to the canonical admin placement command and preserves replay metadata', async () => {
    const placement = {
      placeByAdmin: jest.fn(async () => ({ value: { placementEvidenceId: 'evidence-1' }, replayed: true })),
    };
    const controller = new OrganizationController({} as any, placement as any);
    const dto = {
      qualificationId: '11111111-1111-4111-8111-111111111111',
      binaryParentQualificationId: '22222222-2222-4222-8222-222222222222',
      side: 'LEFT' as const,
      reasonCode: 'ADMIN_APPROVED',
    };

    await expect(controller.place(dto, 'idempotency-key-1', {
      user: { personId: 'admin-1' },
      requestId: 'request-1',
    })).resolves.toEqual({ data: { placementEvidenceId: 'evidence-1' }, meta: { replayed: true } });
    expect(placement.placeByAdmin).toHaveBeenCalledWith(
      'admin-1',
      dto,
      'idempotency-key-1',
      'request-1',
    );
  });
});
