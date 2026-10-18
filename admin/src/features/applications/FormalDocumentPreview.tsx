import {useEffect,useRef,useState} from 'react';
import {getBlob} from '../../lib/api';
export function FormalDocumentPreview({document,autoLoad=false}:{document:any;autoLoad?:boolean}){
 const active=useRef(true);useEffect(()=>{active.current=true;return ()=>{active.current=false;};},[]);
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
 useEffect(()=>{if(autoLoad&&document.status==='PRESENT'&&document.scanStatus!=='INFECTED')void load();},[autoLoad,document.id,document.status,document.scanStatus]);
 const names:Record<string,string>={IDENTITY_FRONT:'身分證明正面',IDENTITY_BACK:'身分證明反面',BANKBOOK_COVER:'存摺封面',SIGNED_APPLICATION_AGREEMENT:'會員簽名／簽署申請書'};
 async function load(){if(document.status!=='PRESENT'||document.scanStatus==='INFECTED')return;setBusy(true);setError('');try{const blob=await getBlob('/admin/formal-member-applications/documents/'+document.id+'/content');if(!['image/png','image/jpeg','application/pdf'].includes(blob.type))throw Error('照片格式不支援');if(active.current)setUrl(URL.createObjectURL(blob));}catch(e){if(active.current)setError(e instanceof Error?e.message:'照片載入失敗');}finally{if(active.current)setBusy(false);}}
 return <article className="card"><h4>{names[document.type]??document.type}</h4><p>{document.status==='PRESENT'?'已上傳':document.status==='REJECTED'?'檔案未通過檢查':'尚未收到照片'} · {document.status!=='PRESENT'?'請會員補傳照片或現場提供正本':document.scanStatus==='INFECTED'?'檔案已被拒絕，請重新上傳':'可核對照片'}</p>{url?<>{document.mimeType==='application/pdf'?<a href={url} target="_blank" rel="noopener noreferrer">開啟申請書 PDF</a>:<img src={url} alt={names[document.type]??'申請文件'} style={{width:'100%',maxHeight:480,objectFit:'contain'}}/>}<button onClick={()=>setUrl('')}>關閉照片</button></>:<button disabled={busy||document.status!=='PRESENT'||document.scanStatus==='INFECTED'} onClick={load}>{busy?'載入中…':'顯示照片供核對'}</button>}{error&&<p role="alert">{error}</p>}</article>;
}
