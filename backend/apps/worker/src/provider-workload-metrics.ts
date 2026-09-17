import type { ProviderWebhookWorkerRunResult } from '@ucell/database';

export type ProviderWorkloadSnapshot = Readonly<{
  event:'PROVIDER_WORKER_WORKLOAD';
  batches:number;
  failures:number;
  claimed:number;
  finalized:number;
  stale:number;
  processed:number;
  retryPending:number;
  manualReview:number;
  totalDurationMs:number;
  maxDurationMs:number;
  throughputPerSecond:number;
  lastObservedAt:string|null;
}>;

/** In-process operational telemetry only; contains counts and timing, never payload,
 * provider evidence, identity, credentials, or monetary values. */
export class ProviderWorkloadMetrics {
  private batches=0;private failures=0;private claimed=0;private finalized=0;private stale=0;
  private processed=0;private retryPending=0;private manualReview=0;private totalDurationMs=0;
  private maxDurationMs=0;private lastObservedAt:string|null=null;

  record(result:ProviderWebhookWorkerRunResult,durationMs:number,observedAt:Date=new Date()):ProviderWorkloadSnapshot{
    const duration=validDuration(durationMs);validDate(observedAt);
    this.batches++;this.claimed+=result.claimed;this.finalized+=result.finalized;this.stale+=result.stale;
    this.processed+=result.processed;this.retryPending+=result.retryPending;this.manualReview+=result.manualReview;
    this.totalDurationMs+=duration;this.maxDurationMs=Math.max(this.maxDurationMs,duration);this.lastObservedAt=observedAt.toISOString();
    return this.snapshot();
  }

  recordFailure(durationMs:number,observedAt:Date=new Date()):ProviderWorkloadSnapshot{
    const duration=validDuration(durationMs);validDate(observedAt);this.batches++;this.failures++;
    this.totalDurationMs+=duration;this.maxDurationMs=Math.max(this.maxDurationMs,duration);this.lastObservedAt=observedAt.toISOString();
    return this.snapshot();
  }

  snapshot():ProviderWorkloadSnapshot{
    const seconds=this.totalDurationMs/1000;
    return Object.freeze({event:'PROVIDER_WORKER_WORKLOAD',batches:this.batches,failures:this.failures,claimed:this.claimed,finalized:this.finalized,stale:this.stale,processed:this.processed,retryPending:this.retryPending,manualReview:this.manualReview,totalDurationMs:this.totalDurationMs,maxDurationMs:this.maxDurationMs,throughputPerSecond:seconds>0?Number((this.claimed/seconds).toFixed(3)):0,lastObservedAt:this.lastObservedAt});
  }
}

function validDuration(value:number):number{if(!Number.isSafeInteger(value)||value<0)throw new Error('PROVIDER_WORKER_DURATION_INVALID');return value;}
function validDate(value:Date):void{if(!(value instanceof Date)||Number.isNaN(value.getTime()))throw new Error('PROVIDER_WORKER_OBSERVED_AT_INVALID');}