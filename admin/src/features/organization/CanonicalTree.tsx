import {Badge} from '../../components/ui';
export type CanonicalPosition={positionNo:number;ballNo?:string|null;binaryPositionNo?:string;path?:string;qualificationId:string|null;ownerType:string|null;activeLabel:string|null;companyProfile?:{status?:unknown;planCode?:unknown;profileVersion?:unknown}|null;parentPositionNo:number|null;side:string|null};

/**
 * `companyProfile.status === AVAILABLE` is a bounded, server-validated read of
 * the sealed binding. LEADER is valid only for the three canonical bootstrap
 * positions. Do not derive it from ownership alone: Company-held Member-origin
 * Balls retain their own plan and an unavailable/ambiguous binding remains
 * unavailable.
 */
export function hasApprovedLeaderCompanyBinding(position:CanonicalPosition){
 const binding=position.companyProfile;
 return position.positionNo>=1
  && position.positionNo<=3
  && typeof position.ballNo==='string'
  && position.ballNo.trim().length>0
  && position.ownerType==='COMPANY'
  && binding?.status==='AVAILABLE'
  && binding.planCode==='LEADER'
  && typeof binding.profileVersion==='string'
  && binding.profileVersion.trim().length>0;
}

/** Company ownership is the authority for Always Active; it does not imply LEADER. */
export function authoritativeActiveLabel(position:CanonicalPosition){
 switch(position.activeLabel){
  case 'Always Active (Company Rule)':return position.ownerType==='COMPANY'?position.activeLabel:null;
  case 'ACTIVE':case 'INACTIVE':return position.activeLabel;
  case 'UNKNOWN':return '證據不可用';
  default:return null;
 }
}

export function CanonicalTree({positions,onSelect,selectedBallNo}:{positions:CanonicalPosition[];onSelect:(position:CanonicalPosition)=>void;selectedBallNo?:string}){
 return <figure aria-label="Binary Tree 創始七個位置" className="canonical-tree">
  <div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(72px,1fr))',gap:12,minWidth:640,padding:12}}>
   {positions.map(p=>{const leader=hasApprovedLeaderCompanyBinding(p),alwaysActive=authoritativeActiveLabel(p)==='Always Active (Company Rule)',companyHeld=p.ownerType==='COMPANY',bootstrapSlot=p.positionNo>=1&&p.positionNo<=3,occupied=p.qualificationId!==null&&p.qualificationId!==undefined,empty=!occupied,hasBallNumber=typeof p.ballNo==='string'&&p.ballNo.trim().length>0;
    const start=p.positionNo===1?4:p.positionNo===2?2:p.positionNo===3?6:1+(p.positionNo-4)*2;
    const accessibleLabel=[
     '選擇創始位置 #'+p.positionNo,
     leader?'公司球（已核准 LEADER Profile）':empty?'可用位置':companyHeld?(bootstrapSlot?'公司持有球；LEADER Profile 證據未提供':'公司持有球；非 Bootstrap，保留原 Plan'):'會員來源球',
     alwaysActive?'Always Active（公司持有）':null,
     'Ball Number '+(hasBallNumber?p.ballNo:empty?'尚未占用':'證據未提供'),
     'Binary 位置 '+(p.binaryPositionNo??'未提供'),
     '路徑 '+(p.path??'根'),
     p.parentPositionNo?'父位置 #'+p.parentPositionNo+' · '+(p.side==='LEFT'?'左側':p.side==='RIGHT'?'右側':'側別未提供'):'根位置'
    ].join('；');
    return <button key={p.positionNo} type="button" onClick={()=>onSelect(p)}
     aria-pressed={occupied&&hasBallNumber&&selectedBallNo===p.ballNo}
     aria-label={accessibleLabel}
     title={hasBallNumber?'球編號 '+p.ballNo:empty?'尚未占用':'Ball Number 證據未提供'}
     style={{gridColumn:start+' / span 2',gridRow:p.positionNo===1?1:p.positionNo<=3?2:3,textAlign:'center',padding:12,borderRadius:12,border:empty?'2px dashed #64748b':'2px solid '+(leader?'#a16207':'#0369a1'),background:leader?'#fffbeb':empty?'#f8fafc':'#f0f9ff',color:'#172033'}}>
     <strong>#{p.positionNo} {leader?'公司球':empty?'AVAILABLE':companyHeld?'公司持有球':'Member Ball'}</strong>
     {leader?<div>領袖 LEADER</div>:<div>{empty?'尚未占用':!hasBallNumber?'資格已占用 · Ball Number 證據未提供':companyHeld?(bootstrapSlot?'公司持有 · LEADER Profile 證據未提供':'公司持有 · 非 Bootstrap · 保留原 Plan'):'會員球'}</div>}
     {alwaysActive&&<Badge>Always Active</Badge>}
     <small style={{display:'block',overflowWrap:'anywhere'}}>{hasBallNumber?p.ballNo:empty?'等待首次放置':'Ball Number 證據未提供'}</small>
     {p.path&&<small>路徑 {p.path}</small>}
     <small>{p.parentPositionNo?'父位置 #'+p.parentPositionNo+' · '+(p.side==='LEFT'?'左':'右'):'根位置'}</small>
    </button>;
   })}
  </div><figcaption>點選已占用的位置可帶入父球；空位只顯示可用狀態。LEADER 只在 #1–#3 回傳已核准的有效 binding 時顯示。Always Active 依伺服器回傳的公司持有證據顯示，不代表 LEADER 或 Global rank 豁免；公司持有的非 Bootstrap 球保留原 Plan。</figcaption>
 </figure>;
}
