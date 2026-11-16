import {Worker} from 'node:worker_threads';
import {join} from 'node:path';
import {ServiceUnavailableException} from '@nestjs/common';
let active=false;
/** Decode, CRC/inflate checks and native rendering are all outside the API event loop. */
async function render(background:Buffer,date:string,title?:string):Promise<{image:Buffer;backgroundHash:string}>{
 if(active)throw new ServiceUnavailableException({code:'GREETING_RENDER_BUSY'});active=true;
 try{return await new Promise<{image:Buffer;backgroundHash:string}>((resolve,reject)=>{
  const worker=new Worker(join(__dirname,'cloud-greeting-render-worker.js'),{workerData:{background,date,title,font:process.env.DAILY_GREETING_FONT_PATH??'/usr/share/fonts/noto/NotoSansCJK-Regular.ttc'}});
  let finished=false;const finish=(result?:{image:Buffer;backgroundHash:string})=>{if(finished)return;finished=true;clearTimeout(timer);void worker.terminate();result?resolve(result):reject(new ServiceUnavailableException({code:'GREETING_GENERATED_IMAGE_INVALID'}));};
  const timer=setTimeout(()=>finish(),20_000);worker.once('message',v=>finish(v?.image&&typeof v.backgroundHash==='string'?{image:Buffer.from(v.image),backgroundHash:v.backgroundHash}:undefined));worker.once('error',()=>finish());worker.once('exit',()=>finish());
 });}finally{active=false;}
}

export async function renderCloudGreeting(background:Buffer,date:string):Promise<Buffer>{return (await render(background,date)).image;}
export async function renderPushedGreeting(background:Buffer,date:string,title:string){return render(background,date,title);}

export async function renderGeneratedGreeting(background:Buffer,date:string){return render(background,date);}
