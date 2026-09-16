import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {get} from '../../lib/api';
import {useAuth} from '../auth/auth';
import {canOpen} from '../auth/permissions';
import './dashboard.css';

interface Summary {
 persons?:number; qualifications?:number; activeQualifications?:number;
 applications?:{draft?:number;submitted?:number}; orders?:{today?:number;month?:number};
 recoveries?:{open?:number}; payable?:{open?:number}; generatedAt?:string; ruleVersionCode?:string;
}
const count=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const fmt=(n:unknown)=>count(n)?n.toLocaleString('zh-TW'):'—';

export function DashboardPage(){
 const {user}=useAuth();
 const q=useQuery({queryKey:['dashboard-summary'],queryFn:()=>get<{data:Summary}>('/admin/dashboard/summary'),refetchInterval:30_000});
 const d=q.data?.data;
 const ratio=count(d?.qualifications)&&d.qualifications>0&&count(d.activeQualifications)&&d.activeQualifications<=d.qualifications
   ? d.activeQualifications/d.qualifications : null;
 const date=d?.generatedAt?new Date(d.generatedAt):null;
 const updated=date&&!Number.isNaN(date.getTime())?date.toLocaleString('zh-TW',{hour12:false}):'尚未取得';
 const tasks=[
  {label:'會員申請審核',sub:'已送出 · 等待審核',value:d?.applications?.submitted,to:'/applications',color:'violet'},
  {label:'追扣與回收',sub:'OPEN / OFFSETTING',value:d?.recoveries?.open,to:'/returns',color:'amber'},
  {label:'應付項目處理',sub:'OPEN · 項目筆數',value:d?.payable?.open,to:'/payouts',color:'cyan'},
 ].filter(t=>canOpen(user?.role,t.to));
 return <div className="command-dashboard">
  <div className="command-top"><span>WORKSPACE <b>/</b> OVERVIEW</span><span className="command-status"><i/>{q.isError?'更新異常':q.isFetching?'正在同步':'每 30 秒更新'}</span></div>
  <header className="command-heading"><div><p className="command-kicker">UCELL OPERATIONS</p><h1>營運指揮中心<span>.</span></h1><p>掌握全局，讓每一步決策更清晰。</p></div><button onClick={()=>q.refetch()} disabled={q.isFetching}>{q.isFetching?'同步中…':'↻ 更新總覽'}</button></header>
  {user?.provider==='DEV_BYPASS'&&<p className="command-alert">開發預覽登入 · 不代表正式管理員工作階段；測試資料僅供介面驗證。</p>}
  {q.isError&&<p role="alert" className="command-alert">資料更新失敗。{d?'目前顯示上次成功取得的資料，請確認更新時間。':'目前無法取得營運數據，請稍後重試。'}</p>}
  {q.isLoading&&<p role="status">營運資料載入中…</p>}
  <div className="command-metrics">
   {[
    ['自然人總數',d?.persons,'PERSONS','01','cyan'],
    ['會員資格總數',d?.qualifications,'QUALIFICATIONS','02','violet'],
    ['活躍資格',d?.activeQualifications,'EFFECTIVE + ACTIVE','03','green'],
    ['待核准申請',d?.applications?.submitted,'SUBMITTED','04','amber'],
   ].map(([label,value,sub,index,color])=><section className={`command-metric ${color}`} key={String(label)}><div><span>{label}</span><small>{index}</small></div><strong>{fmt(value)}</strong><footer><span>{sub}</span><span className="metric-accent" aria-hidden="true">↗</span></footer></section>)}
  </div>
  <div className="command-panels">
   <section className="command-panel activity-panel"><div className="command-panel-title"><div><p>MEMBER PULSE</p><h2>資格活躍概況</h2></div><span className="command-chip">目前快照</span></div>
    <div className="activity-body"><div className="activity-ring" role="img" aria-label={ratio===null?'活躍資格占比待提供':`活躍資格占比 ${(ratio*100).toFixed(1)}%`}><svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="80" className="ring-track"/>{ratio!==null&&<circle cx="100" cy="100" r="80" className="ring-value" pathLength="100" strokeDasharray={`${ratio*100} 100`} transform="rotate(-90 100 100)"/>}</svg><div><strong>{ratio===null?'—':`${(ratio*100).toFixed(1)}%`}</strong><span>活躍資格占比</span></div></div>
     <dl className="activity-legend"><div><dt><i/>活躍資格</dt><dd>{fmt(d?.activeQualifications)}</dd></div><div><dt><i/>全部資格</dt><dd>{fmt(d?.qualifications)}</dd></div><p>活躍資格 ÷ 全部資格<br/>自然人與資格分開統計</p></dl></div>
   </section>
   <section className="command-panel"><div className="command-panel-title"><div><p>ACTION CENTER</p><h2>優先處理事項</h2></div><span className="command-chip">依您的權限</span></div><div className="command-tasks">{tasks.map((t,i)=><Link to={t.to} key={t.to} className={`command-task ${t.color}`}><span className="task-number">0{i+1}</span><div><h3>{t.label}</h3><p>{t.sub}</p></div><strong>{fmt(t.value)}</strong><span aria-hidden="true">↗</span></Link>)}{!tasks.length&&<p>您的角色目前沒有此區的處理入口。</p>}</div></section>
   <section className="command-panel order-panel"><div className="command-panel-title"><div><p>ORDER MONITOR</p><h2>訂單動態</h2></div>{canOpen(user?.role,'/orders')&&<Link to="/orders">查看訂單 ↗</Link>}</div><div className="order-counts"><div><span>今日建立</span><strong>{fmt(d?.orders?.today)}<small>筆</small></strong></div><div><span>本月建立</span><strong>{fmt(d?.orders?.month)}<small>筆</small></strong></div></div><p className="command-note">依後端日／月界線統計建立筆數，不代表付款或營收。</p></section>
   <section className="command-panel system-panel"><div className="command-panel-title"><div><p>CONTROL & GOVERNANCE</p><h2>治理與追蹤</h2></div><span className="command-chip">{d?.ruleVersionCode??'版本待提供'}</span></div><div className="governance-links">{[['/audit','稽核紀錄','追溯操作與異動'],['/system','系統就緒度','檢查整合與發布條件'],['/reports','報表與完整性','檢視資料品質']].filter(([to])=>canOpen(user?.role,to)).map(([to,title,sub])=><Link to={to} key={to}><div><strong>{title}</strong><span>{sub}</span></div><span aria-hidden="true">↗</span></Link>)}</div><p className="command-note">此頁為營運快照，不表示已通過正式上線驗證。</p></section>
  </div>
  <footer className="command-footer"><span>UCELL <b>ADMIN CONSOLE</b></span><span>資料產生時間：{updated}（瀏覽器時區）</span></footer>
 </div>;
}
