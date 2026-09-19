import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {EmptyState,LoadingState} from '@ucell/design-system';
import {CanonicalTree} from './CanonicalTree';
import {ApiError,command,get,qs} from '../../lib/api';
import {useAuth} from '../auth/auth';
import {Badge,Card,ErrorBox,Field,PageHeader} from '../../components/ui';

type Tree={binaryTreeId:string;treeCode:string;treeName:string;status:string;topologyVersion:number};
type Position={
 positionNo:number;binaryPositionNo?:string;path?:string;ballNo?:string|null;
 parentPositionNo:number|null;side:string|null;qualificationId:string|null;ownerType:string|null;activeLabel:string|null;
 companyProfile?:{status:string;planCode:string|null;profileVersion:string|null}|null;
 actualSponsorSequenceNo?:number|null;descendantBalls:number|null;distinctMemberPersons:number|null;newBallsInPeriod:number|null;
 leftDescendantBalls?:number|null;rightDescendantBalls?:number|null;leftNewBallsInPeriod?:number|null;rightNewBallsInPeriod?:number|null;
 holderId?:string|null;lastUpdated?:string;dataThrough?:string;evidenceQuality?:string;
 performance?:{status:string;reason?:string|null;value:{cumulative:string;month:string;leftMonth?:string;rightMonth?:string}|null}|null;
 carry?:{status:string;reason?:string|null;pairPvStatus?:string|null;value:{left:string;right:string;pairedPv?:string|null}|null}|null;
};
type NodePage={
 parentQualificationId?:string|null;snapshotToken?:string;snapshotExpiresAt?:string|null;
 time?:{asOf?:string;knowledgeCutoff?:string;timezone?:string};status:string;total:number|null;nextCursor:string|null;
 items:Array<{qualificationId:string;ballNo?:string|null;binaryPositionNo?:string;path?:string;parentQualificationId:string|null;side:string|null;depth:number;ownerType:string;activeLabel:string|null}>;
};
type Detail={
 status:string;
 result:(Tree&{positions:Position[];statistics?:{query:unknown;required:boolean;projectionStatus:string;snapshot:string|null;dataThrough:string|null;projectedAt:string|null}})|null;
 explainCode?:string;
};
type PlacementSide='LEFT'|'RIGHT';
type PlacementPreflight={
 preflightToken:string;treeCode:string;ballNo:string;parentBallNo:string;
 expectedBinaryPositionNo:string;expectedPath:string;expectedBallNo:string;expectedVersion:number;
 actualSponsorSequenceNo:number;side:PlacementSide;qualificationMemberNo:string;
};
type PlacementReceipt={
 treeCode:string;ballNo:string;parentBallNo:string;binaryPositionNo:string;path:string;topologyVersion:number;effectiveAt:string;
};
type PlacementPreviewResponse={
 preflightToken:string;treeCode:string;ballNo:string;parentBallNo:string;
 expectedBinaryPositionNo:string;expectedPath:string;expectedBallNo:string;expectedVersion:number;
 actualSponsorSequenceNo:number;
};
type TreeCommandResponse={
 binaryTreeId?:string;actualSponsorSequenceNo?:number;treeCode?:string;ballNo?:string;parentBallNo?:string;
 binaryPositionNo?:string;path?:string;topologyVersion?:number;effectiveAt?:string;
};

function nowContext(){
 const now=new Date(),taipei=new Date(now.getTime()+8*3600000);
 return {
  timezone:'Asia/Taipei',asOf:now.toISOString(),knowledgeCutoff:now.toISOString(),
  periodStart:new Date(Date.UTC(taipei.getUTCFullYear(),taipei.getUTCMonth(),1)-8*3600000).toISOString(),
  periodEnd:new Date(Date.UTC(taipei.getUTCFullYear(),taipei.getUTCMonth()+1,1)-8*3600000).toISOString()
 };
}

function sideLabel(side:string){return side==='LEFT'?'左側':side==='RIGHT'?'右側':'—'}

type StatisticState='AVAILABLE'|'PENDING'|'UNAVAILABLE'|'STALE'|'FAILED';
const statisticStateCopy:Record<StatisticState,{label:string;tone:'ok'|'warn'|'danger'|'neutral';guidance:string}>={
 AVAILABLE:{label:'AVAILABLE · 可用',tone:'ok',guidance:'此數值由伺服器權威讀模型提供。'},
 PENDING:{label:'PENDING · 等待建立',tone:'warn',guidance:'背景統計仍在建立，完成前不顯示數值。'},
 UNAVAILABLE:{label:'UNAVAILABLE · 暫不可用',tone:'neutral',guidance:'伺服器尚未提供可驗證的權威數值，系統不以零值替代。'},
 STALE:{label:'STALE · 待更新',tone:'warn',guidance:'此統計尚未反映目前資料截點，暫不宣稱為最新正式數字。'},
 FAILED:{label:'FAILED · 建立失敗',tone:'danger',guidance:'背景統計未能完成；請由具權限的管理員重新建立或查核。'}
};

