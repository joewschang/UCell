import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Card,ErrorBox,Field} from '../../components/ui';
import {command,get,getBlob} from '../../lib/api';
import {useAuth} from '../auth/auth';
type Row={id:string;greeting_date:string;title:string;status:string;publish_at:string;image_hash:string;approval_reference:string|null};
export function GreetingPublishing(){
 const {user}=useAuth(),editable=['SUPER_ADMIN','ORDER_OPS'].includes(user?.role??''),qc=useQueryClient();
 const query=useQuery({queryKey:['daily-greeting-publications'],queryFn:()=>get<{data:Row[]}>('/admin/daily-greetings'),retry:false});
 const [date,setDate]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())),[title,setTitle]=useState(''),[message,setMessage]=useState(''),[file,setFile]=useState<File>(),[approval,setApproval]=useState(''),[error,setError]=useState<unknown>(),[busy,setBusy]=useState(false),[preview,setPreview]=useState(''),[reviewed,setReviewed]=useState('');
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
 const run=async(work:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);setError(undefined);try{await work();await qc.invalidateQueries({queryKey:['daily-greeting-publications']});}catch(e){setError(e)}finally{setBusy(false)}};
 const upload=()=>run(async()=>{if(!file||file.size>600000)throw new Error('請選擇小於 600 KB 的 RGB／RGBA PNG 圖片。');const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);await command('/admin/daily-greetings',{date,title,message,contentBase64:btoa(binary)});});
 const inspect=(id:string)=>run(async()=>{const blob=await getBlob(`/admin/daily-greetings/${id}/preview`);setPreview(URL.createObjectURL(blob));setReviewed(id)});
 return <Card title="每日問候圖上稿"><p>台北時間每日 07:00 顯示已核准圖片。今天的草稿於 07:00 後核准即生效。請上傳未加 品牌標誌 的原稿；系統會加入正式 品牌標誌，請預覽完成圖再核准。支援 RGB／RGBA PNG，256–2048 像素、600 KB 以下。</p>
 <ErrorBox error={error??query.error}/>{query.error&&<p>上稿服務目前未就緒，請由系統管理員完成資料庫與部署設定。</p>}
 {editable&&<div className="form"><Field label="顯示日期（台北）"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="標題"><input maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="說明"><textarea maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)}/></Field><Field label="問候圖 PNG"><input type="file" accept="image/png" onChange={e=>setFile(e.target.files?.[0])}/></Field><button disabled={busy||!!query.error||!file||!title.trim()||!message.trim()} onClick={upload}>上傳草稿</button><Field label="核准依據"><input maxLength={200} value={approval} onChange={e=>setApproval(e.target.value)}/></Field></div>}
 {preview&&<figure><img src={preview} alt="上稿完成圖預覽，含正式 品牌標誌" style={{width:320,maxWidth:'100%'}}/><figcaption>請確認文字、日期、圖片內容及正式 品牌標誌。</figcaption></figure>}
 <ul>{(query.data?.data??[]).map(row=><li key={row.id}><time data-time-field="greeting_date" dateTime={row.greeting_date}>問候日期 {row.greeting_date}</time> · <time data-time-field="publish_at" dateTime={row.publish_at || undefined}>發布時間 {row.publish_at?new Date(row.publish_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'—'}</time> — {row.title} — {row.status==='DRAFT'?'待審核':row.status==='ARCHIVED'?'已下架':new Date(row.publish_at)>new Date()?'已核准，等待排程':'已發布'} <button disabled={busy} onClick={()=>inspect(row.id)}>預覽</button>{editable&&['DRAFT','ARCHIVED'].includes(row.status)&&<button disabled={busy||reviewed!==row.id||!approval.trim()} onClick={()=>run(()=>command(`/admin/daily-greetings/${row.id}/publish`,{approvalReference:approval}))}>{row.status==='ARCHIVED'?'重新核准此版本':'核准發布此版本'}</button>}{editable&&row.status==='PUBLISHED'&&<button disabled={busy} onClick={()=>run(()=>command(`/admin/daily-greetings/${row.id}/archive`,{}))}>下架</button>}</li>)}</ul></Card>;
}
