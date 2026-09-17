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

function Unavailable({children}:{children:React.ReactNode}){return <p className="uc-unavailable"><strong>目前無權威資料</strong><br/>{children}</p>}

export function DashboardContent({summary,compensation,canReadCompensation=true}:{summary?:DashboardSummary;compensation?:CompensationSummary;canReadCompensation?:boolean}){
 const latest=compensation?.latestSettlements?.[0];
 const lifecycle=summary?.memberLifecycle;
 return <>
  <div className="metrics">
   <Metric label="自然人" value={summary?.persons ?? '—'} helper="Person 總數"/>
   <Metric label="會員資格" value={summary?.qualifications ?? '—'} helper="Qualification 總數"/>
   <Metric label="目前 Active" value={summary?.activeQualifications ?? '—'} helper="EFFECTIVE 且 activeFlag=true"/>
   <Metric label="待核准申請" value={summary?.applications?.submitted ?? '—'} helper="SUBMITTED"/>
  </div>
  <div className="grid two">
   <Card title="訂單與財務待辦"><dl className="detail-grid"><dt>今日建立訂單</dt><dd>{summary?.orders?.today ?? '—'}</dd><dt>本月建立訂單</dt><dd>{summary?.orders?.month ?? '—'}</dd><dt>Open Recovery</dt><dd>{summary?.recoveries?.open ?? '—'}</dd><dt>Open Payable</dt><dd>{summary?.payable?.open ?? '—'}</dd></dl><Unavailable>GMV、付款與退貨彙總尚未由 Dashboard Read Model 提供。</Unavailable></Card>
   <Card title="獎金與結算證據">{canReadCompensation?<><dl className="detail-grid"><dt>45日等待期 Award</dt><dd>{compensation?.awards?.pending45d ?? '—'}</dd><dt>已生效 Award</dt><dd>{compensation?.awards?.effective ?? '—'}</dd><dt>Open Recovery</dt><dd>{compensation?.recoveries?.openCount ?? '—'}</dd><dt>最近 FINALIZED 批次</dt><dd>{latest?`${latest.settlementType} · ${latest.periodEnd}`:'—'}</dd></dl><p className="muted">此區只呈現 compensation read model 已回傳的歷史事實；不推定目前結算進度。</p></>:<Unavailable>目前角色未獲授權讀取 Compensation Summary；系統不會發出該 API request。</Unavailable>}</Card>
  </div>
  <div className="grid two">
   <Card title="會員生命週期"><Unavailable>NASL New／Active／Suspend／Lost 定義尚未核准，四項維持 unavailable；Person／Qualification 現況不得代替 NASL。</Unavailable>{lifecycle&&<><h4>Person record status</h4><dl className="detail-grid"><dt>EFFECTIVE</dt><dd>{lifecycle.currentPersonRecordStatus.counts.EFFECTIVE}</dd><dt>SUSPENDED</dt><dd>{lifecycle.currentPersonRecordStatus.counts.SUSPENDED}</dd><dt>DRAFT／PENDING</dt><dd>{(lifecycle.currentPersonRecordStatus.counts.DRAFT??0)+(lifecycle.currentPersonRecordStatus.counts.PENDING??0)}</dd></dl><h4>Qualification lifecycle</h4><dl className="detail-grid"><dt>EFFECTIVE</dt><dd>{lifecycle.currentQualificationLifecycleStatus.counts.EFFECTIVE}</dd><dt>SUSPENDED</dt><dd>{lifecycle.currentQualificationLifecycleStatus.counts.SUSPENDED}</dd><dt>EXITED／CLOSED</dt><dd>{(lifecycle.currentQualificationLifecycleStatus.counts.EXITED??0)+(lifecycle.currentQualificationLifecycleStatus.counts.CLOSED??0)}</dd></dl><p className="muted">來源：{lifecycle.currentPersonRecordStatus.source}／{lifecycle.currentQualificationLifecycleStatus.source}</p></>}</Card>
   <Card title="組織健康"><Unavailable>左右區失衡與組織異常 Read Model 尚未提供。</Unavailable></Card>
   <Card title="安全態勢"><Unavailable>Security Alert Read Model 尚未提供；不得以 Audit 筆數替代安全事件。</Unavailable></Card>
   <Card title="系統狀態"><p><Badge tone="neutral">{summary?.ruleVersionCode??'R1.0B'} FROZEN</Badge></p><p><Badge tone="warn">Production Promotion BLOCKED</Badge></p><p>正式 LINE、Entra/RBAC、UAT 與 Release Gate 尚待完成。</p></Card>
  </div>
 </>;
}

export function DashboardPage(){
 const {user}=useAuth();
 const allowed=canReadDashboardCompensation(user?.role);
 const dashboard=useQuery({queryKey:['dashboard-summary'],queryFn:()=>get<{data:DashboardSummary}>('/admin/dashboard/summary'),refetchInterval:30_000});
 const compensation=useQuery({queryKey:['dashboard-compensation-summary'],queryFn:()=>get<{data:CompensationSummary}>('/admin/observability/compensation/summary'),refetchInterval:30_000,enabled:allowed});
 return <><PageHeader title="營運總覽" subtitle="R1.0B 管理後台 Read Model；數字皆來自 Backend，不使用假資料。"/><QueryFeedback query={dashboard}/>{allowed&&<ErrorBox error={compensation.error}/>}<DashboardContent summary={dashboard.error?undefined:dashboard.data?.data} compensation={allowed&&!compensation.error?compensation.data?.data:undefined} canReadCompensation={allowed}/></>;
}
