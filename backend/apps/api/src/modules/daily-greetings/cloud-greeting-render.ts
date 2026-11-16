import {Worker} from 'node:worker_threads';
import {join} from 'node:path';
import {ServiceUnavailableException} from '@nestjs/common';
let active=false;
/** Decode, CRC/inflate checks and native rendering are all outside the API event loop. */
export async function renderCloudGreeting(background:Buffer,date:string):Promise<Buffer>{
 if(active)throw new ServiceUnavailableException({code:'GREETING_RENDER_BUSY'});active=true;
 try{return await new Promise<Buffer>((resolve,reject)=>{
  const worker=new Worker(join(__dirname,'cloud-greeting-render-worker.js'),{workerData:{background,date,font:process.env.DAILY_GREETING_FONT_PATH??'/usr/share/fonts/noto/NotoSansCJK-Regular.ttc'}});
  let finished=false;const finish=(image?:Buffer)=>{if(finished)return;finished=true;clearTimeout(timer);void worker.terminate();image?resolve(image):reject(new ServiceUnavailableException({code:'GREETING_GENERATED_IMAGE_INVALID'}));};
  const timer=setTimeout(()=>finish(),20_000);worker.once('message',v=>finish(v?.image?Buffer.from(v.image):undefined));worker.once('error',()=>finish());worker.once('exit',()=>finish());
 });}finally{active=false;}
}
