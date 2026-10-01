import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Card} from '../../components/ui';
import {QueryFeedback} from '../../components/QueryFeedback';
import {get,post,qs} from '../../lib/api';
import {useAuth} from '../auth/auth';
type Period={periodStart:string;periodEnd:string;ruleVersionCode:string};
type Row={reference:string;revision:number;previousStage:string|null;stage:string;sourceAsOf:string;observedAt:string;businessEnteredAt:null;evidenceHash:string;basis:string};
type Page={items:Row[];nextCursor:number|null;asOf:string;coverage:string};
const stages:Record<string,string>={OPEN:'尚未開始',PRECHECK:'前置檢查中',READY_TO_CLOSE:'可開始封存',SOFT_CLOSED:'輸入已封存',SETTLING:'結算中',RECONCILING:'對帳中',AWARD_FINALIZED:'獎金已定案',MATURING:'等待獎金成熟',PAYABLE_READY:'應付已備妥',PAYMENT_REVIEW:'付款審核中',EXPORTED:'已匯出',BANK_RECONCILING:'銀行結果對帳中',FINANCIALLY_RECONCILED:'會員經濟已對帳',CLOSED:'已關閉',BLOCKED:'有阻擋項目'};
const label=(value:string)=>stages[value]??'待確認階段';
const when=(value:string)=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'時間格式異常';
export function CompensationStageHistory({period}:{period:Period}){
 const {user}=useAuth(),client=useQueryClient();const [cursor,setCursor]=useState<number>(),[asOf,setAsOf]=useState<string>(),[busy,setBusy]=useState(false),[error,setError]=useState<string>(),[saved,setSaved]=useState(false);
 const key=['compensation-stage-history',period],query=useQuery({queryKey:[...key,cursor,asOf],queryFn:()=>get<{data:Page}>('/admin/compensation-period-control/stage-history'+qs({...period,take:25,cursor,asOf}))}),data=query.data?.data;
 const reset=()=>{setCursor(undefined);setAsOf(undefined);};
 const canSave=!!user?.personId&&['SUPER_ADMIN','FINANCE'].includes(user.role);
 const refresh=async()=>{if(!canSave||busy)return;setBusy(true);setError(undefined);setSaved(false);try{await post('/admin/compensation-period-control/stage-history/refresh',period);reset();await client.invalidateQueries({queryKey:key});setSaved(true);}catch(reason){setError(reason instanceof Error?reason.message:'保存查核觀察失敗');}finally{setBusy(false);}};
 return <Card title="期別階段觀察歷程"><p>這裡保存各次查核看見的階段變化；未查核期間的變化不會補造。實際階段進入時間尚無證據，無法由這些觀察確認停留時間。</p>{canSave&&<button disabled={busy} onClick={()=>void refresh()}>{busy?'保存查核中…':'保存目前查核觀察'}</button>}<p>保存會重新查核本期證據並記錄操作者；不執行結算、付款或關帳。</p>{error&&<p role="alert">{error}</p>}{saved&&<p role="status">查核觀察已保存</p>}<QueryFeedback query={query} empty={!!data&&!data.items.length}/>{data&&!query.error&&<><p>歷程查閱截點：{when(data.asOf)}；此頁最多 25 筆，並非全部歷程。</p>{data.items.map(row=><article key={row.reference}><h3>第 {row.revision} 次階段觀察：{label(row.stage)}</h3><p>{row.previousStage?`前次記錄階段：${label(row.previousStage)}`:'尚無更早的階段觀察'}</p><p>查得時間：{when(row.observedAt)}；來源查核截點：{when(row.sourceAsOf)}。</p><p>實際階段進入時間：尚無證據。</p><details><summary>觀察商業參考碼</summary>{row.reference}</details></article>)}{data.nextCursor!==null&&<button onClick={()=>{setCursor(data.nextCursor!);setAsOf(data.asOf);}}>歷程下一頁</button>}{cursor!==undefined&&<button onClick={reset}>歷程第一頁</button>}<button disabled={query.isFetching} onClick={()=>void query.refetch()}>重新查閱歷程</button></>}</Card>;
}