function statisticState(status:unknown):StatisticState{
 switch(String(status??'').trim().toUpperCase()){
  case 'AVAILABLE':case 'CURRENT':case 'COMPLETED':return 'AVAILABLE';
  case 'PENDING':case 'REQUESTED':case 'RUNNING':case 'UPDATING':case 'REBUILDING':return 'PENDING';
  case 'STALE':return 'STALE';
  case 'FAILED':return 'FAILED';
  default:return 'UNAVAILABLE';
 }
}

function projectionGuidance(status:unknown){
 const state=statisticState(status);
 if(state==='PENDING')return '背景統計正在建立；完成後重新載入此資料截點。';
 if(state==='STALE')return '背景統計尚未反映此資料截點；暫不宣稱為最新正式數字。';
 if(state==='FAILED')return '背景統計建立未完成；請由具權限的管理員重新建立或查核。';
 return null;
}

function StatisticCell({label,status,value,dataThrough,projectionStatus}:{label:string;status:unknown;value:string|number|null|undefined;dataThrough?:string;projectionStatus?:string}){
 const declaredState=statisticState(status),hasValue=value!==null&&value!==undefined;
 const state=declaredState==='AVAILABLE'&&!hasValue?'UNAVAILABLE':declaredState;
 const copy=statisticStateCopy[state];
 const guidance=state==='UNAVAILABLE'&&declaredState==='AVAILABLE'
  ?`伺服器未提供${label}的權威數值，系統不以零值替代。`:copy.guidance;
 const projectionNote=state==='UNAVAILABLE'?projectionGuidance(projectionStatus):null;
 const dataThroughLabel=dataThrough??'伺服器未提供';
 return <div role="group" aria-label={`${label}：${copy.label}；${hasValue&&state==='AVAILABLE'?`數值 ${value}`:'尚未提供數值'}；資料截至 ${dataThroughLabel}`}>
  <div><Badge tone={copy.tone}><span>{copy.label}</span></Badge>{hasValue&&state==='AVAILABLE'?<strong> {value}</strong>:<span> 尚未提供數值</span>}</div>
  <small>{guidance}</small>
  {projectionNote&&projectionNote!==guidance&&<small>{projectionNote}</small>}
 </div>;
}

function DataThroughCell({value}:{value?:string}){
 return value?<time dateTime={value} aria-label={`資料截至 ${value}`}>{value}</time>:<span aria-label="資料截至尚未由伺服器提供">伺服器未提供</span>;
}

function canonicalPositionLabel(position:Position|undefined){
 if(!position)return '位置資料未提供';
 return [
  '#'+position.positionNo,
  position.binaryPositionNo?'Binary 位置 '+position.binaryPositionNo:null,
  position.path?'路徑 '+position.path:null,
  position.parentPositionNo?'父位置 #'+position.parentPositionNo+' · '+sideLabel(position.side??''):'根位置'
 ].filter((value):value is string=>Boolean(value)).join(' · ');
}

function toPlacementReceipt(data:TreeCommandResponse):PlacementReceipt|null{
 const {treeCode,ballNo,parentBallNo,binaryPositionNo,path,topologyVersion,effectiveAt}=data;
 if(typeof treeCode!=='string'||typeof ballNo!=='string'||typeof parentBallNo!=='string'||typeof binaryPositionNo!=='string'||typeof path!=='string'||typeof topologyVersion!=='number'||typeof effectiveAt!=='string')return null;
 return {treeCode,ballNo,parentBallNo,binaryPositionNo,path,topologyVersion,effectiveAt};
}

function isConflict(error:unknown){return error instanceof ApiError&&error.status===409;}

function TreeError({error,onRefresh,busy}:{error:unknown;onRefresh:()=>void;busy:boolean}){
 if(!error)return null;
 const status=error instanceof ApiError?error.status:undefined;
 const message=status===401?'管理員工作階段已失效。請重新登入後再讀取目前的樹資料。'
  :status===403?'目前角色沒有這項資料或操作的權限。系統沒有顯示受限制的內容。'
  :status===409?'樹版本或位置已變動。預檢與節點快照已清除；系統沒有改選父球、側別或送出替代放置。請重新載入、重新檢視選定位置，再執行預檢。'
  :status===422?'輸入資料或目前樹狀態不符合規則。請依欄位說明修正後重新預檢。'
  :undefined;
 return <section className="tree-error" aria-live="assertive">
  <ErrorBox error={error}/>
  {message&&<p>{message}</p>}
  {status!==401&&<button type="button" disabled={busy} onClick={onRefresh}>重新載入最新資料與版本</button>}
 </section>;
}

