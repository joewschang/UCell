import {PlacementMonitor} from './PlacementMonitor';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {ApiError,command,get,qs} from '../../lib/api';
import {useAuth} from '../auth/auth';
import './current-trees.css';

type Tree={binaryTreeId:string;treeCode:string;treeName:string;status:string;topologyVersion:number};
type Pending={qualificationId:string;ballNo:string;memberNo?:string;sponsorBallNo?:string};
type Side='LEFT'|'RIGHT';
type Node={qualificationId:string;ballNo:string;position:string;kind:string;slots:{side:Side;reason:string|null}[]};
type State={tree:Tree;observedAt:string;pending:{items:Pending[];total:number;nextCursor:string|null};candidate:{qualificationId:string;ballNo:string;sponsorBallNo?:string;sequence?:number;blocked:string|null}|null;breadcrumbs:{ballNo:string}[];nodes:Node[]};
type Preview={preflightToken:string;ballNo:string;parentBallNo:string;expectedVersion:number;expectedPath:string;expectedBinaryPositionNo:string};
const base='/admin/organization/trees';
const reasons:Record<string,string>={BINARY_LEFT_SUBTREE_REQUIRED:'第 1、3 位推薦球須安置於推薦球的左子樹。',SPONSOR_SUBTREE_REQUIRED:'請在推薦球下方選擇安置位置。',SPONSOR_CONFIRMATION_MISSING:'尚未確認有效推薦球，請先補正推薦資料。',PLACEMENT_NOT_PENDING:'資格尚未進入待安置階段，請先確認審核與資格資料。',FORMAL_MEMBERSHIP_REQUIRED:'會員資格尚未通過，或這顆球已停用。',QUALIFYING_ORDER_NOT_PAID:'資格套組尚未完成付款確認。',BINARY_TREE_SCOPE_MISMATCH:'這顆球不屬於目前選取的樹。',TREE_NOT_OPEN_TO_PLACEMENT:'這棵樹目前未開放新增安置。',FOUNDING_COMPANY_SPONSOR_REQUIRED:'此創始位置僅接受指定公司球推薦的資格。',QUALIFICATION_ALREADY_PLACED:'這顆球已完成安置，請重新整理。',TREE_BALL_NOT_FOUND:'在目前樹中找不到這個已安置球號。',UNPLACED_TREE_BALL_REQUIRED:'在目前樹中找不到這個待安置球號。',TREE_VERSION_CONFLICT:'組織已變動，請重新整理後再次選擇位置。',PLACEMENT_PREFLIGHT_STALE:'預檢資料已失效，請重新整理並再次預檢。',BINARY_SLOT_OCCUPIED:'位置已被占用，請重新整理。'};
function message(error:unknown){
 if(error instanceof ApiError){const b=error.body as {code?:string;error?:{code?:string};message?:{code?:string}}|null;const code=b?.code??b?.error?.code??b?.message?.code;return (code&&reasons[code])||(error.status===409?'資料或位置已變動，請重新整理後再預檢。':error.message);}
 return '無法完成操作，請重試；若仍失敗，請聯絡系統管理員。';
}
const statusName=(s:string)=>({ACTIVE:'開放安置',DRAFT:'草稿',CLOSED_TO_NEW:'暫停新增',ARCHIVED:'已封存'}[s]??'狀態待確認');

