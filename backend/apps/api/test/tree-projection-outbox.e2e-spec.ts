import {processTreeProjectionEvent} from '@ucell/database';
const id='10000000-0000-4000-8000-000000000001';
function harness(version=2){
 const lease={outboxEventId:id,attemptCount:2,availableAt:new Date(Date.now()+60000)};
 const event={outboxEventId:id,eventType:'BINARY_TREE_CHANGED',aggregateType:'BinaryTree',aggregateId:id,processStatus:'PROCESSING',attemptCount:2,availableAt:lease.availableAt,payload:{schemaVersion:1,binaryTreeId:id,topologyVersion:version}};
 const checkpoint={status:'READY',sourceVersion:2};
 const tx={$queryRaw:jest.fn(),outboxEvent:{findUnique:jest.fn(async()=>event),findUniqueOrThrow:jest.fn(async()=>event),update:jest.fn()},binaryTree:{findUnique:jest.fn(async()=>({binaryTreeId:id,topologyVersion:2}))},binaryTreeProjectionCheckpoint:{findUnique:jest.fn(async()=>checkpoint)}};
 const db={$transaction:jest.fn(async(work:any)=>work(tx))};
 return {lease,event,checkpoint,tx,db};
}
describe('Tree projection outbox recovery',()=>{
 it.each([1,2])('acknowledges committed version %s, including out-of-order delivery',async version=>{
  const h=harness(version);
  await expect(processTreeProjectionEvent(h.db as any,h.lease)).resolves.toEqual({binaryTreeId:id,sourceVersion:2});
  expect(h.tx.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({processStatus:'PROCESSED'})}));
 });
 it('does not acknowledge an event ahead of its committed projection',async()=>{
  const h=harness(3);
  await expect(processTreeProjectionEvent(h.db as any,h.lease)).rejects.toThrow('TREE_PROJECTION_UNAVAILABLE');
  expect(h.tx.outboxEvent.update).not.toHaveBeenCalled();
 });
 it.each(['BUILDING','FAILED'])('does not acknowledge a %s projection',async status=>{
  const h=harness();h.checkpoint.status=status;
  await expect(processTreeProjectionEvent(h.db as any,h.lease)).rejects.toThrow('TREE_PROJECTION_UNAVAILABLE');
  expect(h.tx.outboxEvent.update).not.toHaveBeenCalled();
 });
 it('rejects an aggregate/payload mismatch',async()=>{
  const h=harness();h.event.payload.binaryTreeId='other';
  await expect(processTreeProjectionEvent(h.db as any,h.lease)).rejects.toThrow('TREE_OUTBOX_PAYLOAD_INVALID');
  expect(h.tx.outboxEvent.update).not.toHaveBeenCalled();
 });
 it.each(['expired','reclaimed','processed'])('fences a %s lease after power recovery',async state=>{
  const h=harness();
  if(state==='expired')h.lease.availableAt=new Date(0),h.event.availableAt=h.lease.availableAt;
  if(state==='reclaimed')h.event.attemptCount++;
  if(state==='processed')h.event.processStatus='PROCESSED';
  await expect(processTreeProjectionEvent(h.db as any,h.lease)).resolves.toEqual({lostLease:true});
  expect(h.tx.outboxEvent.update).not.toHaveBeenCalled();
  expect(h.tx.binaryTree.findUnique).not.toHaveBeenCalled();
 });
});
