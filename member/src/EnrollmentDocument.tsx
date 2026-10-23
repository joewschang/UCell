import {useEffect,useRef,useState} from 'react';
import {StoredEnrollmentDocument} from './StoredEnrollmentDocument';
import {documentNames,type RequiredDocument} from './documentCheck';
export function EnrollmentDocument({applicationId,type,uploaded,uploading,uploadError,disabled,onSelect,onReady}:{applicationId?:string;type:RequiredDocument;uploaded:boolean;uploading?:boolean;uploadError?:string;disabled:boolean;onSelect:()=>void;onReady:(file:File)=>void}){
 const [error,setError]=useState(''),[preview,setPreview]=useState('');
 const url=useRef('');
 useEffect(()=>()=>{if(url.current)URL.revokeObjectURL(url.current);},[]);
 function select(file?:File){
  if(!file)return;
  onSelect();setError('');if(url.current)URL.revokeObjectURL(url.current);url.current='';setPreview('');
  if(!['image/jpeg','image/png'].includes(file.type)||file.size===0||file.size>10*1024*1024){setError('請上傳 JPG 或 PNG，單檔須為 10 MB 以內且不可為空白檔案。');return;}
  url.current=URL.createObjectURL(file);setPreview(url.current);onReady(file);
 }
 return <section className="enrollment-document">
  <label>{documentNames[type]}（必傳）<input type="file" accept="image/jpeg,image/png" disabled={disabled} onChange={e=>{select(e.target.files?.[0]);e.target.value='';}}/></label>
  {uploaded&&applicationId&&<StoredEnrollmentDocument applicationId={applicationId} type={type}/>}
  {!uploaded&&preview&&<img src={preview} alt={documentNames[type]+'上傳前預覽'} style={{maxWidth:'100%',maxHeight:260}}/>}
  <p role={error||uploadError?'alert':'status'} aria-live="polite">{uploaded?'已上傳成功，系統已保存。':uploading?'正在上傳至系統，請稍候…':uploadError||error||(preview?'已選取照片，尚未上傳。':'尚未上傳，請選取清晰且完整的文件照片。')}</p>
  {!uploaded&&preview&&!uploadError&&<p>請按下方「儲存資料」按鈕完成上傳。</p>}
 </section>;
}
