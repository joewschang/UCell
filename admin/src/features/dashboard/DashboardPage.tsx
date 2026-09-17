import {useQuery} from '@tanstack/react-query';
import {get} from '../../lib/api';
import {Card,Metric,PageHeader,Badge,ErrorBox} from '../../components/ui';
import {QueryFeedback} from '../../components/QueryFeedback';
import {useAuth} from '../auth/auth';
import type {AdminRole} from '../auth/permissions';

type UnavailableMetric={availability:'UNAVAILABLE';value:null;reasonCode:string};
type DashboardSummary={generatedAt:string;persons:number;qualifications:number;activeQualifications:number;applications:{draft:number;submitted:number};orders:{today:number;month:number};recoveries:{open:number};payable:{open:number};memberLifecycle?:{nasl:{new:UnavailableMetric;active:UnavailableMetric;suspended:UnavailableMetric;lost:UnavailableMetric};currentPersonRecordStatus:{availability:'AVAILABLE';source:string;counts:Record<string,number>};currentQualificationLifecycleStatus:{availability:'AVAILABLE';source:string;counts:Record<string,number>}};ruleVersionCode:string};
type CompensationSummary={generatedAt:string;latestSettlements:Array<{settlementBatchId:string;settlementType:string;periodEnd:string;status:string;ruleVersionCode:string}>;awards:{pending45d:number;effective:number};recoveries:{openCount:number;outstanding:string}};
const compensationRoles:AdminRole[]=['SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT'];
export const canReadDashboardCompensation=(role:AdminRole|undefined)=>!!role&&compensationRoles.includes(role);

function Unavailable({children}:{children:React.ReactNode}){return <div className="uc-unavailable dashboard-unavailable"><span className="dashboard-unavailable-mark" aria-hidden="true">—</span><p><strong>目前無權威資料</strong><br/>{children}</p></div>}

const statusOrder=['EFFECTIVE','SUSPENDED','DRAFT','PENDING','APPROVED','TRANSFERRED','EXITED','CLOSED','VOIDED'];
export function CompositionBars({title,counts,source}:{title:string;counts:Record<string,number>;source:string}){
 const entries=Object.entries(counts).filter(([,value])=>Number.isFinite(value)&&value>=0).sort(([a],[b])=>{const ai=statusOrder.indexOf(a),bi=statusOrder.indexOf(b);return (ai<0?99:ai)-(bi<0?99:bi)||a.localeCompare(b)});
 const total=entries.reduce((sum,[,value])=>sum+value,0);
 return <section className="composition" aria-label={`${title}，目前組成，共 ${total} 筆`}>
  <div className="composition-heading"><div><h4>{title}</h4><span>目前組成</span></div><strong>{total}</strong></div>
  <div className="composition-track" aria-hidden="true">{total>0?entries.filter(([,value])=>value>0).map(([status,value],index)=><span key={status} className={`composition-segment composition-tone-${index%6}`} style={{width:`${value/total*100}%`}}/>):<span className="composition-empty"/>}</div>
  <dl className="composition-legend">{entries.map(([status,value],index)=><div key={status}><dt><i className={`composition-dot composition-tone-${index%6}`} aria-hidden="true"/>{status}</dt><dd>{value}<small>{total>0?`${Math.round(value/total*100)}%`:'0%'}</small></dd></div>)}</dl>
  <p className="composition-source">Source · <span className="mono">{source}</span></p>
 </section>
}

