import { runProviderWebhookBatch } from '../src/modules/commerce/provider-webhook-worker-runner';

const lease=(id:string,attemptCount=1)=>({providerWebhookInboxId:id,domain:'PAYMENT' as const,provider:'TEST',connectionId:'stage',providerEventIdentity:'evt',payloadHash:'a'.repeat(64),safeEvidenceRef:'safe',correlationId:'00000000-0000-4000-8000-000000000001',attemptCount,leaseOwner:'worker-1',leaseExpiresAt:new Date('2026-09-18T01:01:00Z')});
const config={leaseOwner:'worker-1',leaseMs:60_000,batchSize:10,maxAttempts:3,retryBackoffSeconds:[10,30]};

describe('Provider webhook worker runner',()=>{
 test('finalizes explicit success, retry and permanent outcomes without deriving provider semantics',async()=>{
  const rows=[lease('00000000-0000-4000-8000-000000000001'),lease('00000000-0000-4000-8000-000000000002'),lease('00000000-0000-4000-8000-000000000003')];
  const finalizeOutcome=jest.fn(async({outcome}:any)=>({finalized:true,decision:{status:outcome==='SUCCESS'?'PROCESSED':outcome==='RETRYABLE_FAILURE'?'RETRY_PENDING':'MANUAL_REVIEW'}}));
  const result=await runProviderWebhookBatch({claimBatch:jest.fn(async()=>rows),finalizeOutcome} as any,row=>({process:async()=>row.providerWebhookInboxId.endsWith('1')?'SUCCESS':row.providerWebhookInboxId.endsWith('2')?'RETRYABLE_FAILURE':'PERMANENT_FAILURE'} as any),config,new Date('2026-09-18T01:00:00Z'));
  expect(result).toEqual({claimed:3,finalized:3,stale:0,processed:1,retryPending:1,manualReview:1});
  expect(finalizeOutcome).toHaveBeenCalledTimes(3);
 });
 test('missing handler and thrown unclassified error fail closed to manual review',async()=>{
  const rows=[lease('00000000-0000-4000-8000-000000000001'),lease('00000000-0000-4000-8000-000000000002')];
  const outcomes:any[]=[];
  const result=await runProviderWebhookBatch({claimBatch:jest.fn(async()=>rows),finalizeOutcome:jest.fn(async(input:any)=>{outcomes.push(input.outcome);return {finalized:true,decision:{status:'MANUAL_REVIEW'}};})} as any,row=>row.providerWebhookInboxId.endsWith('1')?null:{process:async()=>{throw new Error('secret provider error');}},config,new Date('2026-09-18T01:00:00Z'));
  expect(result.manualReview).toBe(2);
  expect(outcomes).toEqual(['PERMANENT_FAILURE','UNKNOWN_FAILURE']);
 });
 test('counts stale lease finalization without reporting a processed outcome',async()=>{
  const result=await runProviderWebhookBatch({claimBatch:jest.fn(async()=>[lease('00000000-0000-4000-8000-000000000001')]),finalizeOutcome:jest.fn(async()=>({finalized:false,decision:{status:'PROCESSED'}}))} as any,()=>({process:async()=>('SUCCESS' as const)}),config,new Date('2026-09-18T01:00:00Z'));
  expect(result).toEqual({claimed:1,finalized:0,stale:1,processed:0,retryPending:0,manualReview:0});
 });
 test('rejects unsafe worker configuration before claiming',async()=>{
  const claimBatch=jest.fn();
  await expect(runProviderWebhookBatch({claimBatch,finalizeOutcome:jest.fn()} as any,()=>null,{...config,batchSize:0})).rejects.toThrow('PROVIDER_WORKER_CONFIG_INVALID');
  expect(claimBatch).not.toHaveBeenCalled();
 });
});
