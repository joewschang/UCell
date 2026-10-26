import {useRef,useState} from 'react';
import {command} from '../../lib/api';
import {ErrorBox} from '../../components/ui';

export function PublishContentAction({contentId,versionId,publishFrom,publishTo,onPublished}:{contentId:string;versionId:string;publishFrom:string|null;publishTo:string|null;onPublished:()=>Promise<unknown>}){
 const [reference,setReference]=useState(''),[pending,setPending]=useState(false),[published,setPublished]=useState(false),[error,setError]=useState<unknown>(null),[validation,setValidation]=useState(''),[refreshFailed,setRefreshFailed]=useState(false),lock=useRef(false);
 async function submit(){
  if(lock.current||published)return;
  if(!reference.trim()){setValidation('請先填寫核准依據，再按「核准發布」。');return;}
  lock.current=true;setPending(true);setError(null);setValidation('');
  try{await command(`/admin/content/${encodeURIComponent(contentId)}/versions/${encodeURIComponent(versionId)}/publish`,{approvalReference:reference.trim()});setPublished(true);try{await onPublished();}catch{setRefreshFailed(true);}}
  catch(e){setError(e);}
  finally{lock.current=false;setPending(false);}
 }
 if(published)return <div role="status"><strong>已核准發布</strong><p>核准已儲存；實際顯示依發布範圍與顯示期間。</p>{refreshFailed&&<p>清單更新失敗，請重新整理確認；不必再次發布。</p>}</div>;
 return <form onSubmit={e=>{e.preventDefault();void submit()}} aria-label="核准發布草稿" aria-busy={pending}>
  <label htmlFor={`approval-${versionId}`}>核准依據（必填）</label>
  <input id={`approval-${versionId}`} maxLength={200} value={reference} disabled={pending} aria-invalid={!!validation} aria-describedby={`approval-help-${versionId}`} placeholder="例如：內容審核通過／核准單號" onChange={e=>{setReference(e.target.value);setValidation('')}}/>
  <small id={`approval-help-${versionId}`}>填寫本筆內容的核准依據，將隨版本保存。</small>
  {validation&&<p role="alert">{validation}</p>}
  <ErrorBox error={error}/>
  {publishFrom&&Date.parse(publishFrom)>Date.now()&&<p>已設定未來開始日期；核准後須等開始日期才顯示。</p>}
  {publishTo&&Date.parse(publishTo)<=Date.now()&&<p>顯示期間已結束，即使核准也不會顯示。請建立新版本調整日期。</p>}
  <button type="submit" disabled={pending}>{pending?'正在核准發布…':error?'重試核准發布':'核准發布'}</button>
 </form>;
}
