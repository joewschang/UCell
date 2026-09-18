import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {command,get,qs} from '../../lib/api';
import {useAuth} from '../auth/auth';
import {Card,ErrorBox,Field,PageHeader,Badge} from '../../components/ui';
type Tree={binaryTreeId:string;treeCode:string;treeName:string;status:string;topologyVersion:number};
type Position={positionNo:number;parentPositionNo:number|null;side:string|null;qualificationId:string|null;ownerType:string|null;activeLabel:string|null;actualSponsorSequenceNo?:number|null;descendantBalls:number|null;distinctMemberPersons:number|null;newBallsInPeriod:number|null;leftDescendantBalls?:number|null;rightDescendantBalls?:number|null;performance?:{status:string;reason?:string|null;value:{cumulative:string;month:string}|null}|null;carry?:{status:string;reason?:string|null;value:{left:string;right:string}|null}|null};
type NodePage={status:string;total:number|null;nextCursor:string|null;items:Array<{qualificationId:string;parentQualificationId:string|null;side:string|null;depth:number;ownerType:string;activeLabel:string|null}>};
type Detail={status:string;result:(Tree&{positions:Position[]})|null;explainCode?:string};
function nowContext(){const now=new Date(),taipei=new Date(now.getTime()+8*3600000);return {timezone:'Asia/Taipei',asOf:now.toISOString(),knowledgeCutoff:now.toISOString(),periodStart:new Date(Date.UTC(taipei.getUTCFullYear(),taipei.getUTCMonth(),1)-8*3600000).toISOString(),periodEnd:new Date(Date.UTC(taipei.getUTCFullYear(),taipei.getUTCMonth()+1,1)-8*3600000).toISOString()};}
export function BinaryTreesPage(){
 const {id}=useParams(),navigate=useNavigate(),{user}=useAuth();
 const view=useRef(id),requestSerial=useRef(0);view.current=id;
 const [time,setTime]=useState(nowContext),[items,setItems]=useState<Tree[]>([]),[cursor,setCursor]=useState<string|null>(null),[detail,setDetail]=useState<Detail|null>(null);
 const [preflight,setPreflight]=useState<{preflightToken:string;actualSponsorSequenceNo:number;sponsorQualificationId:string}|null>(null);
 const [nodes,setNodes]=useState<NodePage|null>(null);
 const [name,setName]=useState(''),[reason,setReason]=useState(''),[qualification,setQualification]=useState(''),[parent,setParent]=useState(''),[side,setSide]=useState('LEFT');
 const [error,setError]=useState<unknown>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const manage=user?.role==='SUPER_ADMIN',confirmSponsor=['SUPER_ADMIN','MEMBERSHIP_OPS'].includes(user?.role??''),place=['SUPER_ADMIN','QUALIFICATION_PLACEMENT_OVERRIDE'].includes(user?.role??'');
 async function load(context=time,after?:string){
  const serial=++requestSerial.current,target=id;
  setBusy(true);setError(null);setDetail(null);setNodes(null);setPreflight(null);
  try{if(id){const response=await get<{data:Detail}>(`/admin/organization/trees/${id}`+qs(context));if(view.current!==target||serial!==requestSerial.current)return;setDetail(response.data);setName(response.data.result?.treeName??'');}
   else{const response=await get<{data:{items:Tree[];nextCursor:string|null}}>('/admin/organization/trees'+qs({...context,after}));if(view.current!==target||serial!==requestSerial.current)return;setItems(response.data.items);setCursor(response.data.nextCursor);}}
  catch(e){if(view.current===target&&serial===requestSerial.current)setError(e)}finally{if(view.current===target&&serial===requestSerial.current)setBusy(false)}
 }
 useEffect(()=>{setNotice('');setDetail(null);setItems([]);setName('');setReason('');setQualification('');setParent('');const context=nowContext();setTime(context);void load(context);return ()=>{requestSerial.current++}},[id]);
 async function loadNodes(after?:string){
  const target=id,serial=requestSerial.current;setBusy(true);setError(null);setNodes(null);
  try{const response=await get<{data:NodePage}>(`/admin/organization/trees/${id}/nodes`+qs({...time,after}));if(view.current===target&&serial===requestSerial.current)setNodes(response.data);}
  catch(e){if(view.current===target&&serial===requestSerial.current)setError(e)}finally{if(view.current===target&&serial===requestSerial.current)setBusy(false)}
 }
 async function preview(){
  const target=id,serial=requestSerial.current;setBusy(true);setError(null);setPreflight(null);
  try{const response=await get<{data:{preflightToken:string;actualSponsorSequenceNo:number;sponsorQualificationId:string}}>(`/admin/organization/trees/${id}/placement-preview`+qs({qualificationId:qualification,binaryParentQualificationId:parent,side,expectedVersion:detail?.result?.topologyVersion}));if(view.current===target&&serial===requestSerial.current)setPreflight(response.data);}
  catch(e){if(view.current===target&&serial===requestSerial.current)setError(e)}finally{if(view.current===target&&serial===requestSerial.current)setBusy(false)}
 }
 async function write(path:string,body:unknown){
  const serial=requestSerial.current,target=id;
  setBusy(true);setError(null);setNotice('');
  try{const response=await command<{data:{binaryTreeId?:string;actualSponsorSequenceNo?:number}}>(path,body);
   if(view.current!==target||serial!==requestSerial.current)return;
   setNotice(response.data.actualSponsorSequenceNo!==undefined?`Sponsor 已確認，實際序號 ${response.data.actualSponsorSequenceNo}。請另行選擇放置位置。`:'操作已完成。');
   const context=nowContext();setTime(context);
   if(!id&&response.data.binaryTreeId)navigate('/admin/organization/trees/'+response.data.binaryTreeId);else await load(context);
  }catch(e){if(view.current===target&&serial===requestSerial.current)setError(e)}finally{if(view.current===target&&serial===requestSerial.current)setBusy(false)}
 }
 const tree=detail?.result,base='/admin/organization/trees'+(id?'/'+id:'');
 return <><PageHeader title={id?'樹詳情與創始位置':'多樹管理'} subtitle="公司球以公司主體持有；Sponsor 確認與 Binary 放置分開操作。" actions={id?<Link to="/admin/organization/trees">返回樹清單</Link>:undefined}/>
 <Card title="查詢時間"><div className="form"><Field label="資料時間（UTC ISO）"><input value={time.asOf} onChange={e=>setTime({...time,asOf:e.target.value})}/></Field><Field label="記錄截點（UTC ISO）"><input value={time.knowledgeCutoff} onChange={e=>setTime({...time,knowledgeCutoff:e.target.value})}/></Field><Field label="統計期間開始（UTC ISO）"><input value={time.periodStart} onChange={e=>setTime({...time,periodStart:e.target.value})}/></Field><Field label="統計期間結束（不含）"><input value={time.periodEnd} onChange={e=>setTime({...time,periodEnd:e.target.value})}/></Field><p>時區：Asia/Taipei</p><button disabled={busy} onClick={()=>void load()}>依指定時間查詢</button><button disabled={busy} onClick={()=>{const context=nowContext();setTime(context);void load(context)}}>回到現在</button></div></Card>
 <ErrorBox error={error}/>{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">處理中…</p>}
 {!id&&<Card title="樹清單"><div className="table-wrap"><table><thead><tr><th>代碼</th><th>名稱</th><th>狀態</th></tr></thead><tbody>{items.map(item=><tr key={item.binaryTreeId}><td><Link to={'/admin/organization/trees/'+item.binaryTreeId}>{item.treeCode}</Link></td><td>{item.treeName}</td><td><Badge>{item.status}</Badge></td></tr>)}</tbody></table></div>{!items.length&&!busy&&<p>這個時間範圍沒有可顯示的樹。</p>}{cursor&&<button disabled={busy} onClick={()=>void load(time,cursor)}>下一頁</button>}</Card>}
 {id&&detail&&!tree&&<Card title="資料不可用"><p>{detail.explainCode??'指定時間沒有可用紀錄。'}</p></Card>}
 {tree&&<><Card title={tree.treeName}><p>{tree.treeCode} · <Badge>{tree.status}</Badge> · 版本 {tree.topologyVersion}</p><p>公司金額功能尚未啟用；金額統計目前不可用。GPV 與 Carry 為來源點數，不代表可領金額。</p><div className="table-wrap"><table><thead><tr><th>位置／父位置</th><th>球</th><th>持有類型</th><th>實際 Sponsor 序號</th><th>後代球數</th><th>後代會員人數</th><th>期間新球</th><th>左／右後代</th><th>累積 GPV</th><th>期間 GPV</th><th>左 Carry</th><th>右 Carry</th></tr></thead><tbody>{tree.positions.map(p=><tr key={p.positionNo}><td>#{p.positionNo} / {p.parentPositionNo?'#'+p.parentPositionNo:'根'} {p.side}</td><td>{p.qualificationId??'尚未占用'}</td><td>{p.ownerType??'—'}{p.activeLabel&&<div>{p.activeLabel}</div>}</td><td>{p.actualSponsorSequenceNo??'—'}</td><td>{p.descendantBalls??'—'}</td><td>{p.distinctMemberPersons??'—'}</td><td>{p.newBallsInPeriod??'—'}</td><td>{p.leftDescendantBalls??'—'} / {p.rightDescendantBalls??'—'}</td><td title={p.performance?.reason??undefined}>{p.performance?.value?.cumulative??'不可用'}</td><td title={p.performance?.reason??undefined}>{p.performance?.value?.month??'不可用'}</td><td title={p.carry?.reason??undefined}>{p.carry?.value?.left??'不可用'}</td><td title={p.carry?.reason??undefined}>{p.carry?.value?.right??'不可用'}</td></tr>)}</tbody></table></div><p className="muted">後代統計不包含該位置自身。會員人數依指定時間的持有人去重；公司主體不計為會員。新球依首次放置時間計算。</p></Card></>}
 {tree&&<Card title="完整 Binary 樹節點"><button disabled={busy} onClick={()=>void loadNodes()}>載入節點</button>{nodes&&<><p>總節點數：{nodes.total??'不可用'}；本頁顯示 {nodes.items.length} 個。統計仍以整棵樹計算。</p>{nodes.status==='UNAVAILABLE'?<p>此時間的節點證據不可用。</p>:<div className="table-wrap"><table><thead><tr><th>深度</th><th>球 ID</th><th>父球 ID</th><th>左右側</th><th>持有類型</th></tr></thead><tbody>{nodes.items.map(node=><tr key={node.qualificationId}><td>{node.depth}</td><td>{node.qualificationId}</td><td>{node.parentQualificationId??'根節點'}</td><td>{node.side??'—'}</td><td>{node.ownerType}{node.activeLabel&&<div>{node.activeLabel}</div>}</td></tr>)}</tbody></table></div>}{nodes.nextCursor&&<button disabled={busy} onClick={()=>void loadNodes(nodes.nextCursor!)}>下一頁節點</button>}</>}</Card>}
 {manage&&(!id||tree&&tree.status!=='ARCHIVED')&&<Card title={id?'樹設定':'建立樹'}><div className="form"><Field label="樹名稱"><input maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="操作原因"><input maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></Field><button className="primary" disabled={busy||!name.trim()||!reason.trim()} onClick={()=>void write(id?base+'/settings':base,{treeName:name,reason,...(tree?{expectedVersion:tree.topologyVersion}:{})})}>{id?'儲存名稱':'建立草稿樹（3 顆公司球、7 個位置）'}</button>{tree&&({DRAFT:['ACTIVE','ARCHIVED'],ACTIVE:['CLOSED_TO_NEW'],CLOSED_TO_NEW:['ACTIVE','ARCHIVED']}[tree.status]??[]).map(status=><button key={status} disabled={busy||!reason.trim()} onClick={()=>void write(base+'/settings',{status,reason,expectedVersion:tree.topologyVersion})}>切換至 {status}</button>)}</div></Card>}
 {tree?.status==='ACTIVE'&&(confirmSponsor||place)&&<Card title="Sponsor 確認與放置"><div className="form"><Field label="待放置資格 ID"><input value={qualification} onChange={e=>{setQualification(e.target.value);setPreflight(null)}}/></Field>{!manage&&<Field label="操作原因"><input value={reason} onChange={e=>setReason(e.target.value)}/></Field>}{confirmSponsor&&<button disabled={busy||!qualification||!reason.trim()} onClick={()=>void write(base+'/company-sponsor-confirmations',{qualificationId:qualification,reason})}>確認公司 Sponsor</button>}{place&&<><Field label="父球資格 ID"><input value={parent} onChange={e=>{setParent(e.target.value);setPreflight(null)}}/></Field><Field label="位置"><select value={side} onChange={e=>{setSide(e.target.value);setPreflight(null)}}><option value="LEFT">左側</option><option value="RIGHT">右側</option></select></Field><button disabled={busy||!qualification||!parent} onClick={()=>void preview()}>預檢選定位置</button>{preflight&&<p>Sponsor：{preflight.sponsorQualificationId}；實際序號：{preflight.actualSponsorSequenceNo}。預檢不保留位置。</p>}<button disabled={busy||!preflight||!qualification||!parent||!reason.trim()} onClick={()=>void write(base+'/placements',{qualificationId:qualification,binaryParentQualificationId:parent,side,expectedVersion:tree.topologyVersion,preflightToken:preflight?.preflightToken,reason})}>放置於選定位置</button></>}<p>第 1 與第 3 位實際直推須位於 Sponsor 左子樹。#4–#7 的位置編號不代表推薦序號。</p></div></Card>}
 </>;
}
