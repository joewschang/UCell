import {Badge} from '../../components/ui';
export type CanonicalPosition={positionNo:number;ballNo?:string|null;binaryPositionNo?:string;path?:string;qualificationId:string|null;ownerType:string|null;activeLabel:string|null;companyProfile?:{status?:string;planCode?:string|null;profileVersion?:string|null}|null;parentPositionNo:number|null;side:string|null};
export function CanonicalTree({positions,onSelect,selectedBallNo}:{positions:CanonicalPosition[];onSelect:(position:CanonicalPosition)=>void;selectedBallNo?:string}){
 return <figure aria-label="Binary Tree 創始七個位置" className="canonical-tree">
  <div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(72px,1fr))',gap:12,minWidth:640,padding:12}}>
   {positions.map(p=>{const companyPosition=p.positionNo<=3,leader=p.companyProfile?.status==='AVAILABLE'&&p.companyProfile.planCode==='LEADER',alwaysActive=p.activeLabel==='Always Active (Company Rule)',empty=!p.ballNo;
    const start=p.positionNo===1?4:p.positionNo===2?2:p.positionNo===3?6:1+(p.positionNo-4)*2;
    const accessibleLabel=[
     '選擇創始位置 #'+p.positionNo,
     leader?'公司球':companyPosition?'公司創始位置':empty?'可用位置':'會員來源球',
     'Ball Number '+(p.ballNo??'尚未占用'),
     'Binary 位置 '+(p.binaryPositionNo??'未提供'),
     '路徑 '+(p.path??'根'),
     p.parentPositionNo?'父位置 #'+p.parentPositionNo+' · '+(p.side==='LEFT'?'左側':p.side==='RIGHT'?'右側':'側別未提供'):'根位置'
    ].join('；');
    return <button key={p.positionNo} type="button" onClick={()=>onSelect(p)}
     aria-pressed={!!p.ballNo&&selectedBallNo===p.ballNo}
     aria-label={accessibleLabel}
     title={p.ballNo?'球編號 '+p.ballNo:'尚未占用'}
     style={{gridColumn:start+' / span 2',gridRow:p.positionNo===1?1:p.positionNo<=3?2:3,textAlign:'center',padding:12,borderRadius:12,border:empty?'2px dashed #64748b':'2px solid '+(leader?'#a16207':companyPosition?'#64748b':'#0369a1'),background:leader?'#fffbeb':empty?'#f8fafc':companyPosition?'#f8fafc':'#f0f9ff',color:'#172033'}}>
     <strong>#{p.positionNo} {leader?'公司球':companyPosition?'公司創始位置':empty?'AVAILABLE':'Member Ball'}</strong>
     {leader?<><div>領袖 LEADER</div>{alwaysActive&&<Badge>Always Active</Badge>}</>:companyPosition?<div>LEADER Profile 資料未提供</div>:<div>{empty?'尚未占用':p.ownerType==='COMPANY'?'公司持有 · 保留原 Plan':'會員球'}</div>}
     <small style={{display:'block',overflowWrap:'anywhere'}}>{p.ballNo??'等待首次放置'}</small>
     {p.path&&<small>路徑 {p.path}</small>}
     <small>{p.parentPositionNo?'父位置 #'+p.parentPositionNo+' · '+(p.side==='LEFT'?'左':'右'):'根位置'}</small>
    </button>;
   })}
  </div><figcaption>點選已占用的位置可帶入父球；空位只顯示可用狀態。#1–#3 只有在伺服器回傳核准的 LEADER Profile 時才會顯示為公司球；Always Active 不會豁免 Global rank 條件。</figcaption>
 </figure>;
}