export function BinaryTreesPage(){
 const {id}=useParams(),navigate=useNavigate(),{user}=useAuth(),[params]=useSearchParams();
 const [trees,setTrees]=useState<Tree[]>([]),[treeCursor,setTreeCursor]=useState<string|null>(null),[state,setState]=useState<State|null>(null);
 const [tab,setTab]=useState<'tree'|'pending'>('tree'),[ball,setBall]=useState(''),[focus,setFocus]=useState(''),[candidate,setCandidate]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const [preview,setPreview]=useState<(Preview&{qualificationId:string;side:Side;key:string})|null>(null),[reason,setReason]=useState('');
 const [treeName,setTreeName]=useState(''),[treeCode,setTreeCode]=useState(''),[settingsReason,setSettingsReason]=useState('');
 const epoch=useRef(0),writeLock=useRef(false),currentId=useRef(id),attemptReason=useRef<string|null>(null);currentId.current=id;
 const canManage=user?.role==='SUPER_ADMIN',canPlace=['SUPER_ADMIN','QUALIFICATION_PLACEMENT_OVERRIDE'].includes(user?.role??'');
 useEffect(()=>{const c=new AbortController();void get<{data:{items:Tree[];nextCursor:string|null}}>(base+'/current',{signal:c.signal}).then(r=>{setTrees(r.data.items);setTreeCursor(r.data.nextCursor)}).catch(e=>{if(!c.signal.aborted)setError(message(e))});return ()=>c.abort()},[revision]);
 useEffect(()=>{setFocus(params.get('ballNo')??'');setCandidate(params.get('candidateBallNo')??'');setPreview(null);setBall('');setState(null);setTab('tree');setError('');setNotice('');setReason('');epoch.current++;},[id,params]);
 useEffect(()=>{
  if(!id)return;
  const c=new AbortController(),serial=++epoch.current;setBusy(true);setError('');setPreview(null);
  void get<{data:State}>(base+'/'+id+'/current-state'+qs({ballNo:focus||undefined,candidateBallNo:candidate||undefined}),{signal:c.signal}).then(r=>{
   if(serial!==epoch.current)return;setState(r.data);setTreeName(r.data.tree.treeName);
  }).catch(e=>{if(!c.signal.aborted&&serial===epoch.current){setState(null);setError(message(e));}}).finally(()=>{if(serial===epoch.current)setBusy(false)});
  return ()=>c.abort();
 },[id,focus,candidate,revision]);
 const refresh=()=>{setPreview(null);setRevision(v=>v+1)};
 async function moreTrees(){setBusy(true);try{const r=await get<{data:{items:Tree[];nextCursor:string|null}}>(base+'/current'+qs({after:treeCursor}));setTrees(old=>[...old,...r.data.items.filter(t=>!old.some(o=>o.binaryTreeId===t.binaryTreeId))]);setTreeCursor(r.data.nextCursor)}catch(e){setError(message(e))}finally{setBusy(false)}}
 async function morePending(){if(!state?.pending.nextCursor)return;const selected=id,serial=epoch.current;setBusy(true);try{
  const r=await get<{data:State}>(base+'/'+id+'/current-state'+qs({after:state.pending.nextCursor,ballNo:focus||undefined,candidateBallNo:candidate||undefined}));
  if(currentId.current===selected&&epoch.current===serial)setState(old=>old?{...r.data,pending:{...r.data.pending,items:[...old.pending.items,...r.data.pending.items.filter(n=>!old.pending.items.some(o=>o.qualificationId===n.qualificationId))]}}:r.data);
 }catch(e){if(currentId.current===selected&&epoch.current===serial)setError(message(e))}finally{if(currentId.current===selected&&epoch.current===serial)setBusy(false)}}
 function selectCandidate(value:string){setCandidate(value);setFocus('');setTab('tree');setPreview(null);setReason('');setNotice('已選擇待安置球，請從推薦球往下展開並選擇位置。')}
 async function check(node:Node,side:Side){if(!state?.candidate||writeLock.current)return;attemptReason.current=null;const serial=epoch.current;setBusy(true);setError('');setPreview(null);try{
  const r=await get<{data:Preview}>(base+'/'+id+'/placement-preview'+qs({qualificationId:state.candidate.qualificationId,binaryParentBallNo:node.ballNo,side,expectedVersion:state.tree.topologyVersion}));
  if(serial===epoch.current)setPreview({...r.data,qualificationId:state.candidate.qualificationId,side,key:crypto.randomUUID()});
 }catch(e){if(serial===epoch.current)setError(message(e))}finally{if(serial===epoch.current)setBusy(false)}}
 async function place(){if(!preview||!reason.trim()||writeLock.current)return;writeLock.current=true;setBusy(true);setError('');const selected=id,serial=epoch.current;
  attemptReason.current??=reason.trim();
  try{const r=await command<{data:{ballNo:string;parentBallNo:string}}>(base+'/'+id+'/placements',{qualificationId:preview.qualificationId,binaryParentBallNo:preview.parentBallNo,side:preview.side,expectedVersion:preview.expectedVersion,preflightToken:preview.preflightToken,reason:attemptReason.current},preview.key);
   if(currentId.current!==selected||epoch.current!==serial)return;setNotice('安置完成：'+r.data.ballNo+' → '+r.data.parentBallNo+' '+(preview.side==='LEFT'?'左側':'右側')+'。');setCandidate('');setFocus(r.data.ballNo);setPreview(null);setRevision(v=>v+1);
  }catch(e){if(currentId.current===selected&&epoch.current===serial){setError(message(e));if(e instanceof ApiError&&e.status!==0&&e.status<500)setPreview(null);else setError('尚未確認安置結果。請保留這個確認視窗，按「確認安置」安全重試同一筆操作。');}}
  finally{writeLock.current=false;if(currentId.current===selected&&epoch.current===serial)setBusy(false)}
 }
 async function saveTree(status?:string){if(writeLock.current)return;writeLock.current=true;setBusy(true);setError('');const selected=id,serial=epoch.current;try{
  const r=await command<{data:{binaryTreeId:string}}>(id?base+'/'+id+'/settings':base,{reason:settingsReason.trim(),...(id?{expectedVersion:state?.tree.topologyVersion,...(status?{status}:{treeName:treeName.trim()})}:{treeName:treeName.trim(),treeCode:treeCode.trim().toUpperCase()})});
  if(currentId.current!==selected||epoch.current!==serial)return;setNotice(id?'樹設定已儲存。':'已建立樹與 7 顆公司球。');setSettingsReason('');setRevision(v=>v+1);if(!id)navigate(base+'/'+r.data.binaryTreeId);
 }catch(e){if(currentId.current===selected&&epoch.current===serial)setError(message(e))}finally{writeLock.current=false;if(currentId.current===selected&&epoch.current===serial)setBusy(false)}}
 const root=state?.nodes[0],transitions=state?({DRAFT:['ACTIVE','ARCHIVED'],ACTIVE:['CLOSED_TO_NEW'],CLOSED_TO_NEW:['ACTIVE','ARCHIVED']}[state.tree.status]??[]):[];
 function renderNode(node:Node,depth=0):ReactNode{
  const children=state!.nodes.filter(n=>BigInt(n.position)/2n===BigInt(node.position));
  return <div className="ct-branch" key={node.ballNo}><article className={'ct-ball '+(node.kind==='COMPANY_BOOTSTRAP'?'ct-company':'')}>
   <span className="ct-pill">{node.kind==='COMPANY_BOOTSTRAP'?'公司球':'會員球'}</span><strong>{node.ballNo}</strong>
   <button disabled={busy||preview!==null} onClick={()=>setFocus(node.ballNo)} aria-label={'展開 '+node.ballNo}>往下展開 ↓</button>
   {canPlace&&node.slots.length>0&&<div className="ct-slots">{node.slots.map(slot=><div key={slot.side}><button disabled={busy||!!slot.reason||preview!==null} onClick={()=>void check(node,slot.side)}>{slot.side==='LEFT'?'＋ 左側':'＋ 右側'}</button>{slot.reason&&<small>{reasons[slot.reason]??'此位置目前不符合安置規則。'}</small>}</div>)}</div>}
  </article>{depth<2&&children.length>0&&<div className="ct-children">{children.map(child=><div className="ct-child" key={child.ballNo}><span>{BigInt(child.position)%2n===0n?'左側':'右側'}</span>{renderNode(child,depth+1)}</div>)}</div>}</div>;
 }
 return <section className="current-trees"><PlacementMonitor/><header className="ct-heading"><div><span className="ct-eyebrow">組織與安置</span><h1>多樹管理</h1><p>選擇樹查看目前組織，或從待安置球開始安排位置。</p></div><button disabled={busy||preview!==null} onClick={refresh}>重新整理</button></header>
  {error&&<div className="ct-error" role="alert">{error}{!preview&&<button disabled={busy} onClick={()=>{setFocus('' );setCandidate('' );refresh()}}>返回樹根並重新載入</button>}</div>}{notice&&<div className="ct-notice" role="status">{notice}</div>}{busy&&<p role="status">正在處理，請稍候…</p>}
  <div className="ct-layout"><aside className="ct-sidebar" aria-label="樹清單"><h2>樹清單</h2>{trees.map(tree=><button key={tree.binaryTreeId} disabled={busy||preview!==null} aria-current={id===tree.binaryTreeId?'page':undefined} onClick={()=>navigate(base+'/'+tree.binaryTreeId)}><strong>{tree.treeCode}</strong><span>{tree.treeName}</span><small>{statusName(tree.status)}</small></button>)}{treeCursor&&<button disabled={busy} onClick={()=>void moreTrees()}>載入更多樹</button>}{canManage&&<button disabled={busy||preview!==null} onClick={()=>{navigate(base);setTreeName('');setTreeCode('')}}>＋ 新增樹</button>}</aside>
  <main className="ct-main">{!id&&<div className="ct-welcome"><h2>請選擇一棵樹</h2><p>點選左側樹編號，展開目前組織及待安置球。</p></div>}
  {state&&id&&<><div className="ct-title"><div><h2>{state.tree.treeCode} 樹 · {state.tree.treeName}</h2><span>{statusName(state.tree.status)}</span></div><small>更新於 {new Date(state.observedAt).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei'})}</small></div>
   <nav className="ct-tabs" aria-label="組織檢視"><button aria-pressed={tab==='tree'} disabled={busy||preview!==null} onClick={()=>setTab('tree')}>目前組織</button><button aria-pressed={tab==='pending'} disabled={busy||preview!==null} onClick={()=>setTab('pending')}>待安置球（{state.pending.total}）</button></nav>
   <form className="ct-search" onSubmit={e=>{e.preventDefault();if(!ball.trim())return;if(tab==='pending')selectCandidate(ball.trim().toUpperCase());else setFocus(ball.trim().toUpperCase())}}><label htmlFor="ct-search-ball">{tab==='pending'?'待安置球號':'查詢球號'}</label><input id="ct-search-ball" value={ball} onChange={e=>setBall(e.target.value)} placeholder="輸入完整球號" maxLength={71}/><button disabled={busy||!ball.trim()||preview!==null}>查詢</button></form>
   {tab==='pending'?<div className="ct-pending"><p>此樹已建立、尚未安置的球。選擇後從推薦球開始找位置。</p>{state.pending.items.length===0?<p>目前沒有待安置球。</p>:<table><thead><tr><th>球號</th><th>會員編號</th><th>推薦球</th><th>操作</th></tr></thead><tbody>{state.pending.items.map(item=><tr key={item.qualificationId}><td><strong>{item.ballNo}</strong></td><td>{item.memberNo??'尚未綁定'}</td><td>{item.sponsorBallNo??'尚未確認推薦球'}</td><td>{canPlace?<button disabled={busy} onClick={()=>selectCandidate(item.ballNo)}>選擇安置</button>:<span>唯讀</span>}</td></tr>)}</tbody></table>}{state.pending.nextCursor&&<button disabled={busy} onClick={()=>void morePending()}>載入更多待安置球</button>}<small>已顯示 {state.pending.items.length} / {state.pending.total} 顆</small></div>:<>
    {state.candidate&&<div className="ct-selection"><div><strong>正在安置 {state.candidate.ballNo}</strong><p>推薦球 {state.candidate.sponsorBallNo??'尚未確認'} · 推薦序號 {state.candidate.sequence??'待確認'}</p><small>{state.candidate.blocked?reasons[state.candidate.blocked]:'點選球往下展開，再選擇左側或右側可用位置。'}</small></div><button disabled={busy||preview!==null} onClick={()=>{setCandidate('');setFocus('');setPreview(null)}}>取消安置</button></div>}
    <nav className="ct-breadcrumbs" aria-label="目前組織路徑">{state.breadcrumbs.map((b,index)=><span key={b.ballNo}>{index>0&&' › '}<button disabled={busy||preview!==null} onClick={()=>setFocus(b.ballNo)}>{b.ballNo}</button></span>)}</nav>
    <div className="ct-canvas">{root?renderNode(root):<p>尚未有組織節點。</p>}</div><p className="ct-hint">{candidate?'預檢通過後仍需確認安置；送出時會再次檢查規則與位置。':'只顯示已有球的節點。點選「往下展開」可繼續查看下一層。'}</p>
   </>}
  </>}
  {canManage&&(!id||state)&&<details className="ct-settings"><summary>{id?'樹設定':'建立新樹'}</summary><form onSubmit={e=>{e.preventDefault();void saveTree()}}>{!id&&<label>樹編號<input required pattern="[A-Z][A-Z0-9_-]{0,39}" value={treeCode} onChange={e=>setTreeCode(e.target.value.toUpperCase())}/></label>}<label>樹名稱<input required maxLength={120} value={treeName} onChange={e=>setTreeName(e.target.value)}/></label><label>操作原因<input required maxLength={500} value={settingsReason} onChange={e=>setSettingsReason(e.target.value)}/></label><button disabled={busy||preview!==null||!settingsReason.trim()||!treeName.trim()}>{id?'儲存名稱':'建立樹與 7 顆公司球'}</button>{transitions.map(status=><button key={status} type="button" disabled={busy||preview!==null||!settingsReason.trim()} onClick={()=>void saveTree(status)}>{statusName(status)}</button>)}</form></details>}
  </main></div>
  {preview&&<div className="ct-modal-backdrop"><section className="ct-modal" role="dialog" aria-modal="true" aria-labelledby="ct-confirm-title" onKeyDown={e=>{if(e.key!=='Tab')return;const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}}><h2 id="ct-confirm-title">確認安置位置</h2><p>預檢通過，請確認以下資料。</p><dl><dt>待安置球</dt><dd>{preview.ballNo}</dd><dt>父球</dt><dd>{preview.parentBallNo}</dd><dt>方向</dt><dd>{preview.side==='LEFT'?'左側':'右側'}</dd></dl><label>安置原因<input autoFocus disabled={busy||attemptReason.current!==null} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="請填寫原因，供日後查核"/></label><p>此位置尚未保留，送出時仍會重新檢查。</p>{error&&<p role="alert" className="ct-error">{error}</p>}<div className="ct-actions"><button disabled={busy} onClick={()=>setPreview(null)}>返回選擇</button><button className="ct-primary" disabled={busy||!reason.trim()} onClick={()=>void place()}>{busy?'安置處理中…':'確認安置'}</button></div></section></div>}
 </section>;
}
