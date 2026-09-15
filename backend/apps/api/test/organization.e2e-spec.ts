import { OrganizationService } from '../src/modules/organization/organization.service';
import { SideCode } from '@ucell/database';
const tx:any={binaryPlacement:{findFirst:jest.fn()},$queryRaw:jest.fn(),sponsorRelationship:{aggregate:jest.fn()}};
describe('Organization guardrails (P0)',()=>{
  beforeEach(()=>jest.clearAllMocks());
  it('sponsor tree and binary tree remain independent',async()=>{tx.binaryPlacement.findFirst.mockResolvedValue(null);await expect(new OrganizationService({} as any).assertBinarySlotAvailable(tx,'parent',SideCode.LEFT)).resolves.toBeUndefined();expect(tx.sponsorRelationship.aggregate).not.toHaveBeenCalled();});
  it('binary occupied slot is rejected',async()=>{tx.binaryPlacement.findFirst.mockResolvedValue({childQualificationId:'child'});await expect(new OrganizationService({} as any).assertBinarySlotAvailable(tx,'parent',SideCode.LEFT)).rejects.toMatchObject({response:{code:'BINARY_SLOT_OCCUPIED'}});});
  it('binary cycle is rejected',async()=>{tx.$queryRaw.mockResolvedValue([{found:true}]);await expect(new OrganizationService({} as any).assertNoBinaryCycle(tx,'child','parent')).rejects.toMatchObject({response:{code:'DOMAIN_RULE_VIOLATION'}});});
  it('1st and 3rd direct recruit must be within sponsor LEFT subtree',async()=>{await expect(new OrganizationService({} as any).assertFirstThirdLeftRule(tx,'sponsor',1,'sponsor',SideCode.RIGHT)).rejects.toMatchObject({response:{code:'BINARY_LEFT_SUBTREE_REQUIRED'}});});
  it('sponsor sequence is permanent and never renumbered after exit',async()=>{tx.$queryRaw.mockResolvedValue(undefined);tx.sponsorRelationship.aggregate.mockResolvedValue({_max:{sponsorSequenceNo:3}});await expect(new OrganizationService({} as any).allocateSponsorSequence(tx,'sponsor')).resolves.toBe(4);});
});
