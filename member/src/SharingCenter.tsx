import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ErrorState,LoadingState} from '@ucell/design-system';
import type {Qualification} from './api';
import {memberApi} from './memberApi';
import {useResource} from './useResource';
import {MemberPageHeader} from './MemberPageHeader';
import ReferralShare from './ReferralShare';
type Insights={since:string;asOf:string;officialPaidOrders:number;rows:{contentId:string|null;title:string|null;links:number;visitors:number;boundMembers:number;registrations:number}[];links:{id:string;status:string;createdAt:string;expiresAt:string}[]};
export default function SharingCenter({q}:{q:Qualification}){
 const s=useResource('sharing:'+q.id,signal=>memberApi<Insights>('/member/content-insights?qualificationId='+encodeURIComponent(q.id),{signal}));
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[confirm,setConfirm]=useState('');
 async function revoke(id:string){setBusy(id);setError('');try{await memberApi('/member/content-share-links/'+id+'/revoke',{method:'POST',body:JSON.stringify({qualificationId:q.id})});setConfirm('');s.retry();}catch(e){setError(e instanceof Error?e.message:'停用未完成');}finally{setBusy('');}}
 if(s.error)return <ErrorState message={s.error} retry={s.retry}/>;if(!s.data)return <LoadingState/>;
 const d=s.data;
 return <><MemberPageHeader title="我的分享成效" q={q}/><p>近 30 天建立的連結與累積成效。同一訪客在不同內容可能分別計數；下列內容數字不可直接相加為總人數。</p><Link to="/content">前往影音中心，挑選內容分享 →</Link>
 <ReferralShare q={q}/>{error&&<p role="alert">{error}</p>}
 <div className="uc-content-grid">{d.rows.length?d.rows.map(row=><section className="card" key={row.contentId??'invite'}><h2>{row.title??'一般會員邀請'}</h2><dl className="uc-share-metrics">{[['分享連結',row.links],['有效造訪',row.visitors],['已連結會員',row.boundMembers],['新註冊會員',row.registrations]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{row.contentId&&<Link to={'/content/'+row.contentId}>查看內容</Link>}</section>):<section className="card"><h2>從第一份分享開始</h2><p>連結建立後會出現在這裡，有效造訪與登入紀錄由系統更新。</p></section>}</div>
 <section className="card"><h2>正式推薦訂單</h2><strong className="uc-share-number">{d.officialPaidOrders}</strong><p>近 30 天已付款且有此球位正式推薦快照的訂單數，排除已取消與全額退款訂單。此數字並非上方影音直接帶來的成交數，也不代表已結算獎金。</p><Link to="/bonuses">查看正式獎金明細 →</Link></section>
 <details className="card"><summary>管理最近 50 個分享連結</summary>{d.links.map(l=><div className="uc-share-link-row" key={l.id}><div><strong>{new Date(l.createdAt).toLocaleString('zh-TW')}</strong><p>到期：{new Date(l.expiresAt).toLocaleString('zh-TW')} · {l.status==='ACTIVE'?'有效':l.status==='EXPIRED'?'已過期':'已停用'}</p><small>識別碼：{l.id.slice(-8)}</small></div>{l.status==='ACTIVE'&&(confirm===l.id?<div><p>停用後無法再使用此連結，既有推薦紀錄會保留。</p><button disabled={!!busy} onClick={()=>void revoke(l.id)}>確認停用</button><button onClick={()=>setConfirm('')}>取消</button></div>:<button onClick={()=>setConfirm(l.id)}>停用</button>)}</div>)}</details>
 <p><small>有效造訪為系統接受推薦來源的去重瀏覽器紀錄，並非影片觀看完成數。「已連結會員」包含既有會員；「新註冊會員」僅計入造訪後新建立且完成來源連結的會員。</small></p></>;
}
