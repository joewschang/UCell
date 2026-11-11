import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Card,Field} from '../../components/ui';
import {QueryFeedback} from '../../components/QueryFeedback';
import {get,post,qs} from '../../lib/api';

type Period={id:string;kind:string;periodStart:string;periodEnd:string;ruleVersion:string;checkedAt:string|null;checkedAwards:number;checkedSources:number;openCases:number;expected:string;recorded:string;incomplete:boolean};
type Difference={key:string;reason:string;name:string|null;ball:string|null;orderNo:string|null;expected:string|null;recorded:string|null;difference:string|null;evidence:Record<string,unknown>;verifiedAt:string|null};
type Page<T>={data:{items:T[];hasMore:boolean}};
const base='/admin/compensation-period-control/verification';
const names:Record<string,string>={BINARY_K1:'對碰獎金',MATCHING_K2:'對碰對等',REFERRAL_K0:'推薦與推薦對等'};
const reasons:Record<string,string>={MISSING:'漏列獎金',UNEXPECTED:'額外或錯戶獎金',OWNER:'受領人不一致',UNDER:'少計',OVER:'多計',CARRY:'左右區結轉',COMPANY_BALANCE:'公司球帳差異',SOURCE:'來源業績',ORDER_VOLUME:'訂單業績',INSTALLMENT:'重銷分期',DUPLICATE:'重複獎金',EVIDENCE:'計算依據待確認'};
const date=(value:string)=>new Date(value).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'});
const money=(value:string|null)=>value==null?'—':Number(value).toLocaleString('zh-TW',{maximumFractionDigits:4});
function Pager({page,next,set}:{page:number;next:boolean;set:(n:number)=>void}){
  if(page===1&&!next)return null;
  return <div className="actions"><button disabled={page===1} onClick={()=>set(page-1)}>上一頁</button><span>第 {page} 頁</span><button disabled={!next} onClick={()=>set(page+1)}>下一頁</button></div>;
}
export function CompensationVerification(){
  const cache=useQueryClient(),[page,setPage]=useState(1),[selected,choose]=useState('');
  const [search,setSearch]=useState(''),[term,setTerm]=useState(''),[status,setStatus]=useState('open'),[casePage,setCasePage]=useState(1);
  const periods=useQuery({queryKey:['award-audit-periods',page],queryFn:()=>get<Page<Period>>(base+qs({page})),refetchInterval:60000});
  const selectedPeriod=periods.data?.data.items?.find(p=>p.id===selected)??periods.data?.data.items?.[0];
  const id=selectedPeriod?.id;
  const cases=useQuery({queryKey:['award-audit-cases',id,term,status,casePage],enabled:!!id,queryFn:()=>get<Page<Difference>>(base+'/'+id+'/cases'+qs({q:term,status,page:casePage}))});
  const verify=useMutation({mutationFn:(batch:string)=>post(base+'/'+batch+'/reverify'),onSuccess:async()=>{await Promise.all([cache.invalidateQueries({queryKey:['award-audit-periods']}),cache.invalidateQueries({queryKey:['award-audit-cases']})]);}});
  return <Card title="獎金驗算與差異覆核">
    <QueryFeedback query={periods} empty={periods.data?.data.items?.length===0}/>
    {selectedPeriod&&<>
      <Field label="結算批次"><select value={id} onChange={e=>{choose(e.target.value);setCasePage(1);verify.reset();}}>{periods.data?.data.items.map(p=><option key={p.id} value={p.id}>{date(p.periodEnd)} 截止・{names[p.kind]??p.kind}・{p.ruleVersion}</option>)}</select></Field>
      <Pager page={page} next={!!periods.data?.data.hasMore} set={n=>{setPage(n);choose('');setCasePage(1);}}/>
      <p>{selectedPeriod.checkedAt?(selectedPeriod.incomplete?'驗算未完成，請查看差異原因。':`已核對 ${selectedPeriod.checkedSources} 筆業績、${selectedPeriod.checkedAwards} 筆獎金。待覆核 ${selectedPeriod.openCases} 件。`):'此批次尚待驗算。'}</p>
      {selectedPeriod.checkedAt&&!selectedPeriod.incomplete&&<p>應計 {money(selectedPeriod.expected)} 元　帳列 {money(selectedPeriod.recorded)} 元</p>}
      <button disabled={verify.isPending} onClick={()=>id&&verify.mutate(id)}>{verify.isPending?'驗算中…':'重新驗算並覆核本批次'}</button>
      {verify.isError&&<p role="alert">{verify.error.message}</p>}{verify.isSuccess&&<p role="status">已完成本批次覆核。</p>}
      <form onSubmit={e=>{e.preventDefault();setCasePage(1);setTerm(search.trim());}} className="form-grid">
        <Field label="查找差異"><input placeholder="姓名、公司、手機、球號或訂單號" value={search} onChange={e=>setSearch(e.target.value)}/></Field>
        <Field label="案件狀態"><select value={status} onChange={e=>{setStatus(e.target.value);setCasePage(1);}}><option value="open">待覆核</option><option value="verified">已驗證結案</option><option value="all">全部</option></select></Field><button type="submit">查詢</button>
      </form>
      <QueryFeedback query={cases}/>
      {cases.data?.data.items.length===0&&<p className="muted">此條件下沒有差異案件。</p>}
      {cases.data?.data.items.map(r=><details key={r.key}><summary>{reasons[r.reason]??r.reason}　{[r.name,r.ball].filter(Boolean).join('・')}　{r.difference!=null&&`差額 ${money(r.difference)} 元`}</summary>
        <p>{r.verifiedAt?'已驗證結案':'待覆核'}{r.orderNo&&'　訂單 '+r.orderNo}</p><p>應計 {money(r.expected)} 元　帳列 {money(r.recorded)} 元</p>
        <dl>{Object.entries(r.evidence).map(([k,v])=><div key={k}><dt>{{source:'來源紀錄',award:'獎金紀錄',earnedAt:'獎金發生時間',awardType:'獎金類別',generation:'代數',expectedLeft:'應結轉左區',expectedRight:'應結轉右區',recordedLeft:'帳列左區',recordedRight:'帳列右區',expectedGpv:'應計 GPV',observedGpv:'帳列 GPV',duration:'月數',installment:'期數',due:'到期日',status:'狀態',code:'原因'}[k]??k}</dt><dd>{String(v)}</dd></div>)}</dl>
      </details>)}<Pager page={casePage} next={!!cases.data?.data.hasMore} set={setCasePage}/>
    </>}
  </Card>;
}
