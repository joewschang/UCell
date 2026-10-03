import {useState} from 'react';
import {getPendingPlacements,placePendingQualification,type PendingPlacement} from './memberData';
import {useResource} from './useResource';
import {EmptyState,ErrorState,LoadingState} from '@ucell/design-system';

function formatDate(value:string|null){return value?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'尚未提供';}

function PlacementCard({row,onDone}:{row:PendingPlacement;onDone:()=>void}){
 const [parent,setParent]=useState(''),[side,setSide]=useState<'LEFT'|'RIGHT'>('LEFT'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(){if(busy)return;setBusy(true);setMessage('');try{await placePendingQualification(row.placementReference,parent.trim().toUpperCase(),side,crypto.randomUUID());setMessage('安置已完成。');onDone();}catch(error){setMessage(error instanceof Error?error.message:'安置失敗，請稍後重試。');}finally{setBusy(false);}}
 return <article className="card"><h3>待安置資格 {row.pendingBallNo??'尚待安置配號'}</h3><p>申請會員：{row.pendingMemberNo??'會員編號尚未提供'} · 推薦球：{row.sponsorBallNo??'尚未提供'}</p><p>套組：{row.packageType} · 付款：已確認 · 狀態：{row.status==='PLACEMENT_OVERDUE'?'已逾期':'待安置'}</p><p>申請時間：{formatDate(row.requestedAt)} · 截止：{formatDate(row.dueAt)}</p><label>二元父球編號<input value={parent} onChange={event=>setParent(event.target.value.toUpperCase())} placeholder="例如 A000001" autoComplete="off"/></label><fieldset><legend>安置位置</legend><label><input type="radio" checked={side==='LEFT'} onChange={()=>setSide('LEFT')}/> 左區</label><label><input type="radio" checked={side==='RIGHT'} onChange={()=>setSide('RIGHT')}/> 右區</label></fieldset><button disabled={busy||!parent.trim()} onClick={submit}>{busy?'安置中…':'確認安置'}</button>{message&&<p role="status">{message}</p>}</article>;
}

export default function PlacementWorkbench(){
 const state=useResource('pending-placements',getPendingPlacements);
 if(state.error)return <ErrorState message={state.error} retry={state.retry}/>;
 if(state.data===undefined)return <LoadingState label="正在讀取待安置項目…"/>;
 return <section aria-label="推薦人待安置工作台"><h3>待安置工作台</h3><p>只顯示您持有推薦球且已付款確認的項目。送出後由伺服器再次驗證推薦權限、二元位置與制度規則。</p>{state.data.length?state.data.map(row=><PlacementCard key={row.placementReference} row={row} onDone={state.retry}/>):<EmptyState title="目前沒有待安置項目"/>}</section>;
}

