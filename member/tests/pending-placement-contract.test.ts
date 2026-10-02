import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {getPendingPlacements,placePendingQualification} from '../src/memberData';
import {memberApi} from '../src/memberApi';
vi.mock('../src/memberApi',()=>({memberApi:vi.fn()}));
const request=vi.mocked(memberApi);
beforeEach(()=>request.mockReset());
afterEach(()=>vi.restoreAllMocks());
it('accepts an unnumbered pending qualification with a numeric placement reference',async()=>{
 request.mockResolvedValue([{pendingBallNo:null,placementReference:'P42',pendingMemberNo:'2609000001',packageType:'STARTER',sponsorBallNo:'TREE-AX000001',paymentState:'CONFIRMED',requestedAt:null,dueAt:null,placedAt:null,status:'PLACEMENT_PENDING',agingBucket:'0_24H',policyVersion:'V1'}]);
 expect((await getPendingPlacements(new AbortController().signal))[0]).toMatchObject({pendingBallNo:null,placementReference:'P42'});
});
it('submits the reference and accepts the newly allocated multi-character-tree Ball number',async()=>{
 request.mockResolvedValue({ballNo:'TREE-A000042',binaryParentBallNo:'TREE-AX000002',side:'LEFT',placedAt:'2026-09-25T00:00:00Z',evidenceHash:'a'.repeat(64)});
 expect(await placePendingQualification('P42','TREE-AX000002','LEFT','retry-key')).toMatchObject({ballNo:'TREE-A000042'});
 expect(request).toHaveBeenCalledWith('/member/placements/pending/P42/place',expect.objectContaining({method:'POST',headers:{'Idempotency-Key':'retry-key'}}));
});
it('rejects malformed references before sending a request',async()=>{
 for(const reference of ['P0','P42\\d','P'+ '9'.repeat(20),'11111111-1111-4111-8111-111111111111']){
  await expect(placePendingQualification(reference,'A000001','LEFT','key')).rejects.toThrow('球編號格式不正確');
 }
 expect(request).not.toHaveBeenCalled();
});
