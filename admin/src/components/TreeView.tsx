export interface TreeNode{
  qualification_id:string; qualification_no?:string; legal_name?:string; plan_level_code?:string;
  active_flag?:boolean; parent_qualification_id?:string|null; sponsor_sequence_no?:number|null;
  side?:'LEFT'|'RIGHT'|null; depth:number;
}
export function TreeView({nodes,mode}:{nodes:TreeNode[];mode:'SPONSOR'|'BINARY'}){
  if(!nodes.length)return <p className="muted">沒有樹資料。</p>;
  const byParent=new Map<string|null,TreeNode[]>();
  for(const n of nodes){const key=n.depth===0?null:(n.parent_qualification_id??null);const a=byParent.get(key)??[];a.push(n);byParent.set(key,a);}
  function render(parent:string|null,depth=0):any{
    const children=byParent.get(parent)??[];
    return <div className={`tree-level depth-${depth}`}>{children.map(n=><div className="tree-branch" key={n.qualification_id}>
      <div className={`tree-node ${n.active_flag?'active':'inactive'}`}>
        <div className="tree-node-top"><strong>Q#{n.qualification_no??'—'} · {n.legal_name??'—'}</strong><span className="tree-pill">{n.plan_level_code??'—'}</span></div>
        <div className="tree-node-meta">{mode==='SPONSOR'&&n.depth>0&&<span>直推序號 #{n.sponsor_sequence_no??'—'}</span>}{mode==='BINARY'&&n.depth>0&&<span>{n.side}</span>}<span>{n.active_flag?'Active':'Inactive'}</span></div>
      </div>{render(n.qualification_id,depth+1)}
    </div>)}</div>
  }
  return <div className="tree-scroll">{render(null)}</div>
}
