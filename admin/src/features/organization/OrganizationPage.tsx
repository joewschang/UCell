import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {get,qs} from '../../lib/api';
import {Qualification} from '../../types/domain';
import {Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {SearchOption,SearchSelect} from '../../components/SearchSelect';
import {TreeNode,TreeView} from '../../components/TreeView';
import {useAuth} from '../auth/auth';
import {canOpen} from '../auth/permissions';
import './organization-review.css';

export function OrganizationPage(){
 const {user}=useAuth(),serial=useRef(0),request=useRef<AbortController|null>(null);
 const [root,setRoot]=useState<SearchOption|null>(null),[path,setPath]=useState<SearchOption[]>([]),[mode,setMode]=useState<'SPONSOR'|'BINARY'>('SPONSOR');
 const [depth,setDepth]=useState(2),[nodes,setNodes]=useState<TreeNode[]>([]),[loaded,setLoaded]=useState(false),[truncated,setTruncated]=useState(false);
 const [error,setError]=useState<unknown>(null),[loading,setLoading]=useState(false);
 useEffect(()=>()=>{serial.current++;request.current?.abort()},[]);
 function clear(){serial.current++;request.current?.abort();setNodes([]);setLoaded(false);setLoading(false);setTruncated(false);setError(null)}
 async function qualSearch(q:string){
  const r=await get<{data:Qualification[]}>('/admin/qualifications'+qs({q:q.trim().toUpperCase(),take:20}));
  return r.data.filter(x=>x.ballNo?.toUpperCase().includes(q.trim().toUpperCase())).map(x=>({id:x.qualificationId,primary:x.ballNo!,secondary:x.kind==='COMPANY_BOOTSTRAP'?'公司球':x.currentHolder?.memberNo??'會員資格'}));
 }
 async function load(selected=root){
  if(!selected)return;request.current?.abort();const controller=new AbortController();request.current=controller;const ticket=++serial.current;
  setLoading(true);setError(null);setLoaded(false);setNodes([]);
  try{const route=mode==='SPONSOR'?'sponsor-tree':'binary-tree';const r=await get<{data:TreeNode[]}>('/admin/observability/organization/'+route+'/'+selected.id+qs({depth}),{signal:controller.signal});
   if(ticket!==serial.current)return;setTruncated(r.data.length>1000);setNodes(r.data.slice(0,1000));setLoaded(true);
  }catch(e){if(ticket===serial.current&&!controller.signal.aborted)setError(e)}finally{if(ticket===serial.current)setLoading(false)}
 }
 function explore(node:TreeNode){const next={id:node.qualification_id,primary:node.ball_no!,secondary:node.qualification_kind==='COMPANY_BOOTSTRAP'?'公司球':node.legal_name};setRoot(next);setPath(old=>old.some(n=>n.id===next.id)?old.slice(0,old.findIndex(n=>n.id===next.id)+1):[...old,next]);void load(next)}
 return <div className="org-review"><PageHeader title="組織／安置" subtitle="查看目前推薦關係與左右安置組織；選擇球號後，可逐層往下展開。" actions={canOpen(user?.role,'/admin/organization/trees')?<Link className="button" to="/admin/organization/trees">前往多樹管理安置</Link>:undefined}/>
  <div className="org-help"><strong>推薦關係與安置位置分開查看</strong><p>推薦組織顯示誰推薦誰；二元組織顯示左右位置。新增安置請至多樹管理，從該樹待安置球選擇。</p></div>
  <Card title="選擇查看範圍"><div className="org-filters">
   <SearchSelect label="根球球號" placeholder="輸入完整球號或球號前綴" value={root} onChange={x=>{clear();setRoot(x);setPath(x?[x]:[])}} search={qualSearch}/>
   <Field label="組織類型"><select value={mode} onChange={e=>{clear();setMode(e.target.value as 'SPONSOR'|'BINARY')}}><option value="SPONSOR">推薦組織</option><option value="BINARY">二元安置組織</option></select></Field>
   <Field label="往下查看層數"><select value={depth} onChange={e=>{clear();setDepth(Number(e.target.value))}}><option value={1}>1 層</option><option value={2}>2 層</option><option value={3}>3 層</option></select></Field>
   <button className="primary" disabled={!root||loading} onClick={()=>void load()}>{loading?'讀取中…':'載入組織'}</button>
  </div><ErrorBox error={error}/></Card>
  <Card title={mode==='SPONSOR'?'推薦組織':'二元安置組織'}>
   <nav className="org-path" aria-label="展開路徑">{path.map((node,i)=><span key={node.id}>{i>0&&' › '}<button disabled={loading} onClick={()=>{setRoot(node);setPath(path.slice(0,i+1));void load(node)}}>{node.primary}</button></span>)}</nav>
   {loading?<p role="status">正在載入目前組織…</p>:!loaded?<p className="muted">請選擇根球球號，再按「載入組織」。</p>:<><p role="status">本次顯示 {nodes.length} 顆球（含根球），往下最多 {depth} 層。點選球上的展開按鈕可繼續深入。</p>{truncated&&<p role="alert">此範圍超過 1,000 顆球，僅顯示前 1,000 顆。請減少層數或從下層球繼續展開；本次顯示數並非完整組織總數。</p>}<TreeView nodes={nodes} mode={mode} onExplore={explore}/>{nodes.length===1&&<p>此範圍目前沒有下層球。若會員球尚未安置，請至多樹管理查看待安置清單。</p>}</>}
   {root&&canOpen(user?.role,'/organization/geo')&&<p><Link to={'/organization/geo?rootBallNo='+encodeURIComponent(root.primary)}>分析 {root.primary} 的地理分布</Link></p>}
  </Card>
 </div>;
}
