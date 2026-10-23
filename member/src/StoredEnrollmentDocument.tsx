import {useEffect,useRef,useState} from 'react';
import {api} from './api';
import {getFormalDocuments} from './memberData';
import {documentNames,type RequiredDocument} from './documentCheck';

/** Private images are fetched with the member session, never exposed as storage URLs. */
export function StoredEnrollmentDocument({applicationId,type}:{applicationId:string;type:RequiredDocument}){
 const [preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController>(),url=useRef('');
 function clear(){controller.current?.abort();if(url.current)URL.revokeObjectURL(url.current);url.current='';setPreview('');setBusy(false);}
 useEffect(()=>{clear();setError('');return ()=>{controller.current?.abort();if(url.current)URL.revokeObjectURL(url.current);};},[applicationId,type]);
 async function view(){
  clear();setError('');setBusy(true);const abort=new AbortController();controller.current=abort;
  try{
   const list=await getFormalDocuments(applicationId,abort.signal);
   const document=list.documents.find(d=>d.type===type&&d.status==='PRESENT');
   if(!document)throw new Error('找不到已上傳照片，請重新載入申請資料後再試。');
   const blob=await api<Blob>(`/member/formal-applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(document.id)}/content`,{signal:abort.signal,responseType:'blob'});
   if(abort.signal.aborted)return;
   if(!['image/png','image/jpeg'].includes(blob.type))throw new Error('照片格式異常，請稍後重試。');
   url.current=URL.createObjectURL(blob);setPreview(url.current);
  }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'照片讀取失敗，請重試。');}
  finally{if(!abort.signal.aborted)setBusy(false);}
 }
 return <div>{preview?<><button type="button" onClick={clear}>收起已上傳照片</button><img src={preview} alt={`已上傳的${documentNames[type]}`} style={{display:'block',maxWidth:'100%',height:'auto',marginTop:12}}/></>:<button type="button" disabled={busy} onClick={()=>void view()}>{busy?'正在讀取照片…':'檢視已上傳照片'}</button>}{error&&<p role="alert">{error}</p>}</div>;
}
