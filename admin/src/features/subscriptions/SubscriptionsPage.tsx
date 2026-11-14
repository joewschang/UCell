import {uiValue,uiText,domainLabel} from "../../../../shared/design-system/i18n";
import {AdminTable} from '../../components/AdminTable';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {get,qs} from '../../lib/api';
import {Card,Field,PageHeader} from '../../components/ui';
import {QueryFeedback} from '../../components/QueryFeedback';
import {dateTime,money} from '../../lib/format';
function subscriptionPlanName(plan: {displayName?: string; planCode: string}) {
 const name = plan.displayName?.trim();
 if (name && /[\u3400-\u9fff]/.test(name)) return name;
 return domainLabel(plan.planCode.replace(/^PO_20261019_ACTIVE_/, ''), name || plan.planCode);
}
export function SubscriptionsPage(){
 const [status,setStatus]=useState(''),[ballNo,setBallNo]=useState(''),[selected,setSelected]=useState('');
 const plans=useQuery({queryKey:['subscription-plans'],queryFn:()=>get<any>('/admin/subscriptions/plans')});
 const queue=useQuery({queryKey:['subscriptions',status,ballNo],queryFn:()=>get<any>('/admin/subscriptions'+qs({status,ballNo,take:100}))});
 const detail=useQuery({queryKey:['subscription',selected],queryFn:()=>get<any>('/admin/subscriptions/'+encodeURIComponent(selected)),enabled:!!selected});
 const rows=queue.error?[]:queue.data?.data??[],d=detail.error?undefined:detail.data?.data;
 return <><PageHeader title="重銷訂閱一覽" subtitle={uiText("只讀 Core 既存方案、訂閱與逐月認列事實；不推定 production calendar/cut-off。")}/>
 <Card title="重銷方案"><QueryFeedback query={plans} empty={!plans.data?.data?.length}/>{!plans.error&&(plans.data?.data??[]).map((p:any)=><p key={p.subscriptionPlanId}>{subscriptionPlanName(p)} · {p.durationMonths} 期 · 每期認列 {money(p.monthlyRecognizedAmount)} {uiText(" · RPV ")}{p.monthlyRpv}</p>)}</Card>
 <Card title="營運配置待核准"><p>{uiText("新增／取消訂閱的營運日期與正式退款流程尚未完成驗證；此頁暫不啟用寫入。既存 UTC 排程建構仍須由 Backend Phase 3 改成 versioned scheduling configuration，不會在 UI 假設日期。")}</p></Card>
 <Card title="訂閱清單"><div className="toolbar"><Field label="狀態"><select value={status} onChange={e=>{setStatus(e.target.value);setSelected('')}}><option value="">全部狀態</option>{['PENDING','ACTIVE','SUSPENDED','CANCELLED','COMPLETED'].map(x=><option key={x} value={(x)}>{uiValue((x))}</option>)}</select></Field><Field label={uiText("Ball Number")}><input value={ballNo} placeholder={uiText("例如 TREE-A000001")} onChange={e=>{setBallNo(e.target.value.trim().toUpperCase());setSelected('')}}/></Field></div><QueryFeedback query={queue} empty={!rows.length}/>{rows.map((s:any)=><button key={s.subscriptionId} className="list-row" onClick={()=>setSelected(s.subscriptionId)}><strong>{subscriptionPlanName(s.plan)} · {domainLabel(s.status)}</strong><span>{s.qualification?.ballNo??uiText("Ball evidence 未提供")} · {s.qualification?.currentHolder?.memberNo??'會員編號未提供'}</span><small>{s.startMonth} → {s.endMonth}</small></button>)}</Card>
 {selected&&<Card title="訂閱詳情"><QueryFeedback query={detail}/>{d&&<><p>{uiText("Ball Number：")}{d.qualification?.ballNo??uiText("Ball evidence 未提供")}</p><p>會員編號：{d.qualification?.currentHolder?.memberNo??'會員編號未提供'}</p><p>{domainLabel(d.status)} {uiText(" · Rule ")}{d.ruleVersionCode} {uiText(" · Snapshot ")}{d.parameterSnapshotHash??uiText("歷史設定 evidence 未提供")}</p><div className="table-wrap"><AdminTable><thead><tr><th>期數</th><th>認列月</th><th>到期時間</th><th>狀態</th><th>認列金額</th><th>{uiText("RPV")}</th></tr></thead><tbody>{(d.schedules??[]).map((s:any)=><tr key={s.recognitionId}><td>{s.installmentNo}</td><td>{s.recognitionMonth}</td><td>{dateTime(s.dueAt)}</td><td>{domainLabel(s.status)}</td><td>{money(s.recognizedAmount)}</td><td>{s.rpvAmount}</td></tr>)}</tbody></AdminTable></div></>}</Card>}</>;
}
