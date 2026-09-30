import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Card,ErrorBox,Field} from '../../components/ui';
import {get,post,qs} from '../../lib/api';
import {QueryFeedback} from '../../components/QueryFeedback';
type Input={periodStart:string;periodEnd:string;ruleVersionCode:string;accountingDate:string;currency:string;currencyBasisReference:string;groupByPayoutBatch:boolean};
type Aggregate={metric:string;economicCategory:string;payoutReference:string|null;amount:string;sourceCount:number};
type Preview={projectionReference:string;reviewHash:string;drillbackHash:string;expected:{aggregates:Aggregate[];currency:string;totals:{memberPayableGross:string;recoveryRequired:string;recoveryApplied:string;recoveryOutstanding:string}}};
export const erpMetricLabel:Record<string,string>={MEMBER_PAYABLE_GROSS:'會員應付毛額',RECOVERY_REQUIRED:'應回收',RECOVERY_APPLIED:'已回收',RECOVERY_OUTSTANDING:'待回收'};
export function ErpCompensationProjectionForm({canApprove,onCreated}:{canApprove:boolean;onCreated:(reference:string)=>void}){
 const [input,setInput]=useState<Input>({periodStart:'',periodEnd:'',ruleVersionCode:'',accountingDate:'',currency:'',currencyBasisReference:'',groupByPayoutBatch:false}),[preview,setPreview]=useState<Preview|null>(null),[approvalReference,setApprovalReference]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>();
 function change<K extends keyof Input>(key:K,value:Input[K]){setInput(current=>({...current,[key]:value}));setPreview(null);setApprovalReference('');}
 const body=()=>({...input,periodStart:new Date(input.periodStart).toISOString(),periodEnd:new Date(input.periodEnd).toISOString()});
 if(!canApprove)return <Card title="獎金會計聚合"><p>財務人員可預覽及核准聚合；目前權限可查看已封存的投影與證據。</p></Card>;
 return <Card title="核准獎金會計聚合"><p>從已完成且通過來源檢核的週期產生彙總。應付與各項回收數字分別呈現，不相加為分錄總額，也不分攤跨週期銀行付款。核准不會替代 ERP 科目映射。</p><ErrorBox error={error}/>
  <form onSubmit={async event=>{event.preventDefault();setBusy(true);setError(undefined);setPreview(null);try{setPreview((await post<{data:Preview}>('/admin/erp-projections/compensation/preview',body())).data);}catch(value){setError(value);}finally{setBusy(false);}}}>
   <fieldset disabled={busy}><div className="filter-grid">
    <Field label="週期開始（本機時區）"><input required type="datetime-local" value={input.periodStart} onChange={event=>change('periodStart',event.target.value)}/></Field>
    <Field label="週期結束（不含，本機時區）"><input required type="datetime-local" value={input.periodEnd} onChange={event=>change('periodEnd',event.target.value)}/></Field>
    <Field label="核准規則版本"><input required maxLength={100} value={input.ruleVersionCode} onChange={event=>change('ruleVersionCode',event.target.value)}/></Field>
    <Field label="會計日期"><input required type="date" value={input.accountingDate} onChange={event=>change('accountingDate',event.target.value)}/></Field>
    <Field label="核准帳務幣別"><input required pattern="[A-Z]{3}" maxLength={3} value={input.currency} onChange={event=>change('currency',event.target.value.toUpperCase())}/></Field>
    <Field label="帳務幣別核准依據"><input required pattern="[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}" value={input.currencyBasisReference} onChange={event=>change('currencyBasisReference',event.target.value)}/></Field>
   </div><p>金額沿用 UCell 帳務數值；此操作不做換匯。</p><label><input type="checkbox" checked={input.groupByPayoutBatch} onChange={event=>change('groupByPayoutBatch',event.target.checked)}/>應付毛額另依付款批次彙總</label><button type="submit" disabled={busy}>產生財務審閱預覽</button></fieldset>
  </form>
  {preview&&<><h3>待核准快照</h3><p>會員應付毛額：{preview.expected.totals.memberPayableGross} {preview.expected.currency}</p><CompensationAggregateTable rows={preview.expected.aggregates}/><details><summary>審閱及來源證據</summary><p>審閱 hash：{preview.reviewHash}</p><p>追溯 hash：{preview.drillbackHash}</p></details><form onSubmit={async event=>{event.preventDefault();setBusy(true);setError(undefined);try{const result=await post<{data:{projectionReference:string}}>('/admin/erp-projections/compensation/approve',{...body(),reviewHash:preview.reviewHash,approvalReference});onCreated(result.data.projectionReference);setPreview(null);setApprovalReference('');}catch(value){setError(value);}finally{setBusy(false);}}}><Field label="本次財務核准單號"><input required pattern="[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}" value={approvalReference} onChange={event=>setApprovalReference(event.target.value)}/></Field><button type="submit" disabled={busy}>核准並封存此快照</button><p>來源資料變更時必須重新預覽。封存後仍等待核准 ERP 會計映射，不代表已過帳。</p></form></>}
 </Card>;
}
export function CompensationAggregateTable({rows}:{rows:Aggregate[]}){return <div className="table-wrap"><table><thead><tr><th>經濟類別</th><th>數值項目</th><th>付款批次範圍</th><th>金額</th><th>來源筆數</th></tr></thead><tbody>{rows.map((row,index)=><tr key={index}><td>{row.economicCategory}</td><td>{erpMetricLabel[row.metric]??row.metric}</td><td>{row.payoutReference==='UNBATCHED'?'尚未編批':row.payoutReference??'不依付款批次分組'}</td><td>{row.amount}</td><td>{row.sourceCount}</td></tr>)}</tbody></table>{!rows.length&&<p>此封存週期沒有可彙總的應付或回收資料。</p>}</div>;}
export function CompensationSourceTable({reference}:{reference:string}){
 const [kind,setKind]=useState('PAYABLE'),[cursor,setCursor]=useState<string|undefined>();
 const query=useQuery({queryKey:['erp-compensation-sources',reference,kind,cursor],queryFn:()=>get<{data:{items:{reference:string;economicCategory:string;amount?:string;required?:string;applied?:string;outstanding?:string;sourceReference?:string;payoutReference?:string|null}[];total:number;nextCursor:string|null;asOf:string;drillbackHash:string}}>('/admin/erp-projections/'+reference+'/sources'+qs({kind,cursor,take:25}))});
 return <section><h3>已封存來源明細</h3><p>下列資料來自核准時的追溯快照；後續回收與付款狀態另行追蹤。</p><Field label="追溯資料類型"><select value={kind} onChange={event=>{setKind(event.target.value);setCursor(undefined);}}><option value="PAYABLE">應付</option><option value="RECOVERY">回收</option></select></Field><QueryFeedback query={query} empty={!!query.data&&!query.data.data.items.length}/>{query.data&&<><p>共 {query.data.data.total} 筆 · 快照時間：{new Date(query.data.data.asOf).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}</p><div className="table-wrap"><table><thead><tr><th>商業參考</th><th>類別</th><th>{kind==='PAYABLE'?'毛額':'應回收／已回收／待回收'}</th><th>來源／付款批次</th></tr></thead><tbody>{query.data.data.items.map(row=><tr key={row.reference}><td>{row.reference}</td><td>{row.economicCategory}</td><td>{row.amount??`${row.required}／${row.applied}／${row.outstanding}`}</td><td>{row.sourceReference??'回收證據'}{row.payoutReference&&<p>{row.payoutReference}</p>}</td></tr>)}</tbody></table></div>{query.data.data.nextCursor&&<button onClick={()=>setCursor(query.data!.data.nextCursor!)}>下一頁來源</button>}</>}</section>;
}
