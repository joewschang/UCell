import {useState} from 'react';
import {get,qs} from '../../lib/api';
import {Qualification} from '../../types/domain';
import {Card,ErrorBox,Field,PageHeader,Badge} from '../../components/ui';
import {SearchOption,SearchSelect} from '../../components/SearchSelect';
import {TreeNode,TreeView} from '../../components/TreeView';

export function OrganizationPage(){
  const [root,setRoot]=useState<SearchOption|null>(null);const [mode,setMode]=useState<'SPONSOR'|'BINARY'>('SPONSOR');
  const [depth,setDepth]=useState(4);const [at,setAt]=useState(new Date().toISOString());const [nodes,setNodes]=useState<TreeNode[]>([]);
  const [error,setError]=useState<unknown>(null);const [loading,setLoading]=useState(false);
  async function qualSearch(q:string){
    const r:any=await get('/admin/qualifications'+qs({q,status:'EFFECTIVE',take:20}));
    return (r.data as Qualification[]).map(x=>({id:x.qualificationId,primary:`Q#${x.qualificationNo??'—'} · ${x.currentHolder?.legalName??'—'}`,secondary:`${x.planLevelCode} · ${x.qualificationId}`}));
  }
  async function load(){
    if(!root)return;setLoading(true);setError(null);
    try{const path=mode==='SPONSOR'?`/admin/observability/organization/sponsor-tree/${root.id}`:`/admin/observability/organization/binary-tree/${root.id}`;const r:any=await get(path+qs({depth,at}));setNodes(r.data??[])}
    catch(e){setError(e)}finally{setLoading(false)}
  }
  return <><PageHeader title="組織視圖" subtitle="Sponsor Tree 與 Binary Tree 永遠分離呈現；可依歷史時間點檢視有效組織。"/>
  <div className="grid two"><Card title="查詢條件"><div className="form">
    <SearchSelect label="Root Qualification" value={root} onChange={x=>{setRoot(x);setNodes([])}} search={qualSearch}/>
    <Field label="樹別"><select value={mode} onChange={e=>{setMode(e.target.value as any);setNodes([])}}><option value="SPONSOR">Sponsor Tree</option><option value="BINARY">Binary Tree</option></select></Field>
    <Field label="深度"><input type="number" min="1" max={mode==='SPONSOR'?10:12} value={depth} onChange={e=>setDepth(Number(e.target.value))}/></Field>
    <Field label="時間點"><input value={at} onChange={e=>setAt(e.target.value)}/></Field>
    <button className="primary" disabled={!root||loading} onClick={load}>{loading?'讀取中…':'載入組織'}</button><ErrorBox error={error}/>
  </div></Card>
  <Card title="制度提醒"><p><Badge tone="ok">Sponsor Tree</Badge>：推薦／推薦對等／EPV。</p><p><Badge tone="ok">Binary Tree</Badge>：左右區GPV、Pair、Carry、K1與RPV。</p><p className="muted">不得互相推導或混用。</p></Card></div>
  <Card title={`${mode==='SPONSOR'?'Sponsor':'Binary'} Tree`}><TreeView nodes={nodes} mode={mode}/></Card></>
}
