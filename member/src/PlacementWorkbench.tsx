import {useRef,useState} from 'react';
import {getPendingPlacements,getPlacementBranch,placePendingQualification,type PendingPlacement} from './memberData';
import {MemberApiError} from './api';
import {useResource} from './useResource';
import {placementReasons,placementDate,placementStatus} from '../../shared/placement-copy';
import {EmptyState,ErrorState,LoadingState} from '@ucell/design-system';
import './placement-workbench.css';

function errorText(e:unknown){return e instanceof MemberApiError&&e.code&&placementReasons[e.code]|| (e instanceof Error?e.message:'無法完成操作，請稍後重試。');}
function PlacementEditor({row,onDone,onClose}:{row:PendingPlacement;onDone:(receipt:string)=>void;onClose:()=>void}){
 const [focus,setFocus]=useState(''),[search,setSearch]=useState(''),[selection,setSelection]=useState<{parent:string;side:'LEFT'|'RIGHT';key:string}|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);const lock=useRef(false);
 const branch=useResource(`placement:${row.placementReference}:${focus}`,s=>getPlacementBranch(row.placementReference,focus,s));
 async function submit(){if(!selection||lock.current)return;lock.current=true;setBusy(true);setError('');try{
  const result=await placePendingQualification(row.placementReference,selection.parent,selection.side,selection.key);
  onDone(`安置完成：${result.ballNo} → ${selection.parent} ${selection.side==='LEFT'?'左側':'右側'}，完成時間 ${placementDate(result.placedAt as string)}。`);
 }catch(e){const unknown=!(e instanceof MemberApiError)||e.status===0||e.status>=500;setUncertain(unknown);setError(unknown?'尚未確認安置結果。請按「安全重試」查回同一筆操作結果；請勿重新建立另一筆安置。':errorText(e));if(!unknown){setSelection(null);branch.retry();}}finally{lock.current=false;setBusy(false)}}
 const data=branch.data;
 return <section className="pw-editor" aria-label="選擇安置位置"><header><h3>安置 {row.pendingBallNo}</h3><button disabled={busy||uncertain} onClick={onClose}>返回待辦</button></header>
 <ol className="pw-steps"><li>選擇待安置球</li><li aria-current={!selection?'step':undefined}>選擇位置</li><li aria-current={selection?'step':undefined}>確認安置</li></ol>
 <p>推薦球 <strong>{row.sponsorBallNo}</strong> · 會員 {row.pendingMemberNo}。第 1、3 位推薦須放在推薦球左子樹；可逐層往下找位置。</p>
 {error&&<p role="alert" className="pw-warning">{error}</p>}
 {selection?<section className="pw-confirm" aria-label="確認安置"><h4>請確認安置資料</h4><dl><dt>待安置球</dt><dd>{row.pendingBallNo}</dd><dt>推薦球</dt><dd>{row.sponsorBallNo}</dd><dt>父球與方向</dt><dd>{selection.parent} · {selection.side==='LEFT'?'左側':'右側'}</dd></dl><p>位置尚未保留，送出時會再次檢查權限及規則。完成後不可在此自行移動。</p><button disabled={busy||uncertain} onClick={()=>setSelection(null)}>返回選位置</button><button disabled={busy} onClick={()=>void submit()}>{busy?'正在確認安置…':uncertain?'安全重試':'確認並完成安置'}</button></section>:<>
 <form className="pw-search" onSubmit={e=>{e.preventDefault();setError('');setFocus(search.trim().toUpperCase())}}><label>查詢推薦球下方的球號<input value={search} onChange={e=>setSearch(e.target.value)} maxLength={65} placeholder="輸入完整球號"/></label><button disabled={!search.trim()}>查詢</button><button type="button" onClick={()=>{setFocus('');branch.retry()}}>回推薦球／重新整理</button></form>
 {branch.error?<ErrorState message={errorText(branch.errorCause)} retry={branch.retry}/>:!data?<LoadingState label="正在讀取可安置位置…"/>:<><nav aria-label="安置瀏覽路徑">{data.breadcrumbs.map(b=><button key={b.ballNo} onClick={()=>setFocus(b.ballNo)}>{b.ballNo}</button>)}</nav>{data.blocked&&<p role="alert" className="pw-warning">{placementReasons[data.blocked]??'此球目前無法安置，請洽公司確認。'}</p>}<div className="pw-nodes">{data.nodes.map(n=><article className="pw-node" key={n.ballNo}><strong>{n.ballNo}</strong><button onClick={()=>setFocus(n.ballNo)}>從此球往下展開</button><div className="pw-slots">{n.slots.map(slot=><div key={slot.side}><button disabled={!!slot.reason} onClick={()=>{setError('');setSelection({parent:n.ballNo,side:slot.side,key:crypto.randomUUID()})}}>選擇{slot.side==='LEFT'?'左側':'右側'}</button>{slot.reason&&<small>{placementReasons[slot.reason]??'目前不符合安置規則。'}</small>}</div>)}</div>{!n.slots.length&&<small>左右位置已有球，請往下展開。</small>}</article>)}</div><p>畫面更新於 {placementDate(data.observedAt)}。只顯示推薦球下方組織。</p></>}
 </>}
 </section>;
}
export default function PlacementWorkbench(){
 const state=useResource('pending-placements',getPendingPlacements),[selected,setSelected]=useState<PendingPlacement|null>(null),[receipt,setReceipt]=useState(''),[filter,setFilter]=useState('');
 const rows=state.data??[],shown=rows.filter(r=>`${r.pendingBallNo} ${r.sponsorBallNo} ${r.pendingMemberNo}`.toUpperCase().includes(filter.trim().toUpperCase()));
 return <section className="card placement-workbench" aria-label="推薦人待安置工作台"><h3>推薦球安置</h3><p>正式會員審核及付款確認後，由推薦球持有人選擇位置。球號已先建立，完成安置後沿用同一球號。</p>{receipt&&<p role="status" className="pw-success">{receipt}</p>}
 {selected?<PlacementEditor key={selected.placementReference} row={selected} onClose={()=>setSelected(null)} onDone={r=>{setReceipt(r);setSelected(null);state.retry()}}/>:<><div className="pw-toolbar"><strong>本次待辦 {rows.length} 筆 · 逾期 {rows.filter(r=>r.status==='PLACEMENT_OVERDUE').length} 筆</strong><button onClick={state.retry}>重新整理待辦</button></div><label>篩選球號／會員編號<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="待安置球、推薦球或會員編號"/></label>
 {state.error?<ErrorState message={state.error} retry={state.retry}/>:!state.data?<LoadingState label="正在讀取待安置項目…"/>:shown.length?<div className="pw-list">{shown.map(row=><article className="pw-node" key={row.placementReference}><header><strong>{row.pendingBallNo??'球號待確認'}</strong><span className={row.status==='PLACEMENT_OVERDUE'?'pw-warning':''}>{placementStatus[row.status]}</span></header><p>會員 {row.pendingMemberNo??'尚未提供'} · 推薦球 {row.sponsorBallNo??'待確認'}</p><p>套組：{({STARTER:'啟航',ELITE:'菁英',LEADER:'領袖'} as Record<string,string>)[row.packageType]??row.packageType}</p><p>等待起始：{placementDate(row.requestedAt)}<br/>截止：{placementDate(row.dueAt)}</p><button disabled={!row.pendingBallNo||!row.sponsorBallNo} onClick={()=>{setReceipt('');setSelected(row)}}>選擇安置位置</button></article>)}</div>:<EmptyState title={filter?'沒有符合條件的待辦':'目前沒有待安置項目'}><p>若已付款但未出現，請先確認正式會員審核及推薦球資料是否完成。</p></EmptyState>}{rows.length>=100&&<p>本次最多顯示 100 筆，完成後重新整理可查看後續待辦。</p>}</>}
 </section>;
}
