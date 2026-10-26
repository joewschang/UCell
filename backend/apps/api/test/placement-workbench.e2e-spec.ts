import {memberPlacementBranch,placementMonitor} from '../src/modules/qualification/placement-workbench';
import {QualificationAccessService} from '../src/modules/auth/qualification-access.service';
import {currentTreeState} from '../src/modules/binary-tree/current-tree';
jest.mock('../src/modules/binary-tree/current-tree',()=>({currentTreeState:jest.fn()}));
afterEach(()=>jest.restoreAllMocks());
it('authorizes sponsor ownership before reading and exposes only member-safe branch fields',async()=>{
 const holder=jest.spyOn(QualificationAccessService.prototype,'assertHolder').mockResolvedValue(undefined as never);
 const db={qualification:{findUnique:jest.fn().mockResolvedValue({qualificationId:'q',ballNo:'A000010',ballAllocation:{binaryTreeId:'tree'}})},qualificationSetup:{findUnique:jest.fn().mockResolvedValue({finalSponsorQualificationId:'sponsor'})}};
 (currentTreeState as jest.Mock).mockImplementation(async(_db,commands)=>{await commands.authorize();return {observedAt:'now',pending:{secret:'other members'},candidate:{ballNo:'A000010',sponsorBallNo:'A000001',sequence:2,blocked:null},breadcrumbs:[{ballNo:'A000001'}],nodes:[{ballNo:'A000001',qualificationId:'private',kind:'MEMBER_ORIGIN',position:'8',slots:[]}]}});
 const result=await memberPlacementBranch(db,'person','P10');expect(holder).toHaveBeenCalledWith('person','sponsor');expect(result.nodes[0]).not.toHaveProperty('qualificationId');expect(result).not.toHaveProperty('pending');expect(holder).toHaveBeenCalledTimes(2);
 holder.mockRejectedValue(new Error('denied'));(currentTreeState as jest.Mock).mockClear();await expect(memberPlacementBranch(db,'stranger','P10')).rejects.toThrow('denied');expect(currentTreeState).not.toHaveBeenCalled();
});
it('rejects invalid references without database access',async()=>{await expect(memberPlacementBranch({},'person','P9999999999999999999')).rejects.toMatchObject({response:{code:'PLACEMENT_REFERENCE_INVALID'}})});
it('filters overdue before pagination and returns identifiers and cursor',async()=>{
 const now=new Date('2026-10-23T00:00:00Z'),rows=[1,2,3].map(n=>({qualificationId:'q'+n,finalSponsorQualificationId:'s',setupStatus:'PLACEMENT_PENDING',placementDueAt:new Date(0)}));
 const db={qualificationSetup:{findMany:jest.fn().mockResolvedValue(rows),count:jest.fn().mockResolvedValue(3)},qualification:{findMany:jest.fn().mockResolvedValue([{qualificationId:'q1',ballNo:'A000001',currentHolder:{memberNo:'member'},ballAllocation:{binaryTreeId:'tree'}},{qualificationId:'s',ballNo:'AX000001'}])}};
 const result=await placementMonitor(db,{status:'PLACEMENT_OVERDUE',take:2},now);expect(result.nextCursor).toBe('q2');expect(result.items).toHaveLength(2);expect(result.items[0]).toMatchObject({ballNo:'A000001',sponsorBallNo:'AX000001',status:'PLACEMENT_OVERDUE'});expect(db.qualificationSetup.findMany.mock.calls[0][0].where.AND[1].OR[1].placementDueAt.lte).toEqual(now);
});
