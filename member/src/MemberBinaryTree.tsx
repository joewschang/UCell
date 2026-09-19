import {useEffect,useState} from 'react';
import {MemberApiError,type Qualification} from './api';
import * as data from './memberData';
import {useResource} from './useResource';
import {EmptyState,ErrorState,LoadingState} from '@ucell/design-system';

/**
 * This viewer consumes the Member-safe tree projection only. It never has an
 * Admin tree, Company, holder, finance or Reservoir field to render.
 */
export default function MemberBinaryTree({q}:{q:Qualification}){
 const [parentBallNo,setParentBallNo]=useState<string|undefined>();
 const [snapshotToken,setSnapshotToken]=useState<string|undefined>();
 const [time,setTime]=useState(data.newMemberTreeTime);
 const [after,setAfter]=useState<string|undefined>();
 const [items,setItems]=useState<data.MemberTreeNode[]>([]);
 const [nextCursor,setNextCursor]=useState<string|null>(null);
 const [trail,setTrail]=useState<string[]>([q.code]);
 const [snapshotRecoveryRequired,setSnapshotRecoveryRequired]=useState(false);
 const snapshotRequestKey=after?snapshotToken??'new':'initial';
 const state=useResource(
  `member-tree:${q.code}:${parentBallNo??q.code}:${snapshotRequestKey}:${after??'first'}:${time.asOf}`,
  signal=>data.getMemberTree(q,parentBallNo,snapshotToken,time,after,signal),
  !snapshotRecoveryRequired,
 );

 const snapshotConflict=state.errorCause instanceof MemberApiError&&state.errorCause.status===409;

 useEffect(()=>{
  if(!snapshotConflict)return;
  setSnapshotRecoveryRequired(true);
  setParentBallNo(undefined);
  setSnapshotToken(undefined);
  setAfter(undefined);
  setItems([]);
  setNextCursor(null);
  setTrail([q.code]);
 },[q.code,snapshotConflict]);

 useEffect(()=>{
  const page=state.data;
  if(!page)return;
  if(page.snapshotToken&&page.snapshotToken!==snapshotToken)setSnapshotToken(page.snapshotToken);
  if(page.status!=='AVAILABLE'){
   setItems([]);
   setNextCursor(null);
   return;
  }
  setItems(previous=>after
   ?[...previous,...page.items.filter(node=>!previous.some(existing=>existing.ballNo===node.ballNo))]
   :page.items,
  );
  setNextCursor(page.nextCursor);
 },[after,snapshotToken,state.data]);

 const selectParent=(ballNo:string)=>{
  setParentBallNo(ballNo);
  setAfter(undefined);
  setItems([]);
  setNextCursor(null);
  setTrail(previous=>[...previous,ballNo]);
 };
 const resetToCurrentBall=()=>{
  setParentBallNo(undefined);
  setAfter(undefined);
  setItems([]);
  setNextCursor(null);
  setTrail([q.code]);
 };
 const goBack=()=>{
  const prior=trail.at(-2);
  if(!prior){resetToCurrentBall();return;}
  setParentBallNo(prior===q.code?undefined:prior);
  setAfter(undefined);
  setItems([]);
  setNextCursor(null);
  setTrail(previous=>previous.slice(0,-1));
 };
 const createNewSnapshot=()=>{
  setSnapshotRecoveryRequired(false);
  setSnapshotToken(undefined);
  setTime(data.newMemberTreeTime());
  resetToCurrentBall();
 };
 const page=state.data;
 const protectedBoundary=page?.hiddenBootstrapBoundary===true;
 const unavailable=page?.status==='UNAVAILABLE';
 const loadingFirstPage=!snapshotRecoveryRequired&&!page&&!after;
 const loadingMore=!page&&Boolean(after);

 return <section className="card uc-tree-status" aria-labelledby="member-safe-tree-title">
  <div>
   <small>MEMBER-SAFE BINARY TREE</small>
   <h3 id="member-safe-tree-title">獎金相關組織</h3>
  </div>
  <p>這是依目前球位與授權顯示的範圍，不代表整棵樹的根。</p>
  <div className="uc-tree-context" role="status" aria-live="polite">
   <span>目前檢視</span><strong>球編號 {page?.parentBallNo??parentBallNo??q.code}</strong>
   {snapshotToken&&<small>此檢視已固定在同一查詢快照；資料時間 {time.asOf}，記錄截點 {time.knowledgeCutoff}。重新整理後才會取得新資料。</small>}
  </div>
  {protectedBoundary&&<p className="uc-tree-boundary" role="status">此範圍有受保護的上游邊界，未在會員檢視中顯示。</p>}
  {snapshotRecoveryRequired?<section className="uc-tree-recovery" role="alert"><h4>組織快照已失效</h4><p>為避免混用不同時間點的組織資料，先前節點與分頁已清除。請明確建立新的快照後再查看。</p><button type="button" onClick={createNewSnapshot}>重新整理並建立新的快照</button></section>:<>
  {loadingFirstPage&&<LoadingState label="正在載入獎金相關組織…"/>}
  {state.error&&<ErrorState message={state.error} retry={state.retry}/>}
  {unavailable&&<EmptyState title="目前沒有可顯示的獎金相關組織"><p>資料尚未提供或不在目前授權範圍內。</p></EmptyState>}
  {!loadingFirstPage&&!state.error&&!unavailable&&<>
   {items.length?<div className="uc-node-list" aria-label="可展開的球編號">
    {items.map(node=><button type="button" className="uc-person-node uc-tree-node" key={node.ballNo} onClick={()=>selectParent(node.ballNo)} aria-label={`展開球編號 ${node.ballNo} 的下一層`}>
     <i aria-hidden="true"/><span><strong>{node.ballNo}</strong><small>位置號 {node.binaryPositionNo} · {node.side==='LEFT'?'左區':'右區'}</small></span><b aria-hidden="true">›</b>
    </button>)}
   </div>:<EmptyState title="此球目前沒有可顯示的下一層節點"><p>沒有資料不代表沒有組織，可能是目前授權範圍或資料尚未提供。</p></EmptyState>}
   {loadingMore&&<LoadingState label="正在載入更多可查看的節點…"/>}
   {nextCursor&&<button type="button" className="uc-tree-more" disabled={loadingMore} onClick={()=>setAfter(nextCursor)}>載入更多節點</button>}
  </>}
  </>}
  <div className="uc-tree-actions" aria-label="組織檢視操作">
   {!snapshotRecoveryRequired&&<>
    {trail.length>1&&<button type="button" onClick={goBack}>回上一層</button>}
    {parentBallNo&&<button type="button" onClick={resetToCurrentBall}>回到目前球</button>}
    <button type="button" onClick={createNewSnapshot}>重新整理組織</button>
   </>}
  </div>
 </section>;
}
