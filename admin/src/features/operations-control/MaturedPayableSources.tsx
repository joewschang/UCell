import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Card,Field} from '../../components/ui';
import {QueryFeedback} from '../../components/QueryFeedback';
import {get,qs} from '../../lib/api';
import {formatStoredDecimal} from '../../lib/stored-decimal';
type Source={reference:string;sourceType:string;awardType:string;qualificationNo:string;amount:string;maturesAt:string;ruleVersionCode:string;recordedAt:string};
type Page={items:Source[];nextCursor:string|null;asOf:string;dataThrough:string;cutoff:string;thresholdHours:number};
const labels:Record<string,string>={BONUS_AWARD:'一般獎金',RPV_UPLINE_AWARD:'RPV 上線獎金',GLOBAL_POOL_AWARD:'Global 獎金'};
function initial(){const p=new URLSearchParams(typeof window==='undefined'?'':window.location.search),raw=p.get('thresholdHours');return p.get('scope')==='MATURED_AWARD'&&raw&&/^\d+$/.test(raw)&&Number(raw)>=1&&Number(raw)<=8760?Number(raw):undefined;}
export function MaturedPayableSources(){
 const [threshold,setThreshold]=useState<number|undefined>(initial),[draft,setDraft]=useState(()=>threshold?.toString()??''),[cursor,setCursor]=useState<string>(),[asOf,setAsOf]=useState<string>();
 const reset=()=>{setCursor(undefined);setAsOf(undefined);};
 const valid=/^\d+$/.test(draft)&&Number(draft)>=1&&Number(draft)<=8760;
 const query=useQuery({queryKey:['matured-payable-sources',threshold,cursor,asOf],queryFn:()=>get<{data:Page}>('/admin/operations/control/matured-payable-sources'+qs({thresholdHours:threshold,take:25,cursor,asOf})),enabled:threshold!==undefined}),data=query.data?.data;
 const when=(value:string)=>new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});
 return <section id="matured-payable-sources"><Card title="已成熟但尚未建立應付的來源"><form onSubmit={event=>{event.preventDefault();if(valid){setThreshold(Number(draft));reset();}}}><Field label="成熟後等待門檻（小時）"><input type="number" min="1" max="8760" step="1" value={draft} onChange={event=>setDraft(event.target.value)}/></Field><button disabled={!valid} type="submit">查閱未建應付來源</button></form><p>每頁最多 25 筆，涵蓋一般、RPV 與 Global 來源；Company／Reservoir B 去向不列入。此查詢不建立應付、不付款。</p>{threshold!==undefined&&<QueryFeedback query={query} empty={!!data&&!data.items.length}/>} {data&&!query.error&&<><p>成熟截止：{when(data.cutoff)}；紀錄納入截止：{when(data.asOf)}。每頁重新確認目前應付與經濟去向；不是歷史金額快照。</p>{data.items.map(row=><article key={row.reference}><h3>{labels[row.sourceType]??'獎金來源'} · 資格 {row.qualificationNo}</h3><p>保存金額：{formatStoredDecimal(row.amount)}；規則 {row.ruleVersionCode}。</p><p>成熟時間：{when(row.maturesAt)}；記錄時間：{when(row.recordedAt)}。</p><details><summary>來源商業參考碼</summary>{row.reference}</details></article>)}<a href="/payouts">前往既有可付款項準備</a><p>財務人員須另核對作業核准的規則與截止時間；準備動作涵蓋所有符合條件來源，並非逐筆核准。</p>{data.nextCursor&&<button onClick={()=>{setCursor(data.nextCursor!);setAsOf(data.asOf);}}>未建應付來源下一頁</button>}{cursor&&<button onClick={reset}>未建應付來源第一頁</button>}<button onClick={()=>void query.refetch()}>重新查閱未建應付來源</button></>}</Card></section>;
}