export function DashboardContent({summary,compensation,canReadCompensation=true}:{summary?:DashboardSummary;compensation?:CompensationSummary;canReadCompensation?:boolean}){
 const latest=compensation?.latestSettlements?.[0];const lifecycle=summary?.memberLifecycle;
 return <div className="dashboard-command-center">
  <section className="dashboard-hero" aria-labelledby="dashboard-command-title">
   <div><span className="dashboard-kicker">LIVE OPERATIONS READ MODEL</span><h2 id="dashboard-command-title">營運指揮中心</h2><p>以目前 Core records 與已完成的歷史證據呈現，不推定尚未提供的營運狀態。</p></div>
   <dl className="dashboard-evidence"><div><dt>RULE</dt><dd>{summary?.ruleVersionCode??'—'}</dd></div><div><dt>SNAPSHOT</dt><dd>{summary?.generatedAt?<time dateTime={summary.generatedAt}>{summary.generatedAt}</time>:'—'}</dd></div></dl>
  </section>
  <div className="metrics dashboard-metrics">
   <Metric label="自然人" value={summary?.persons ?? '—'} helper="Person 總數"/><Metric label="會員資格" value={summary?.qualifications ?? '—'} helper="Qualification 總數"/><Metric label="目前 Active" value={summary?.activeQualifications ?? '—'} helper="EFFECTIVE 且 activeFlag=true"/><Metric label="待核准申請" value={summary?.applications?.submitted ?? '—'} helper="SUBMITTED"/>
  </div>
  <div className="grid two dashboard-primary-grid">
   <Card title="訂單與財務待辦" className="dashboard-panel"><dl className="dashboard-stat-grid"><div><dt>今日建立訂單</dt><dd>{summary?.orders?.today ?? '—'}</dd></div><div><dt>本月建立訂單</dt><dd>{summary?.orders?.month ?? '—'}</dd></div><div><dt>Open Recovery</dt><dd>{summary?.recoveries?.open ?? '—'}</dd></div><div><dt>Open Payable</dt><dd>{summary?.payable?.open ?? '—'}</dd></div></dl><Unavailable>GMV、付款與退貨彙總尚未由 Dashboard Read Model 提供。</Unavailable></Card>
   <Card title="獎金與結算證據" className="dashboard-panel">{canReadCompensation?<><dl className="dashboard-stat-grid"><div><dt>45日等待期 Award</dt><dd>{compensation?.awards?.pending45d ?? '—'}</dd></div><div><dt>已生效 Award</dt><dd>{compensation?.awards?.effective ?? '—'}</dd></div><div><dt>Open Recovery</dt><dd>{compensation?.recoveries?.openCount ?? '—'}</dd></div><div><dt>Outstanding</dt><dd>{compensation?.recoveries?.outstanding ?? '—'}</dd></div></dl><div className="dashboard-latest"><span>最近 FINALIZED 批次</span><strong>{latest?latest.settlementType:'—'}</strong><small>{latest?.periodEnd??'尚無資料'}</small></div><p className="muted">此區只呈現 compensation read model 已回傳的歷史事實；不推定目前結算進度。</p></>:<Unavailable>目前角色未獲授權讀取 Compensation Summary；系統不會發出該 API request。</Unavailable>}</Card>
  </div>
  <Card title="會員生命週期 · Current Records" className="dashboard-panel dashboard-lifecycle"><Unavailable>NASL New／Active／Suspend／Lost 定義尚未核准，四項維持 unavailable；Person／Qualification 現況不得代替 NASL。</Unavailable>{lifecycle&&<div className="composition-grid"><CompositionBars title="Person record status" counts={lifecycle.currentPersonRecordStatus.counts} source={lifecycle.currentPersonRecordStatus.source}/><CompositionBars title="Qualification lifecycle" counts={lifecycle.currentQualificationLifecycleStatus.counts} source={lifecycle.currentQualificationLifecycleStatus.source}/></div>}</Card>
  <div className="grid dashboard-status-grid">
   <Card title="組織健康" className="dashboard-panel"><Unavailable>左右區失衡與組織異常 Read Model 尚未提供。</Unavailable></Card><Card title="安全態勢" className="dashboard-panel"><Unavailable>Security Alert Read Model 尚未提供；不得以 Audit 筆數替代安全事件。</Unavailable></Card><Card title="系統狀態" className="dashboard-panel dashboard-system"><p><Badge tone="neutral">{summary?.ruleVersionCode??'R1.0B'} FROZEN</Badge></p><p><Badge tone="warn">Production Promotion BLOCKED</Badge></p><p>正式 LINE、Entra/RBAC、UAT 與 Release Gate 尚待完成。</p></Card>
  </div>
 </div>
}

export function DashboardPage(){
 const {user}=useAuth();const allowed=canReadDashboardCompensation(user?.role);
 const dashboard=useQuery({queryKey:['dashboard-summary'],queryFn:()=>get<{data:DashboardSummary}>('/admin/dashboard/summary'),refetchInterval:30_000});
 const compensation=useQuery({queryKey:['dashboard-compensation-summary'],queryFn:()=>get<{data:CompensationSummary}>('/admin/observability/compensation/summary'),refetchInterval:30_000,enabled:allowed});
 return <><PageHeader title="營運總覽" subtitle="R1.0B 管理後台 Read Model；數字皆來自 Backend，不使用假資料。"/><QueryFeedback query={dashboard}/>{allowed&&<ErrorBox error={compensation.error}/>}<DashboardContent summary={dashboard.error?undefined:dashboard.data?.data} compensation={allowed&&!compensation.error?compensation.data?.data:undefined} canReadCompensation={allowed}/></>
}
