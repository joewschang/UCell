import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {get,qs} from '../../lib/api';
import {Card,Field} from '../../components/ui';
import {QueryFeedback} from '../../components/QueryFeedback';
import './analytics-retention.css';

type Cell={age:number;observationMonth:string;status:string;asOf:string|null;observed:number;missing:number;activeShare:number|null;activeRetention:number|null};
export type Retention={policyVersion:string;rows:Array<{cohortMonth:string;baselineAsOf:string|null;baselineSize:number|null;baselineActive:number|null;cells:Cell[]}>};
const reasons:Record<string,string>={MONTH_NOT_CLOSED:'月份尚未結束',OUTSIDE_QUERY_RANGE:'超出查詢期間',BASELINE_NOT_OBSERVED:'缺少加入月月底快照',EMPTY_COHORT:'無同期群成員',MONTH_END_NOT_OBSERVED:'缺少觀測月月底快照',PARTIAL:'部分成員無法追蹤'};
const rate=(value:number|null)=>value===null?'—':`${(value*100).toFixed(1)}%`;
const taipei=(date:Date)=>new Date(date.getTime()+8*3600000).toISOString().slice(0,10);
const initial=()=>{const to=new Date();to.setTime(to.getTime()+86400000);return {from:taipei(new Date(to.getTime()-365*86400000)),to:taipei(to),policyVersion:''};};
export function RetentionTable({data}:{data:Retention}){
 const [metric,setMetric]=useState<'activeShare'|'activeRetention'>('activeShare');
 return <><Field label="留存指標"><select aria-label="留存指標" value={metric} onChange={e=>setMetric(e.target.value as typeof metric)}><option value="activeShare">同期群活躍占比</option><option value="activeRetention">原活躍者留存率</option></select></Field>
 <p>{metric==='activeShare'?'分母固定為加入月月底的全部同期群成員。':'分母固定為加入月月底已活躍的同期群成員；分母為零時不計算。'}缺少成員觀測時不縮小分母，也不推定流失。</p>
 <div className="retention-scroll" tabIndex={0} role="region" aria-label="同期群留存表，可水平捲動"><table className="retention-table"><caption>固定月末母體 · {data.policyVersion} · M0 為加入月</caption><thead><tr><th scope="col">加入月份</th><th scope="col">固定人數／原活躍</th>{Array.from({length:13},(_,i)=><th scope="col" key={i}>M{i}</th>)}</tr></thead><tbody>{data.rows.map(row=><tr key={row.cohortMonth}><th scope="row">{row.cohortMonth}</th><td>{row.baselineSize??'—'}／{row.baselineActive??'—'}</td>{row.cells.map(cell=>{const value=cell[metric],reason=reasons[cell.status]??(value===null?'原活躍母體為零':'');const detail=`${cell.observationMonth}：${reason||rate(value)}；已觀測 ${cell.observed}，缺少 ${cell.missing}${cell.asOf?`；快照 ${cell.asOf}`:''}`;return <td key={cell.age} title={detail} aria-label={detail} style={value===null?undefined:{backgroundColor:`rgba(21,107,112,${.08+value*.5})`}}>{rate(value)}{reason&&<small>{reason}</small>}</td>;})}</tr>)}</tbody></table></div></>;
}
export function AnalyticsRetentionPanel(){
 const [draft,setDraft]=useState(initial),[applied,setApplied]=useState(initial);
 const params=qs({...applied,policyVersion:applied.policyVersion||undefined});
 const versions=useQuery({queryKey:['analytics','policy-versions'],queryFn:()=>get<{data:string[]}>('/admin/analytics/policy-versions')});
 const cohorts=useQuery({queryKey:['analytics','cohorts',applied],queryFn:()=>get<{data:Retention}>('/admin/analytics/nasl/cohorts'+params),refetchInterval:60_000});
 const history=useQuery({queryKey:['analytics','filtered-history',applied],queryFn:()=>get<{data:{rows:Array<{asOf:string;counts:{N:number;A:number;S:number;L:number}}>}}>('/admin/analytics/nasl/history'+params),refetchInterval:60_000});
 const refresh=useQuery({queryKey:['analytics','refresh-status'],queryFn:()=>get<{data:{enabled:boolean;running:boolean;seconds:number;lastSuccessAt:string|null;results:Array<{scope:string;status:string;code?:string}>;scopeFreshness:Array<{scope:string;status:string;asOf:string|null}>}}>('/admin/analytics/refresh/status'),refetchInterval:60_000});
 const status=refresh.error?undefined:refresh.data?.data;
 return <Card title="歷史同期群留存與更新狀態"><p>全公司自然人、台北日期。以下篩選只影響本區留存與每日歷史；每個月使用最後一天實際保存的最後一份快照，不回填過去。</p>
 <form className="retention-filters" onSubmit={e=>{e.preventDefault();setApplied({...draft});}}><Field label="歷史起日（含）"><input aria-label="歷史起日（含）" type="date" required value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/></Field><Field label="歷史迄日（不含）"><input aria-label="歷史迄日（不含）" type="date" required value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})}/></Field><Field label="歷史政策版本"><select aria-label="歷史政策版本" value={draft.policyVersion} onChange={e=>setDraft({...draft,policyVersion:e.target.value})}><option value="">目前政策</option>{versions.data?.data.map(version=><option key={version}>{version}</option>)}</select></Field><button type="submit">查詢歷史</button></form><p className="muted">查詢期間最多 366 天；缺少月底快照時顯示原因，不以零表示。</p>
 <QueryFeedback query={versions}/><QueryFeedback query={cohorts}/>{!cohorts.error&&cohorts.data&&<RetentionTable data={cohorts.data.data}/>}
 <QueryFeedback query={history}/>{!history.error&&history.data&&<details><summary>查詢期間的每日 NASL 數值（{history.data.data.rows.length} 筆）</summary><div className="retention-scroll"><table className="retention-table"><thead><tr><th>快照時間（台北）</th><th>N</th><th>A</th><th>S</th><th>L</th></tr></thead><tbody>{history.data.data.rows.map(row=><tr key={row.asOf}><th scope="row">{new Date(row.asOf).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}</th>{(['N','A','S','L'] as const).map(k=><td key={k}>{row.counts[k]}</td>)}</tr>)}</tbody></table></div></details>}
 <h3>自動更新</h3><QueryFeedback query={refresh}/>{status&&<><p>{status.enabled?`已啟用，每輪完成後等待 ${status.seconds} 秒`:'尚未啟用；仍可由管理員手動建立快照'}。{status.running?'目前正在更新。':''}本次服務啟動後最後整輪成功：{status.lastSuccessAt?new Date(status.lastSuccessAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'尚無紀錄'}。</p><ul>{status.scopeFreshness.map(scope=><li key={scope.scope}>{scope.scope==='GLOBAL'?'全公司':scope.scope}：{scope.status==='AVAILABLE'?'快照有效':scope.status==='STALE'?'快照已過期':'尚無快照'}{scope.asOf&&`（${new Date(scope.asOf).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}）`}</li>)}</ul>{status.results.filter(r=>r.status==='FAILED').map(r=><p role="alert" key={r.scope}>更新失敗：{r.scope} · {r.code}；下輪會重試。</p>)}</>}
 </Card>;
}
