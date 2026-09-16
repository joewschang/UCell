import {useQuery} from '@tanstack/react-query';
import {get} from '../../lib/api';
import {Card,Metric,PageHeader,Badge,ErrorBox} from '../../components/ui';
import {QueryFeedback} from '../../components/QueryFeedback';

export function DashboardPage(){
 const q=useQuery({queryKey:['dashboard-summary'],queryFn:()=>get<any>('/admin/dashboard/summary'),refetchInterval:30_000});
 const d=q.error?undefined:q.data?.data;
 return <>
  <PageHeader title="營運總覽" subtitle="R1.0B 管理後台 Read Model；數字皆來自Backend，不使用假資料。"/>
  <QueryFeedback query={q}/>
  <div className="metrics">
   <Metric label="自然人" value={d?.persons ?? '—'} helper="Person"/>
   <Metric label="會員資格" value={d?.qualifications ?? '—'} helper="Qualification"/>
   <Metric label="目前Active" value={d?.activeQualifications ?? '—'} helper="EFFECTIVE + Active"/>
   <Metric label="待核准申請" value={d?.applications?.submitted ?? '—'} helper="SUBMITTED"/>
  </div>
  <div className="grid two">
   <Card title="今日／本月">
    <div className="detail-grid"><dt>今日訂單</dt><dd>{d?.orders?.today ?? '—'}</dd><dt>本月訂單</dt><dd>{d?.orders?.month ?? '—'}</dd><dt>Open Recovery</dt><dd>{d?.recoveries?.open ?? '—'}</dd><dt>Open Payable</dt><dd>{d?.payable?.open ?? '—'}</dd></div>
   </Card>
   <Card title="系統狀態"><p><Badge tone="neutral">R1.0B FROZEN</Badge></p><p><Badge tone="warn">Production Promotion BLOCKED</Badge></p><p>正式 LINE、Entra/RBAC、UAT 與 Release Gate 尚待完成。</p></Card>
  </div>
  <Card title="待接入的營運指標"><p className="muted">GMV、會員 New／Suspend／Lost、左右區失衡、Security Alerts 與結算 Pipeline 明細尚無此 Dashboard API，顯示 unavailable；不以其他數值替代。</p></Card>
 </>
}
