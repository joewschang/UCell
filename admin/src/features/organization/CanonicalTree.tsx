import {Badge} from '../../components/ui';
export type CanonicalPosition={positionNo:number;ballNo?:string|null;binaryPositionNo?:string;path?:string;qualificationId:string|null;ownerType:string|null;activeLabel:string|null;parentPositionNo:number|null;side:string|null};
export function CanonicalTree({positions,onSelect}:{positions:CanonicalPosition[];onSelect:(position:CanonicalPosition)=>void}){
 return <figure aria-label="Binary Tree 創始七個位置" style={{margin:0,overflowX:'auto'}}>
  <div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(72px,1fr))',gap:12,minWidth:640,padding:12}}>
   {positions.map(p=>{const company=p.positionNo<=3,empty=!p.qualificationId;
    const start=p.positionNo===1?4:p.positionNo===2?2:p.positionNo===3?6:1+(p.positionNo-4)*2;
    return <button key={p.positionNo} type="button" onClick={()=>onSelect(p)}
     aria-label={'選擇 #'+p.positionNo+(company?' 公司球':empty?' 可用位置':' 會員來源球')}
     style={{gridColumn:start+' / span 2',gridRow:p.positionNo===1?1:p.positionNo<=3?2:3,textAlign:'center',padding:12,borderRadius:12,border:empty?'2px dashed #64748b':'2px solid '+(company?'#a16207':'#0369a1'),background:company?'#fffbeb':empty?'#f8fafc':'#f0f9ff',color:'#172033'}}>
     <strong>#{p.positionNo} {company?'公司球':empty?'AVAILABLE':'Member Ball'}</strong>
     {company?<><div>領袖 LEADER</div><Badge>Always Active</Badge></>:<div>{empty?'尚未占用':p.ownerType==='COMPANY'?'公司持有 · 保留原 Plan':'會員球'}</div>}
     <small style={{display:'block',overflowWrap:'anywhere'}}>{p.ballNo??'等待首次放置'}</small>
     {p.path&&<small>路徑 {p.path}</small>}
     <small>{p.parentPositionNo?'父位置 #'+p.parentPositionNo+' · '+(p.side==='LEFT'?'左':'右'):'根位置'}</small>
    </button>;
   })}
  </div><figcaption>點選位置可帶入父球。#1–#3 使用核准的 LEADER Profile；Always Active 不會豁免 Global rank 條件。</figcaption>
 </figure>;
}
