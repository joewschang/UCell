import {useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {MemberPageHeader} from './MemberPageHeader';
import {getLearning} from './memberData';
import {memberApi as api} from './memberApi';
import {useResource} from './useResource';
import {ErrorState,LoadingState,EmptyState} from '@ucell/design-system';
const status=(value:string)=>({AVAILABLE:'可報名',ENROLLED:'已報名',STARTED:'學習中',COMPLETED:'已完成',CANCELLED:'已取消'}[value]??'狀態待確認');
const contentType=(value:string)=>({ARTICLE:'文章',VIDEO_REFERENCE:'影片',DOCUMENT_REFERENCE:'文件／PDF',EXTERNAL_LINK:'外部教材'}[value]??'教材');
type Detail={courseCode:string;title:string;summary:string|null;version:number;courseStatus:string;available:boolean;status:string;requiredLessonCount:number;completedRequiredCount:number;canComplete:boolean;completedAt:string|null;lessons:{sequenceNo:number;title:string;contentType:string;contentReference:string;required:boolean;completedAt:string|null}[]};
export function safeLearningUrl(value:string){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export default function LearningCenter(){
 const [params,setParams]=useSearchParams(),selected=params.get('course'),s=useResource('learning',getLearning);
 if(selected)return <LearningDetail key={selected} code={selected} back={()=>setParams({})}/>;
 return <><MemberPageHeader title="教育訓練"/><p className="uc-page-intro">課程資格、內容與完成狀態由伺服器判斷；完成不會直接改變資格或獎金。</p>{s.error?<ErrorState message={s.error} retry={s.retry}/>:!s.data?<LoadingState/>:s.data.length?s.data.map(c=><article className="card" key={c.courseCode}><h3>{c.title}</h3><p>{c.summary??'課程說明尚未提供'}</p><p>{c.categoryCode} · {c.lessonCount} 課 · {status(c.status)}</p><button onClick={()=>setParams({course:c.courseCode})}>查看課程</button></article>):<EmptyState title="目前沒有可參加的課程"/>}</>;
}
function LearningDetail({code,back}:{code:string;back:()=>void}){
 const valid=/^[A-Z][A-Z0-9_-]{2,39}$/.test(code),path=`/member/learning/courses/${encodeURIComponent(code)}`;
 const s=useResource(`learning:${code}`,signal=>api<Detail>(path,{signal}),valid),[busy,setBusy]=useState(false),[error,setError]=useState<string>(),[notice,setNotice]=useState<string>(),keys=useRef(new Map<string,string>()),flight=useRef(false);
 async function command(action:string){if(flight.current)return;flight.current=true;setBusy(true);setError(undefined);setNotice(undefined);const key=keys.current.get(action)??crypto.randomUUID();keys.current.set(action,key);try{await api(`${path}/${action}`,{method:'POST',headers:{'Idempotency-Key':key}});keys.current.delete(action);setNotice('已保存學習紀錄。');s.retry();}catch(e){setError(e instanceof Error?e.message:'操作失敗，請重試。');}finally{flight.current=false;setBusy(false);}}
 const d=s.data;
 return <><button onClick={back}>返回課程列表</button>{!valid?<ErrorState message="課程代碼格式不正確"/>:s.error?<ErrorState message={s.error} retry={s.retry}/>:!d?<LoadingState/>:<><MemberPageHeader title={d.title}/><p>{d.summary}</p><p>課程 {d.courseCode} · 第 {d.version} 版 · {status(d.status)}</p><p>必修進度：{d.completedRequiredCount}／{d.requiredLessonCount} 課</p>{!d.available&&<p role="status">課程目前未開放，保留您的歷史學習紀錄。</p>}{d.completedAt&&<p>完成時間：{new Date(d.completedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{d.status==='AVAILABLE'&&d.available&&<button disabled={busy} onClick={()=>void command('enroll')}>加入課程</button>}{d.lessons.map(l=>{const url=safeLearningUrl(l.contentReference);return <article className="card" key={l.sequenceNo}><h3>{l.sequenceNo}. {l.title}</h3><p>{contentType(l.contentType)} · {l.required?'必修':'選修'} · {l.completedAt?'已完成':'尚未完成'}</p>{l.contentType==='ARTICLE'?<div style={{whiteSpace:'pre-wrap'}}>{l.contentReference}</div>:url?<a href={url} target="_blank" rel="noopener noreferrer">開啟{contentType(l.contentType)}（另開視窗）</a>:<p role="alert">教材連結無法安全開啟，請聯絡客服。</p>}{d.available&&['ENROLLED','STARTED'].includes(d.status)&&!l.completedAt&&<button disabled={busy} onClick={()=>void command(`lessons/${l.sequenceNo}/complete`)}>標記「{l.title}」已完成</button>}</article>;})}{d.canComplete&&<button className="primary" disabled={busy} onClick={()=>void command('complete')}>完成課程</button>}</>}</>;
}
