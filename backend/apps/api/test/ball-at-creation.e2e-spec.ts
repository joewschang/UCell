import {allocateCreatedBall} from '../src/modules/qualification/allocate-created-ball';
function fixture(){
 return {binaryTreeMembership:{findUnique:jest.fn(async()=>({binaryTreeId:'tree-a'}))},binaryTree:{findMany:jest.fn(async()=>[{binaryTreeId:'tree-a'}]),findUnique:jest.fn(async()=>({status:'ACTIVE'}))},$queryRaw:jest.fn(async()=>[{ballNo:'A000007'}]),qualification:{update:jest.fn()}};
}
it('allocates the identity using the sponsor tree without activating or placing the qualification',async()=>{
 const tx=fixture();expect(await allocateCreatedBall(tx as any,'new-q','sponsor')).toBe('A000007');
 expect(tx.$queryRaw.mock.calls[0]).toEqual([expect.anything(),'tree-a','new-q']);
 expect(tx.qualification.update).toHaveBeenCalledWith({where:{qualificationId:'new-q'},data:{ballNo:'A000007'}});
 expect(tx.binaryTree.findMany).not.toHaveBeenCalled();
});
it('allows paper creation only with a single active tree when sponsor is not selected',async()=>{
 const tx=fixture();await allocateCreatedBall(tx as any,'new-q');expect(tx.binaryTree.findMany).toHaveBeenCalled();
 tx.binaryTree.findMany.mockResolvedValueOnce([{binaryTreeId:'tree-a'},{binaryTreeId:'tree-b'}]);
 tx.$queryRaw.mockClear();await expect(allocateCreatedBall(tx as any,'new-q')).rejects.toMatchObject({response:{code:'BALL_NUMBER_TREE_REQUIRED'}});expect(tx.$queryRaw).not.toHaveBeenCalled();
});
it('does not guess another tree when the sponsor is unplaced or its tree is closed',async()=>{
 const tx=fixture();tx.binaryTreeMembership.findUnique.mockResolvedValueOnce(null as any);
 await expect(allocateCreatedBall(tx as any,'new-q','sponsor')).rejects.toMatchObject({response:{code:'BALL_NUMBER_TREE_REQUIRED'}});
 tx.binaryTree.findUnique.mockResolvedValueOnce({status:'CLOSED'});
 await expect(allocateCreatedBall(tx as any,'new-q','sponsor')).rejects.toMatchObject({response:{code:'BALL_NUMBER_TREE_REQUIRED'}});
 expect(tx.$queryRaw).not.toHaveBeenCalled();expect(tx.qualification.update).not.toHaveBeenCalled();
});
