import {useEffect,useState} from 'react';
import type {Qualification} from './api';
import * as data from './memberData';
import {useResource} from './useResource';
import {EmptyState,ErrorState,LoadingState} from '@ucell/design-system';

/** Uses only the Member-safe DTO. It cannot render bootstrap, holder PII, Company or Reservoir data. */
export default function MemberBinaryTree({q}:{q:Qualification}){
 const [parentBallNo,setParentBallNo]=useState<string|undefined>(),[snapshotToken,setSnapshotToken]=useState<string|undefined>(),[time,setTime]=useState(data.newMemberTreeTime);
 const state=useResource(`member-tree:${q.code}:${parentBallNo??q.code}:${snapshotToken??'new'}:${time.asOf}`,signal=>data.getMemberTree(q,parentBallNo,snapshotToken,time,signal));
 useEffect(()=>{if(state.data?.snapshotToken&&state.data.snapshotToken!==snapshotToken)setSnapshotToken(state.data.snapshotToken);},[state.data,snapshotToken]);
 if(state.error)return <ErrorState message={state.error} retry={state.retry}/>;
 if(!state.data)return <LoadingState label="獎金相關組織載入中…"/>;
 const page=state.data;
 if(page.status!=='AVAILABLE')return <EmptyState title="目前沒有可顯示的獎金相關組織"/>;
 return <section className="card uc-tree-status" aria-label="獎金相關二元組織"><div><small>MEMBER-SAFE BINARY TREE</small><h3>獎金相關組織</h3></div><p>此檢視只顯示依目前球位與授權可見的節點，不代表整棵樹的根。</p>{page.hiddenBootstrapBoundary&&<p role="status">上游 Company Bootstrap 節點受保護，未在會員檢視中顯示。</p>}<p>目前展開：<strong>{page.parentBallNo??q.code}</strong></p>{page.items.length?<div className="uc-node-list">{page.items.map(node=><button type="button" className="uc-person-node" key={node.ballNo} onClick={()=>setParentBallNo(node.ballNo)} aria-label={`展開球 ${node.ballNo} 的下層`}><i aria-hidden="true"/><span><strong>{node.ballNo}</strong><small>位置 {node.binaryPositionNo} · {node.side==='LEFT'?'左區':'右區'}</small></span></button>)}</div>:<p>此球目前沒有可顯示的下一層節點。</p>}{parentBallNo&&<button type="button" onClick={()=>setParentBallNo(undefined)}>回到目前球</button>}<button type="button" onClick={()=>{setSnapshotToken(undefined);setParentBallNo(undefined);setTime(data.newMemberTreeTime());}}>重新整理組織</button></section>;
}
