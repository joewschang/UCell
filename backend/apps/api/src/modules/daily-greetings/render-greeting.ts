import {Worker} from 'node:worker_threads';
/** Native rasterization runs off the API event loop; callers bound the queue. */
export function renderGreeting(svg:string,font:string):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');
   const {Resvg}=require(workerData.renderer);
   try{parentPort.postMessage({png:new Resvg(workerData.svg,{font:{fontFiles:[workerData.font],loadSystemFonts:false,defaultFontFamily:'Noto Sans CJK TC'}}).render().asPng()});}
   catch{parentPort.postMessage({error:true});}`,{eval:true,workerData:{svg,font,renderer:require.resolve('@resvg/resvg-js')}});
  let complete=false;
  const finish=(error?:Error,png?:Buffer)=>{if(complete)return;complete=true;clearTimeout(timer);void worker.terminate();error?reject(error):resolve(png!);};
  const timer=setTimeout(()=>finish(new Error('GREETING_RENDER_TIMEOUT')),10_000);
  worker.once('message',(value:{error?:boolean;png?:Uint8Array})=>value.png?finish(undefined,Buffer.from(value.png)):finish(new Error('GREETING_RENDER_FAILED')));
  worker.once('error',()=>finish(new Error('GREETING_RENDER_FAILED')));
  worker.once('exit',()=>{if(!complete)finish(new Error('GREETING_RENDER_EXITED'));});
 });
}
