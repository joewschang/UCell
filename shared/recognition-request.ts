/** Only explicitly aborted recognition transactions are safe to resend here.
 * Unknown network/timeout outcomes and other commands remain manual recovery. */
export function isRetryableRecognitionResponse(error: unknown): boolean {
  const e = error as {status?:number;body?:{code?:string;details?:{retryable?:boolean;attempts?:number}}}|null;
  return e?.status===409 && e.body?.code==='RECOGNITION_RETRY_EXHAUSTED' &&
    e.body.details?.retryable===true && e.body.details.attempts===4;
}
export function isRecognitionCommand(path:string):boolean {
  return /^\/admin\/(?:rpv\/recognitions\/[a-f0-9-]{36}\/run|epv\/orders\/[a-f0-9-]{36}\/recognize)$/i.test(path);
}
export async function sendRecognitionRequest<T>(send:()=>Promise<T>,onRetry?:(attempt:number)=>void):Promise<T> {
  for(let attempt=0;;attempt++){
    try{return await send();}
    catch(error){
      // Four requests maximum, each with the same business ID and request body.
      if(attempt>=3 || !isRetryableRecognitionResponse(error))throw error;
      onRetry?.(attempt+1);
      await new Promise(resolve=>setTimeout(resolve,500*2**attempt+Math.floor(Math.random()*500)));
    }
  }
}
