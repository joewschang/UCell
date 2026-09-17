import { ProviderWorkloadMetrics } from '../../worker/src/provider-workload-metrics';

describe('Provider workload metrics',()=>{
  it('accumulates deterministic batch counts, latency and throughput',()=>{
    const metrics=new ProviderWorkloadMetrics();
    metrics.record({claimed:4,finalized:3,stale:1,processed:2,retryPending:1,manualReview:0},2000,new Date('2026-09-19T00:00:00Z'));
    expect(metrics.record({claimed:2,finalized:2,stale:0,processed:1,retryPending:0,manualReview:1},1000,new Date('2026-09-19T00:01:00Z'))).toEqual({event:'PROVIDER_WORKER_WORKLOAD',batches:2,failures:0,claimed:6,finalized:5,stale:1,processed:3,retryPending:1,manualReview:1,totalDurationMs:3000,maxDurationMs:2000,throughputPerSecond:2,lastObservedAt:'2026-09-19T00:01:00.000Z'});
  });
  it('records a sanitized failure without inventing claimed work',()=>{
    const metrics=new ProviderWorkloadMetrics();expect(metrics.recordFailure(250,new Date('2026-09-19T00:00:00Z'))).toMatchObject({batches:1,failures:1,claimed:0,finalized:0,totalDurationMs:250});
  });
  it('rejects invalid duration and timestamp evidence',()=>{
    const metrics=new ProviderWorkloadMetrics();const result={claimed:0,finalized:0,stale:0,processed:0,retryPending:0,manualReview:0};expect(()=>metrics.record(result,-1)).toThrow('PROVIDER_WORKER_DURATION_INVALID');expect(()=>metrics.record(result,1,new Date('invalid'))).toThrow('PROVIDER_WORKER_OBSERVED_AT_INVALID');
  });
});