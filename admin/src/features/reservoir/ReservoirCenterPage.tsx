import {useEffect,useRef,useState} from 'react';
import {get,qs} from '../../lib/api';
import {Card,ErrorBox,Field,PageHeader,Badge} from '../../components/ui';
type Entry={id:string;effectType:string;amount:string;recordedAt:string;tree?:string;position?:number|null;qualificationId?:string;awardType?:string;settlement?:string;periodStart:string;periodEnd:string;ruleVersion:string;snapshotHash:string;replayPostingId?:string|null};
type Ledger={kind:'A'|'B';time:Record<string,string>;status:string;items:Entry[];total:number;periodInflow:string;cumulative:string;lastUpdated:string|null;dataThrough:string;nextCursor:string|null;snapshotToken:string;definitionVersion:string};
function context(month:string){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('請選擇有效月份');const [year,m]=month.split('-').map(Number),now=new Date().toISOString();return {timezone:'Asia/Taipei',asOf:now,knowledgeCutoff:now,periodStart:new Date(Date.UTC(year,m-1,1)-8*3600000).toISOString(),periodEnd:new Date(Date.UTC(year,m,1)-8*3600000).toISOString()};}
const labels:Record<string,string>={amount:'Reservoir effect',kind:'分錄類型',theory:'Theory',k:'K',final:'原始 Final',awardType:'Award Type',companyBall:'Company Ball',profile:'Profile',tree:'Tree',position:'Position',economicDestination:'Economic Destination',sourceRecognition:'Source Recognition',settlement:'Settlement',snapshotHash:'Snapshot Hash'};
export function ReservoirCenterPage(){
 const [kind,setKind]=useState<'A'|'B'>('B'),[month,setMonth]=useState(()=>new Date(Date.now()+8*3600000).toISOString().slice(0,7));
 const [tree,setTree]=useState(''),[position,setPosition]=useState(''),[awardType,setAwardType]=useState('');
 const [data,setData]=useState<Ledger|null>(null),[error,setError]=useState<unknown>(null),[busy,setBusy]=useState(false),[explanation,setExplanation]=useState<any>(null);
 const serial=useRef(0),applied=useRef<Record<string,string|undefined>>({});
 async function load(next=false){
  const request=++serial.current;setBusy(true);setError(null);setExplanation(null);
  setData(null);
  try{const query=next?{...applied.current,after:data?.nextCursor??undefined,snapshotToken:data?.snapshotToken}:{...context(month),kind,tree:kind==='B'&&tree?tree:undefined,position:kind==='B'&&position?position:undefined,awardType:kind==='B'&&awardType?awardType:undefined};
  if(!next)applied.current=query;
  const result=await get<{data:Ledger}>('/admin/finance/reservoirs'+qs(query));if(request===serial.current)setData(result.data);}
  catch(e){if(request===serial.current)setError(e);}finally{if(request===serial.current)setBusy(false);}
 }
 useEffect(()=>{void load();return ()=>{serial.current++;};},[kind]);
 async function explain(entry:Entry){
  if(!data)return;const request=++serial.current;setBusy(true);setError(null);setExplanation(null);
  try{const result=await get<any>('/admin/explain/reservoir'+qs({...data.time,periodStart:entry.periodStart,periodEnd:entry.periodEnd,tool:kind==='A'?'explainReservoirA':'explainReservoirB',resourceId:entry.id}));if(request===serial.current)setExplanation(result);}
  catch(e){if(request===serial.current)setError(e);}finally{if(request===serial.current)setBusy(false);}
 }
 return <><PageHeader title="Reservoir Center" subtitle="財務／治理 · 依權威分錄查詢，僅流入；退貨與 Replay 以調整分錄保留歷史。"/>
 <div role="tablist" aria-label="Reservoir 分區">{(['A','B'] as const).map(k=><button role="tab" aria-selected={kind===k} key={k} disabled={busy} onClick={()=>setKind(k)}>Reservoir {k} · {k==='A'?'Global 未分配':'Company Ball 權益'}</button>)}</div>
 <Card title={'Reservoir '+kind}><div className="form"><Field label="來源期間（台北月份）"><input type="month" value={month} disabled={busy} onChange={e=>setMonth(e.target.value)}/></Field>
 {kind==='B'&&<><Field label="Tree ID（可留空）"><input value={tree} disabled={busy} onChange={e=>setTree(e.target.value)}/></Field>
 <Field label="公司位置"><select value={position} disabled={busy} onChange={e=>setPosition(e.target.value)}><option value="">全部</option>{[1,2,3].map(n=><option key={n} value={n}>#{n} LEADER</option>)}</select></Field>
 <Field label="獎金類型"><select value={awardType} disabled={busy} onChange={e=>setAwardType(e.target.value)}><option value="">全部</option>{['REFERRAL','EQUALIZATION','BINARY','MATCHING','EPV','RPV','GLOBAL'].map(t=><option key={t}>{t}</option>)}</select></Field></>}
 <button disabled={busy||!/^\d{4}-\d{2}$/.test(month)} onClick={()=>void load()}>套用條件並更新快照</button></div></Card>
 <ErrorBox error={error}/>{busy&&<p role="status">載入中…</p>}
 {data&&<><Card title="權威帳本"><p><Badge>{data.status}</Badge> · TWD · {data.definitionVersion}</p><dl><dt>期間淨流入（含 Replay 調整）</dt><dd>{data.periodInflow}</dd><dt>截至查詢時間累積</dt><dd>{data.cumulative}</dd><dt>Last Updated</dt><dd>{data.lastUpdated??'尚無分錄'}</dd><dt>Data Through</dt><dd>{data.dataThrough}</dd></dl>
 {data.status==='STALE'&&<p role="alert">有退貨或 Replay 尚未收斂；以下為快照中已入帳分錄，不代表最新完整 entitlement。請待處理完成後更新快照。</p>}<p>來源期間：{data.time.periodStart} 至 {data.time.periodEnd}（不含結束）。後续分頁固定使用同一快照。</p></Card>
 <Card title={'Reservoir '+data.kind+' 分錄（'+data.total+'）'}>{data.items.length?<div className="table-wrap"><table><thead><tr><th>Effect</th><th>Amount</th>{kind==='B'&&<><th>Tree</th><th>Position</th><th>Award Type</th></>}<th>Settlement</th><th>Replay Adjustment</th><th>Last Updated</th><th>Evidence</th></tr></thead><tbody>{data.items.map(e=><tr key={e.id}><td>{e.effectType}</td><td>{e.amount}</td>{kind==='B'&&<><td>{e.tree}</td><td>{e.position?'#'+e.position:'Member-origin'}</td><td>{e.awardType}</td></>}<td>{e.settlement??'Recognition'}</td><td>{e.replayPostingId??'—'}</td><td>{e.recordedAt}</td><td><button disabled={busy} onClick={()=>void explain(e)}>Explain Reservoir {kind}</button></td></tr>)}</tbody></table></div>:<p>此期間及篩選條件沒有分錄。</p>}
 {data.nextCursor&&<button disabled={busy} onClick={()=>void load(true)}>下一頁</button>}</Card></>}
 {explanation&&<Card title={'Explain Reservoir '+kind}><p><Badge>{explanation.status}</Badge> · {explanation.explainCode}</p>{explanation.result?<><dl>{Object.entries(explanation.result).map(([k,v])=><div key={k}><dt>{labels[k]??k}</dt><dd style={{overflowWrap:'anywhere'}}>{String(v)}</dd></div>)}<dt>RuleVersion</dt><dd>{explanation.ruleVersion}</dd><dt>ParameterVersion</dt><dd>{explanation.parameterVersion}</dd></dl><ul>{explanation.evidenceRefs.map((r:any)=><li key={r.type+r.id}>{r.type} · {r.id}</li>)}</ul></>:<p>此時間沒有可驗證的完整證據。</p>}</Card>}
 </>;
}
