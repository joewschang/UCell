import {uiValue,domainLabel} from "../../../shared/design-system/i18n";
export interface TreeNode{
  qualification_id:string; ball_no?:string|null; qualification_kind?:string; qualification_no?:string; legal_name?:string; plan_level_code?:string;
  active_flag?:boolean; parent_qualification_id?:string|null; sponsor_sequence_no?:number|null;
  side?:'LEFT'|'RIGHT'|null; depth:number;
}
export function TreeView({nodes,mode,onExplore}:{nodes:TreeNode[];mode:'SPONSOR'|'BINARY';onExplore?:(node:TreeNode)=>void}){
  if(!nodes.length)return <p className="muted">沒有樹資料。</p>;
  const byParent=new Map<string|null,TreeNode[]>();
  for(const n of nodes){const key=n.depth===0?null:(n.parent_qualification_id??null);const a=byParent.get(key)??[];a.push(n);byParent.set(key,a);}
  function render(parent:string|null,depth=0):any{
    const children=depth>12?[]:byParent.get(parent)??[];
    return <div className={`tree-level depth-${depth}`}>{children.map(n=><div className="tree-branch" key={n.qualification_id}>
      <div className={`tree-node ${n.qualification_kind==='COMPANY_BOOTSTRAP'?'company':n.active_flag==null?'unknown':n.active_flag?'active':'inactive'}`}>
        <div className="tree-node-top"><strong>{n.ball_no??'尚未編配球號'} · {n.qualification_kind==='COMPANY_BOOTSTRAP'?'公司球':n.legal_name??'—'}</strong><span className="tree-pill">{n.qualification_kind==='COMPANY_BOOTSTRAP'?'公司球':domainLabel(n.plan_level_code??'—')}</span></div>
        <div className="tree-node-meta">{mode==='SPONSOR'&&n.depth>0&&<span>直推序號 #{n.sponsor_sequence_no??'—'}</span>}{mode==='BINARY'&&n.depth>0&&<span>{domainLabel(n.side)}</span>}<span>{n.qualification_kind==='COMPANY_BOOTSTRAP'?'公司資格':n.active_flag==null?'活躍狀態未提供':uiValue(n.active_flag?'Active':'Inactive')}</span></div>
        {onExplore&&n.ball_no&&<button type="button" onClick={()=>onExplore(n)} aria-label={'以 '+n.ball_no+' 展開組織'}>以此球往下展開</button>}
      </div>{render(n.qualification_id,depth+1)}
    </div>)}</div>
  }
  return <div className="tree-scroll">{render(null)}</div>
}
