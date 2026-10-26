import {useEffect,useState} from 'react';
import {getBlob} from '../../lib/api';
import {documentLabel} from './reviewDocuments';
let queue:Promise<unknown>=Promise.resolve();
async function recognize(blob:Blob,onProgress:(value:string)=>void){
 const {createWorker}=await import('tesseract.js');
 const worker=await createWorker('chi_tra+eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr',langPath:'/ocr',gzip:false,cacheMethod:'none',logger:event=>{if(event.status==='recognizing text')onProgress(`辨識中 ${Math.round(event.progress*100)}%`);}});
 try{return (await worker.recognize(blob)).data.text;}finally{await worker.terminate();}
}
export function ReviewDocument({document,onText}:{document:any;onText?:(text:string)=>void}){
 const [url,setUrl]=useState(''),[status,setStatus]=useState('正在載入文件…'),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true,objectUrl='';setUrl('');setStatus('正在載入文件…');
 (async()=>{try{const blob=await getBlob('/admin/formal-member-applications/documents/'+document.id+'/content');if(!active)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);if(!onText){setStatus('');return;}setStatus('等待文字辨識…');queue=queue.catch(()=>{}).then(async()=>{if(!active)return;try{const text=await recognize(blob,value=>{if(active)setStatus(value);});if(active){onText(text);setStatus('辨識完成；紅色欄位表示未比對成功，請核對原圖。');}}catch{if(active)setStatus('文字辨識暫時無法完成，請直接核對原圖；不影響編輯與儲存。');}});}catch{if(active)setStatus('文件載入失敗，請重試。');}})();
 return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[document.id,attempt]);
 return <section className="review-document"><h4>{documentLabel(document.type)}</h4>{url&&<img src={url} alt={documentLabel(document.type)} style={{width:'100%',objectFit:'contain',maxHeight:520}}/>}<p role="status">{status}</p>{status.includes('失敗')||status.includes('無法')?<button type="button" onClick={()=>setAttempt(n=>n+1)}>重新載入與辨識</button>:null}</section>;
}
