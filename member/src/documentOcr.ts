import {checkDocumentText,documentNames,type RequiredDocument} from './documentCheck';
let queue:Promise<unknown>=Promise.resolve();
export function inspectDocument(file:File,type:RequiredDocument,identityType:string,signal:AbortSignal,progress:(message:string)=>void):Promise<{file:File;rotation:number}>{
 const task=queue.catch(()=>{}).then(async()=>{
  if(signal.aborted)throw new Error('已取消辨識');
  let worker:import('tesseract.js').Worker|undefined,bitmap:ImageBitmap|undefined;
  const controller=new AbortController();const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
  let rejectAbort:(e:Error)=>void=()=>{};
  const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
  controller.signal.addEventListener('abort',()=>{void worker?.terminate();rejectAbort(new Error(signal.aborted?'已取消辨識':'辨識逾時。請使用清晰、完整且無反光的照片，重新選取或按重新辨識。'));},{once:true});
  const timer=setTimeout(abort,90_000);
  try{return await Promise.race([aborted,(async()=>{
   if(!['image/jpeg','image/png'].includes(file.type)||file.size===0||file.size>10*1024*1024)throw new Error('請上傳 JPG 或 PNG，單檔須小於 10 MB。');
   progress('正在讀取圖片與載入辨識工具…');
   if(typeof createImageBitmap!=='function')throw new Error('請使用更新版 Safari 或 Chrome 開啟會員中心，再上傳文件。');
   bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
   if(controller.signal.aborted){bitmap.close();throw new Error('已取消辨識');}
   const {createWorker}=await import('tesseract.js');
   worker=await createWorker('chi_tra+eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr',langPath:'/ocr',gzip:false,cacheMethod:'none'});
   if(controller.signal.aborted){await worker.terminate();throw new Error('已取消辨識');}
   let best:string[]=[];
   for(const angle of [0,90,180,270]){
    if(controller.signal.aborted)throw new Error('已取消辨識');
    progress(`正在檢查${documentNames[type]}，嘗試 ${angle}° 方向…`);
    const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height)),w=Math.round(bitmap.width*scale),h=Math.round(bitmap.height*scale);
    const canvas=document.createElement('canvas');canvas.width=angle%180?h:w;canvas.height=angle%180?w:h;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(angle*Math.PI/180);ctx.drawImage(bitmap,-w/2,-h/2,w,h);
    const result=checkDocumentText(type,(await worker.recognize(canvas)).data.text,identityType);
    if(result.ok){const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('圖片轉換失敗，請重新選取')),'image/jpeg',0.94));return {file:new File([blob],type.toLowerCase()+'.jpg',{type:'image/jpeg'}),rotation:angle};}
    if(!best.length||result.missing.length<best.length)best=result.missing;
   }
   throw new Error('無法辨識'+best.join('、')+'。請確認文件種類，將四角完整拍入、避開反光後重新上傳。');
  })()]);}catch(e){if(e instanceof Error&&/^(請|無法辨識|辨識逾時|已取消|圖片轉換)/.test(e.message))throw e;throw new Error('圖片辨識失敗，請重新拍攝清晰照片再上傳。若持續失敗，請更新瀏覽器或聯絡客服。');}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);bitmap?.close();await worker?.terminate();}
 });queue=task;return task;
}
