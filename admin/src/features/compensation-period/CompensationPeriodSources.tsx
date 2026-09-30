import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Card,Field} from '../../components/ui';
import {QueryFeedback} from '../../components/QueryFeedback';
import {get,qs} from '../../lib/api';
type Selection={periodStart:string;periodEnd:string;ruleVersionCode:string};
type Item={reference:string;sourceType:string;awardType:string;qualificationNo:string;theory:string|null;originalAward:string;mature:boolean;company:boolean;ownershipLink:string;replay:{count:number;signedAdjustment:string};payable:{reference:string;gross:string;status:string;link:string}|null;recoveries:{reference:string;required:string;applied:string;outstanding:string;link:string}[];payment:{reference:string;status:string;lineReference:string;gross:string;recoveryOffset:string;net:string;bankConfirmed:string;confirmationCount:number;sharedSources:number;amountScope:string;link:string}|null};
type Page={items:Item[];asOf:string;dataThrough:string;nextCursor:string|null;periodSourceCount:number};
const labels:Record<string,string>={REFERRAL:'推薦',EQUALIZATION:'平級',BINARY:'雙軌',MATCHING:'對等',GLOBAL:'全球分紅',RPV:'RPV',EPV:'EPV',RETAIL_REFERRAL:'零售推薦'};
export function CompensationPeriodSources({selection}:{selection:Selection}){
 const [draft,setDraft]=useState({awardType:'',qualificationNo:''}),[filter,setFilter]=useState(draft),[cursor,setCursor]=useState<string>(),[asOf,setAsOf]=useState<string>();
 const reset=()=>{setCursor(undefined);setAsOf(undefined);};
 const query=useQuery({queryKey:['compensation-period-sources',selection,filter,cursor,asOf],queryFn:()=>get<{data:Page}>('/admin/compensation-period-control/sources'+qs({...selection,...filter,take:25,cursor,asOf})),refetchInterval:60_000}),data=query.data?.data;
 return <Card title="獎金來源與付款明細"><form onSubmit={event=>{event.preventDefault();setFilter({...draft});reset();}}><div className="filter-grid"><Field label="獎金類別"><select value={draft.awardType} onChange={event=>setDraft({...draft,awardType:event.target.value})}><option value="">全部類別</option>{Object.entries(labels).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></Field><Field label="資格編號"><input inputMode="numeric" pattern="[0-9]{1,19}" value={draft.qualificationNo} onChange={event=>setDraft({...draft,qualificationNo:event.target.value})}/></Field></div><button type="submit">篩選來源</button></form>
 <p>原始獎金、Replay 正負調整與實際回收分開顯示。付款金額涵蓋整筆付款明細，可能合併多個來源，不能直接當成本來源或本期的付款分攤。</p><QueryFeedback query={query} empty={!!data&&!data.items.length}/>
 {data&&!query.error&&<><p>篩選範圍共 {data.periodSourceCount} 筆，本頁 {data.items.length} 筆；來源建立範圍截至 {new Date(data.asOf).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}，狀態讀取時間 {new Date(data.dataThrough).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}。</p>
 {data.items.map(item=><section key={item.reference}><h3>{labels[item.awardType]??item.awardType} · 資格 {item.qualificationNo}</h3><p>原始理論：{item.theory??'不適用'}；原始核定：{item.originalAward}；{item.mature?'已達成熟條件':'尚待成熟'}；{item.company?'已記錄 Company 去向':'尚無 Company 去向紀錄'}。</p><a href={item.ownershipLink}>查閱歷史所有權與 Reservoir B 去向</a><p>Replay 調整：{item.replay.signedAdjustment}（{item.replay.count} 筆）。</p>
 {item.payable?<p>應付毛額 {item.payable.gross} · <a href={item.payable.link}>查閱應付來源與處理證據</a></p>:<p>尚無此來源的應付；Company、零權益或未成熟來源可能不產生會員應付。</p>}
 {item.recoveries.map(row=><p key={row.reference}>回收應收 {row.required}／已抵扣 {row.applied}／尚待回收 {row.outstanding} · <a href={row.link}>查閱回收與處理證據</a></p>)}
 {item.payment?<div><p>整筆付款明細：毛額 {item.payment.gross}／回收抵扣 {item.payment.recoveryOffset}／淨額 {item.payment.net}／銀行累計確認 {item.payment.bankConfirmed}。</p><p>合併 {item.payment.sharedSources} 個應付來源；{item.payment.confirmationCount} 筆成功確認紀錄。零淨額也須有銀行確認。</p><a href={item.payment.link}>查閱付款批次與銀行結果</a></div>:<p>尚未連結付款明細。</p>}
 <details><summary>來源商業參考碼</summary>{item.reference}</details></section>)}
 {data.nextCursor&&<button onClick={()=>{setCursor(data.nextCursor!);setAsOf(data.asOf);}}>來源下一頁</button>}{cursor&&<button onClick={reset}>來源第一頁</button>}</>}
 </Card>;
}
