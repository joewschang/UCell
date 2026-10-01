type Transition={revision:number;toStatus:string;enteredAt:Date|null;recordedAt:Date};
/** Process status is distinct from eligibility, dependency waits and overall financial lifecycle. */
export function periodProcessTiming(status:string,rows:Transition[]|undefined,asOf:Date){
 const latest=rows?.[0];
 if(!latest||latest.toStatus!==status||!latest.enteredAt||latest.enteredAt.getTime()!==latest.recordedAt.getTime()||latest.enteredAt>asOf){
  return {status:'UNAVAILABLE' as const,enteredAt:null,elapsedSeconds:null,basis:'DURABLE_PROCESS_TRANSITION' as const};
 }
 return {status:'RECORDED' as const,enteredAt:latest.enteredAt.toISOString(),elapsedSeconds:Math.floor((asOf.getTime()-latest.enteredAt.getTime())/1000),basis:'DURABLE_PROCESS_TRANSITION' as const};
}
