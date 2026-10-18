import {useState} from 'react';
import {command} from '../../lib/api';
export async function uploadPaperScan(id:string,file:File){
 if(!['image/jpeg','image/png','application/pdf'].includes(file.type)||file.size<1||file.size>10*1024*1024)throw Error('申請書請使用 JPG、PNG 或 PDF，單檔上限 10 MB。');
 const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
 return command('/admin/formal-member-applications/'+id+'/paper-scan',{mimeType:file.type,contentBase64:btoa(binary)});
}
export function PaperScanUpload({applicationId,initialFile,onUploaded}:{applicationId:string;initialFile?:File;onUploaded?:()=>void}){
 const [file,setFile]=useState(initialFile),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <section className="card"><h3>紙本申請書掃描檔</h3><p>可上傳含簽名的完整申請書；多頁請合併為 PDF。JPG、PNG 或 PDF，單檔上限 10 MB。更換檔案會保留舊版紀錄。</p><input type="file" aria-label="申請書掃描檔" accept="image/jpeg,image/png,application/pdf" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]);setMessage('');}}/>{file&&<p>{file.name}</p>}<button type="button" disabled={!file||busy} onClick={async()=>{setBusy(true);setMessage('');try{await uploadPaperScan(applicationId,file!);setMessage('申請書已儲存，可於審查頁開啟。');setFile(undefined);onUploaded?.();}catch(e){setMessage(e instanceof Error?e.message:'上傳失敗，請重試');}finally{setBusy(false);}}}>{busy?'上傳中…':'儲存申請書掃描檔'}</button>{message&&<p role="status">{message}</p>}</section>;
}