export function BinaryTreesPage(){
 const {id}=useParams(),navigate=useNavigate(),{user}=useAuth();
 const view=useRef(id),requestSerial=useRef(0);view.current=id;
 const appliedTime=useRef(nowContext());
 const [time,setTime]=useState(nowContext),[items,setItems]=useState<Tree[]>([]),[cursor,setCursor]=useState<string|null>(null),[detail,setDetail]=useState<Detail|null>(null);
 const [preflight,setPreflight]=useState<PlacementPreflight|null>(null);
 const [placementReceipt,setPlacementReceipt]=useState<PlacementReceipt|null>(null);
 const [nodes,setNodes]=useState<NodePage|null>(null);
 const [statisticsJob,setStatisticsJob]=useState<string|null>(null);
 const [name,setName]=useState(''),[reason,setReason]=useState(''),[qualification,setQualification]=useState(''),[parent,setParent]=useState(''),[side,setSide]=useState<PlacementSide>('LEFT');
 const [error,setError]=useState<unknown>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false);
 const manage=user?.role==='SUPER_ADMIN';
 const confirmSponsor=['SUPER_ADMIN','MEMBERSHIP_OPS'].includes(user?.role??'');
 const place=['SUPER_ADMIN','QUALIFICATION_PLACEMENT_OVERRIDE'].includes(user?.role??'');
 const memberNoValid=/^\d{10}$/.test(qualification);
 const roleLabel=user?.role??'UNKNOWN';

 function invalidateStaleTreeAction(){
  setPreflight(null);setNodes(null);
  setNotice('樹版本或位置已變動。已清除預檢與節點快照；系統未改選父球、側別或自動放置。請重新載入、重新檢視目前選定位置後，再執行預檢。');
 }

 async function load(context=time,after?:string){
  const serial=++requestSerial.current,target=id;
  setBusy(true);setError(null);setPreflight(null);
  if(id){setDetail(null);setNodes(null);}else setItems([]);
  try{
   if(id){
    const response=await get<{data:Detail}>(`/admin/organization/trees/${id}`+qs(context));
    if(view.current!==target||serial!==requestSerial.current)return;
    appliedTime.current=context;
    setDetail(response.data);setName(response.data.result?.treeName??'');
   }else{
    const response=await get<{data:{items:Tree[];nextCursor:string|null}}>('/admin/organization/trees'+qs({...context,after}));
    if(view.current!==target||serial!==requestSerial.current)return;
    appliedTime.current=context;setItems(response.data.items);setCursor(response.data.nextCursor);
   }
   setLoaded(true);
  }catch(e){
   if(view.current===target&&serial===requestSerial.current){
    if(isConflict(e))invalidateStaleTreeAction();
    setError(e);
   }
  }finally{
   if(view.current===target&&serial===requestSerial.current)setBusy(false);
  }
 }

 useEffect(()=>{
  setStatisticsJob(null);setNotice('');setDetail(null);setItems([]);setName('');setReason('');setQualification('');setParent('');setPreflight(null);setPlacementReceipt(null);setLoaded(false);
  const context=nowContext();setTime(context);void load(context);
  return ()=>{requestSerial.current++};
 },[id]);

 function refreshCurrent(){
  const context=nowContext();setTime(context);void load(context);
 }

 async function loadNodes(after?:string,expandParent?:string){
  const target=id,serial=requestSerial.current;
  const snapshotToken=after||expandParent?nodes?.snapshotToken:undefined;
  setBusy(true);setError(null);
  try{
   const response=await get<{data:NodePage}>(`/admin/organization/trees/${id}/nodes`+qs({
    ...appliedTime.current,after,snapshotToken,parentQualificationId:expandParent??(after?nodes?.parentQualificationId:undefined)
   }));
   if(view.current===target&&serial===requestSerial.current)setNodes(response.data);
  }catch(e){
   if(view.current===target&&serial===requestSerial.current){
    if(isConflict(e))invalidateStaleTreeAction();
    setError(e);
   }
  }finally{
   if(view.current===target&&serial===requestSerial.current)setBusy(false);
  }
 }

 async function preview(){
  const target=id,serial=requestSerial.current;
  setBusy(true);setError(null);setPreflight(null);setPlacementReceipt(null);setNotice('');
  try{
   const response=await get<{data:PlacementPreviewResponse}>(
    `/admin/organization/trees/${id}/placement-preview`+qs({qualificationMemberNo:qualification,binaryParentBallNo:parent,side,expectedVersion:detail?.result?.topologyVersion})
   );
   if(view.current===target&&serial===requestSerial.current){
    const value=response.data;
    setPreflight({
     preflightToken:value.preflightToken,treeCode:value.treeCode,ballNo:value.ballNo,parentBallNo:value.parentBallNo,
     expectedBinaryPositionNo:value.expectedBinaryPositionNo,expectedPath:value.expectedPath,expectedBallNo:value.expectedBallNo,
     expectedVersion:value.expectedVersion,actualSponsorSequenceNo:value.actualSponsorSequenceNo,
     side:side as PlacementSide,qualificationMemberNo:qualification
    });
   }
  }catch(e){
   if(view.current===target&&serial===requestSerial.current){
    if(isConflict(e))invalidateStaleTreeAction();
    setError(e);
   }
  }finally{
   if(view.current===target&&serial===requestSerial.current)setBusy(false);
  }
 }

 async function write(path:string,body:unknown){
  const serial=requestSerial.current,target=id;
  setBusy(true);setError(null);setNotice('');
  try{
   const response=await command<{data:TreeCommandResponse}>(path,body);
   if(view.current!==target||serial!==requestSerial.current)return;
   const placement=path.endsWith('/placements');
   if(placement){
    setPreflight(null);setNodes(null);
    const receipt=toPlacementReceipt(response.data);
    if(receipt)setPlacementReceipt(receipt);
   }
   setNotice(response.data.actualSponsorSequenceNo!==undefined
    ?`公司 Sponsor 已確認，實際序號為 ${response.data.actualSponsorSequenceNo}。Binary 放置仍須另行預檢。`
    :placement?'Binary 放置已完成。下方收據只顯示伺服器回傳的公開營運識別資料；現在重新讀取權威樹資料。':'操作已完成，已重新讀取權威樹資料。');
   const context=nowContext();setTime(context);
   if(!id&&response.data.binaryTreeId)navigate('/admin/organization/trees/'+response.data.binaryTreeId);
   else await load(context);
  }catch(e){
   if(view.current===target&&serial===requestSerial.current){
    if(isConflict(e))invalidateStaleTreeAction();
    setError(e);
   }
  }finally{
   if(view.current===target&&serial===requestSerial.current)setBusy(false);
  }
 }

 async function rebuildStatistics(check=false){
  if(!id||!detail?.result?.statistics)return;
  const target=id,serial=requestSerial.current;setBusy(true);setError(null);
  try{
   if(check&&statisticsJob){
    const response=await get<{data:{status:string}}>('/admin/analytics/period-projections/jobs/'+statisticsJob);
    if(view.current!==target||serial!==requestSerial.current)return;
    const state=statisticState(response.data.status);
    setNotice(state==='AVAILABLE'?'背景統計已完成；正在重新讀取此資料截點。':`背景統計狀態：${statisticStateCopy[state].label}。${statisticStateCopy[state].guidance}`);
    if(response.data.status==='COMPLETED')await load(appliedTime.current);
   }else{
    const response=await command<{data:{jobId:string;status:string}}>('/admin/analytics/period-projections/jobs',{query:detail.result.statistics.query,mode:'REBUILD'});
    if(view.current!==target||serial!==requestSerial.current)return;
    setStatisticsJob(response.data.jobId);setNotice('背景統計已排入佇列。完成後請檢查結果，未完成前不宣稱為最新正式數字。');
   }
  }catch(e){
   if(view.current===target&&serial===requestSerial.current)setError(e);
  }finally{
   if(view.current===target&&serial===requestSerial.current)setBusy(false);
  }
 }

 const tree=detail?.result,base='/admin/organization/trees'+(id?'/'+id:'');
 const leaderProfileAvailable=(tree?.positions.filter(position=>position.positionNo<=3)??[]).length===3&&tree!.positions.filter(position=>position.positionNo<=3).every(position=>position.companyProfile?.status==='AVAILABLE'&&position.companyProfile.planCode==='LEADER');
 const preflightParentPosition=preflight?tree?.positions.find(position=>position.ballNo===preflight.parentBallNo):undefined;
 const transitions=(tree?({DRAFT:['ACTIVE','ARCHIVED'],ACTIVE:['CLOSED_TO_NEW'],CLOSED_TO_NEW:['ACTIVE','ARCHIVED']}[tree.status]??[]):[]) as string[];
 return <>
  <PageHeader title={id?'樹詳情與創始位置':'多樹管理'} subtitle="公司球以公司主體持有；Sponsor 確認與 Binary 放置是兩個分開、可稽核的操作。" actions={id?<Link to="/admin/organization/trees">返回樹清單</Link>:undefined}/>

  <Card title="查詢時間">
   <form className="form" aria-describedby="tree-time-context-hint" onSubmit={e=>{e.preventDefault();void load()}}>
    <Field label="資料時間（UTC ISO）"><input value={time.asOf} onChange={e=>setTime({...time,asOf:e.target.value})}/></Field>
    <Field label="記錄截點（UTC ISO）"><input value={time.knowledgeCutoff} onChange={e=>setTime({...time,knowledgeCutoff:e.target.value})}/></Field>
    <Field label="統計期間開始（UTC ISO）"><input value={time.periodStart} onChange={e=>setTime({...time,periodStart:e.target.value})}/></Field>
    <Field label="統計期間結束（不含）"><input value={time.periodEnd} onChange={e=>setTime({...time,periodEnd:e.target.value})}/></Field>
    <p id="tree-time-context-hint" className="muted">時區為 Asia/Taipei。歷史時間只會顯示這個時間與記錄截點可證實的資料。</p>
    <div className="button-row"><button type="submit" disabled={busy}>依指定時間查詢</button><button type="button" disabled={busy} onClick={refreshCurrent}>回到現在</button></div>
   </form>
  </Card>

  <TreeError error={error} onRefresh={refreshCurrent} busy={busy}/>
  {notice&&<p className="tree-notice" role="status" aria-live="polite">{notice}</p>}
  {busy&&<p className="tree-loading" role="status" aria-live="polite">處理中，請勿重複送出相同操作…</p>}
  {!manage&&<aside className="callout info" aria-label="目前樹操作權限"><strong>目前為受限操作模式</strong><p>角色 {roleLabel} 只會看到已授與的 Sponsor、放置或唯讀功能。未出現的按鈕並不代表可繞過伺服器 RBAC。</p></aside>}

  {!id&&<Card title="樹清單">
   {busy&&!loaded?<LoadingState label="正在載入 Binary Tree 清單…"/>:<>{items.length?<div className="table-wrap"><table><caption className="uc-sr-only">Binary Tree 清單；點選代碼開啟樹詳情</caption><thead><tr><th scope="col">代碼</th><th scope="col">名稱</th><th scope="col">生命週期狀態</th></tr></thead><tbody>{items.map(item=><tr key={item.binaryTreeId}><td><Link to={'/admin/organization/trees/'+item.binaryTreeId}>{item.treeCode}</Link></td><td>{item.treeName}</td><td><Badge>{item.status}</Badge></td></tr>)}</tbody></table></div>:loaded&&!error&&<EmptyState title="這個時間範圍沒有可顯示的樹"><p>變更查詢時間，或由具樹設定權限的管理員建立草稿樹。</p></EmptyState>}</>}
   {cursor&&<button type="button" disabled={busy} onClick={()=>void load(time,cursor)}>載入下一頁</button>}
  </Card>}

  {id&&busy&&!detail&&!loaded&&<LoadingState label="正在載入樹資料與權威位置…"/>}
  {id&&detail&&!tree&&<Card title="資料不可用"><p>指定時間的樹資料尚未提供。</p><p className="muted">系統不會以目前資料替代缺少的歷史證據。</p></Card>}

  {tree?.statistics&&tree.statistics.projectionStatus!=='NOT_REQUIRED'&&<Card title="背景統計">
   {(()=>{const state=statisticState(tree.statistics!.projectionStatus),copy=statisticStateCopy[state];return <p><Badge tone={copy.tone}><span>{copy.label}</span></Badge> · 資料截點 {tree.statistics!.dataThrough??appliedTime.current.knowledgeCutoff}</p>;})()}
   {statisticState(tree.statistics.projectionStatus)!=='AVAILABLE'&&<p>{statisticStateCopy[statisticState(tree.statistics.projectionStatus)].guidance} 樹的位置與操作仍可使用。</p>}
   {['SUPER_ADMIN','COMPLIANCE_AUDIT'].includes(user?.role??'')?<div className="button-row"><button type="button" disabled={busy} onClick={()=>void rebuildStatistics()}>建立此截點的統計</button>{statisticsJob&&<button type="button" disabled={busy} onClick={()=>void rebuildStatistics(true)}>檢查統計工作</button>}</div>:<p>請具統計重建權限的管理員建立此截點的統計。</p>}
   {tree.statistics.snapshot&&<p className="muted">統計快照已固定 · 產生時間 {tree.statistics.projectedAt??'伺服器未提供'}</p>}
  </Card>}

  {tree&&<><Card title={tree.treeName}>
   <div className="tree-summary"><p>{tree.treeCode} · <Badge>{tree.status}</Badge> · Tree version {tree.topologyVersion}</p><p>{leaderProfileAvailable?'公司球 LEADER Profile 已由伺服器核准。':'公司球 LEADER Profile 證據尚未提供；系統不會依創始位置自行推定方案。'} GPV 與 Carry 為來源點數，不代表可領金額；財務內容只由具權限的 Reservoir Center 顯示。</p></div>
   <CanonicalTree positions={tree.positions} selectedBallNo={parent} onSelect={p=>{
    if(!p.ballNo){setNotice('#'+p.positionNo+' 尚未占用，不能作為父球。請選擇已有 Ball Number 的節點。');return;}
    setParent(p.ballNo);setPreflight(null);setPlacementReceipt(null);setNotice('父球已選為 #'+p.positionNo+'：'+p.ballNo+'。請選擇左右側並進行預檢。');
   }}/>
   <div className="table-wrap"><table><caption className="uc-sr-only">創始位置與伺服器權威統計。每個 GPV 與 Carry 欄位都會顯示伺服器回傳的可用狀態；未提供的數值不以零值替代。後代統計不包含位置自身。</caption><thead><tr><th scope="col">位置／路徑</th><th scope="col">Ball Number</th><th scope="col">持有類型</th><th scope="col">Sponsor 序號</th><th scope="col">後代球數</th><th scope="col">後代會員</th><th scope="col">期間新球</th><th scope="col">左／右後代</th><th scope="col">累積 GPV</th><th scope="col">期間 GPV</th><th scope="col">左 Carry</th><th scope="col">右 Carry</th><th scope="col">持有人狀態</th><th scope="col">Active</th><th scope="col">左／右期間新球</th><th scope="col">左／右期間 GPV</th><th scope="col">Pair PV</th><th scope="col">Last Updated</th><th scope="col">Data Through</th><th scope="col">Evidence Quality</th></tr></thead><tbody>{tree.positions.map(p=><tr key={p.positionNo}><td>#{p.positionNo}{p.binaryPositionNo&&<><br/><small>{p.binaryPositionNo}{p.path?' · '+p.path:''}</small></>}<br/><small>{p.parentPositionNo?'父位置 #'+p.parentPositionNo+' · '+sideLabel(p.side??''):'根位置'}</small></td><td>{p.ballNo??'尚未占用'}</td><td>{p.ownerType??'—'}{p.activeLabel&&<div>{p.activeLabel}</div>}</td><td>{p.actualSponsorSequenceNo??'—'}</td><td>{p.descendantBalls??'—'}</td><td>{p.distinctMemberPersons??'—'}</td><td>{p.newBallsInPeriod??'—'}</td><td>{p.leftDescendantBalls??'—'} / {p.rightDescendantBalls??'—'}</td><td><StatisticCell label="累積 GPV" status={p.performance?.status} value={p.performance?.value?.cumulative} dataThrough={p.dataThrough} projectionStatus={tree.statistics?.projectionStatus}/></td><td><StatisticCell label="期間 GPV" status={p.performance?.status} value={p.performance?.value?.month} dataThrough={p.dataThrough} projectionStatus={tree.statistics?.projectionStatus}/></td><td><StatisticCell label="左 Carry" status={p.carry?.status} value={p.carry?.value?.left} dataThrough={p.dataThrough} projectionStatus={tree.statistics?.projectionStatus}/></td><td><StatisticCell label="右 Carry" status={p.carry?.status} value={p.carry?.value?.right} dataThrough={p.dataThrough} projectionStatus={tree.statistics?.projectionStatus}/></td><td>{p.holderId?'已綁定（詳情未提供）':'—'}</td><td>{p.activeLabel??'證據不可用'}</td><td>{p.leftNewBallsInPeriod??'—'} / {p.rightNewBallsInPeriod??'—'}</td><td><StatisticCell label="左／右期間 GPV" status={p.performance?.status} value={p.performance?.value?.leftMonth!=null&&p.performance?.value?.rightMonth!=null?`${p.performance.value.leftMonth} / ${p.performance.value.rightMonth}`:null} dataThrough={p.dataThrough} projectionStatus={tree.statistics?.projectionStatus}/></td><td><StatisticCell label="Pair PV" status={p.carry?.pairPvStatus??p.carry?.status} value={p.carry?.value?.pairedPv} dataThrough={p.dataThrough} projectionStatus={tree.statistics?.projectionStatus}/></td><td>{p.lastUpdated??'—'}</td><td><DataThroughCell value={p.dataThrough}/></td><td>{p.evidenceQuality??'PARTIAL'}</td></tr>)}</tbody></table></div>
   <p className="muted">會員人數依指定時間的持有人去重；公司主體不計為會員。新球依首次有效放置時間計算，持有人移轉與公司承接不會形成新球。</p>
  </Card>

  <Card title="完整 Binary 樹節點">
   <p>目前資料截點：{appliedTime.current.asOf}；期間 {appliedTime.current.periodStart} 至 {appliedTime.current.periodEnd}。</p>
   <div className="button-row"><button type="button" disabled={busy} onClick={()=>void loadNodes()}>載入節點</button>{nodes&&<button type="button" disabled={busy} onClick={()=>void loadNodes()}>從根節點重新載入</button>}</div>
   {nodes&&<section aria-live="polite">{nodes.parentQualificationId?<p>目前節點的直接子節點數：{nodes.total??'不可用'}；本頁顯示 {nodes.items.length} 個。</p>:<p>總節點數：{nodes.total??'不可用'}；本頁顯示 {nodes.items.length} 個。統計仍以整棵樹計算。</p>}{nodes.snapshotToken&&<p className="muted">此頁固定於資料時間 {nodes.time?.asOf??appliedTime.current.asOf}；記錄截點 {nodes.time?.knowledgeCutoff??appliedTime.current.knowledgeCutoff}。快照有效至 {nodes.snapshotExpiresAt??'伺服器未提供'}。</p>}{nodes.status==='UNAVAILABLE'?<EmptyState title="此時間的節點證據不可用"/>:nodes.items.length?<div className="table-wrap"><table><caption className="uc-sr-only">Bounded Binary Tree 節點。每次展開與換頁都固定使用同一 server snapshot。</caption><thead><tr><th scope="col">深度</th><th scope="col">Ball Number</th><th scope="col">位置／路徑</th><th scope="col">左右側</th><th scope="col">持有類型</th><th scope="col">下一步</th></tr></thead><tbody>{nodes.items.map(node=><tr key={node.qualificationId}><td>{node.depth}</td><td>{node.ballNo??'證據未提供'}</td><td>{node.binaryPositionNo??'—'} {node.path??''}</td><td>{sideLabel(node.side??'')}</td><td>{node.ownerType}{node.activeLabel&&<div>{node.activeLabel}</div>}</td><td><button type="button" disabled={busy} aria-label={'展開 Ball Number '+(node.ballNo??'未提供')+' 的子節點；Binary 位置 '+(node.binaryPositionNo??'未提供')+'；路徑 '+(node.path??'未提供')+'；'+sideLabel(node.side??'')} onClick={()=>void loadNodes(undefined,node.qualificationId)}>展開子節點</button></td></tr>)}</tbody></table></div>:<EmptyState title="這個範圍沒有節點"/>}{nodes.nextCursor&&<button type="button" disabled={busy} onClick={()=>void loadNodes(nodes.nextCursor!)}>下一頁節點</button>}</section>}
  </Card></>}

  {manage&&(!id||tree&&tree.status!=='ARCHIVED')&&<Card title={id?'樹設定':'建立樹'}><form className="form" onSubmit={e=>{e.preventDefault();void write(id?base+'/settings':base,{treeName:name,reason,...(tree?{expectedVersion:tree.topologyVersion}:{})})}}>
   <Field label="樹名稱"><input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></Field>
   <Field label="操作原因" hint="原因會與命令一併由伺服器稽核。"><input required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></Field>
   <div className="button-row"><button className="primary" type="submit" disabled={busy||!name.trim()||!reason.trim()}>{id?'儲存名稱':'建立草稿樹（3 顆公司球、7 個位置）'}</button>{transitions.map(status=><button type="button" key={status} disabled={busy||!reason.trim()} onClick={()=>void write(base+'/settings',{status,reason,expectedVersion:tree!.topologyVersion})}>切換至 {status}</button>)}</div>
   {tree&&<p className="muted">生命週期變更會重新驗證 Tree version；封存不會刪除既有位置或歷史證據。</p>}
  </form></Card>}

  {tree?.status==='ACTIVE'&&(confirmSponsor||place)&&<Card title="Sponsor 確認與 Binary 放置"><section className="placement-flow" aria-describedby="placement-flow-hint">
   <p id="placement-flow-hint">先輸入待放置會員編號，再確認 Sponsor 或對指定父球做預檢。預檢只是當下觀察，不會保留位置。</p>
   <Field label="待放置會員編號" hint="限十位 Member Number；系統只會接受唯一、尚未放置的資格。"><input required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} aria-invalid={qualification.length>0&&!memberNoValid} placeholder="例如 2609000001" value={qualification} onChange={e=>{setQualification(e.target.value.replace(/\D/g,''));setPreflight(null);setPlacementReceipt(null)}}/></Field>
   <Field label="操作原因" hint="所有 Sponsor 確認與 Binary 放置都需要原因。"><input required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></Field>
   {confirmSponsor&&<section className="placement-step"><h3>1. Sponsor 確認</h3><p className="muted">Sponsor 是推薦關係，與下方 Binary 父球不同。</p><button type="button" disabled={busy||!memberNoValid||!reason.trim()} onClick={()=>void write(base+'/company-sponsor-confirmations',{qualificationMemberNo:qualification,reason})}>確認公司 Sponsor</button></section>}
   {place&&<section className="placement-step"><h3>{confirmSponsor?'2':'1'}. Binary 放置</h3><Field label="父球 Ball Number" hint="可從上方創始位置圖點選已有 Ball Number 的節點。"><input required value={parent} placeholder="例如 TREE-A000001" onChange={e=>{setParent(e.target.value.trim());setPreflight(null);setPlacementReceipt(null)}}/></Field><Field label="位置"><select value={side} onChange={e=>{setSide(e.target.value as PlacementSide);setPreflight(null);setPlacementReceipt(null)}}><option value="LEFT">左側</option><option value="RIGHT">右側</option></select></Field><div className="button-row"><button type="button" disabled={busy||!memberNoValid||!parent} onClick={()=>void preview()}>預檢選定位置</button><button type="button" className="primary" disabled={busy||!preflight||!memberNoValid||!parent||!reason.trim()} onClick={()=>void write(base+'/placements',{qualificationMemberNo:qualification,binaryParentBallNo:parent,side:preflight?.side,expectedVersion:preflight?.expectedVersion,preflightToken:preflight?.preflightToken,reason})}>確認放置於選定位置</button></div>{preflight&&<section className="placement-review" role="status" aria-live="polite"><h4>預檢可提交</h4><dl><dt>Tree Code</dt><dd>{preflight.treeCode}</dd><dt>待放置會員編號</dt><dd>{preflight.qualificationMemberNo}</dd><dt>待放置資格目前 Ball Number</dt><dd>{preflight.ballNo}</dd><dt>父球 Ball Number</dt><dd>{preflight.parentBallNo}</dd><dt>父球位置</dt><dd>{canonicalPositionLabel(preflightParentPosition)}</dd><dt>放置方向</dt><dd>{sideLabel(preflight.side)}</dd><dt>預測 Binary 位置</dt><dd>{preflight.expectedBinaryPositionNo}</dd><dt>預測路徑</dt><dd>{preflight.expectedPath}</dd><dt>預測放置後 Ball Number</dt><dd>{preflight.expectedBallNo}</dd><dt>實際 Sponsor 序號</dt><dd>{preflight.actualSponsorSequenceNo}</dd><dt>Topology version</dt><dd>{preflight.expectedVersion}</dd></dl><p><strong>這不是位置保留。</strong> 提交時伺服器仍會重新檢查位置、版本與 Sponsor 證據；若出現 409，系統不會改放其他位置，請重新載入後重新檢視與預檢。</p></section>}{placementReceipt&&<section className="placement-review" role="status" aria-live="polite"><h4>放置完成收據</h4><dl><dt>Tree Code</dt><dd>{placementReceipt.treeCode}</dd><dt>父球 Ball Number</dt><dd>{placementReceipt.parentBallNo}</dd><dt>放置後 Ball Number</dt><dd>{placementReceipt.ballNo}</dd><dt>Binary 位置</dt><dd>{placementReceipt.binaryPositionNo}</dd><dt>路徑</dt><dd>{placementReceipt.path}</dd><dt>Topology version</dt><dd>{placementReceipt.topologyVersion}</dd><dt>生效時間</dt><dd>{placementReceipt.effectiveAt}</dd></dl><p>此收據不包含內部識別碼。樹畫面已重新讀取；若需要新操作，請重新選擇並預檢。</p></section>}</section>}
   <aside className="callout warning"><strong>放置規則</strong><p>第 1 與第 3 位實際直推須位於 Sponsor 左子樹。#4–#7 的位置編號不代表推薦序號。</p></aside>
  </section></Card>}
 </>;
}
