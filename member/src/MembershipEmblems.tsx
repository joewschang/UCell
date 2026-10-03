import {useState} from 'react';
import {QualificationEmblem,GlobalRankEmblem} from '@ucell/design-system';
import {useOptionalQualification} from './QualificationContext';

const plans:Record<string,{label:string;file:string}>={STARTER:{label:'啟航',file:'starter'},ELITE:{label:'菁英',file:'elite'},LEADER:{label:'領袖',file:'leader'}};
export const globalRankCodes=['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN'] as const;
const ranks:Record<string,{label:string;file:string}>={NEW_STAR:{label:'新星勳章',file:'new-star'},EXCELLENCE:{label:'卓越勳章',file:'excellence'},GLORY:{label:'榮耀勳章',file:'glory'},DIAMOND:{label:'鑽石勳章',file:'diamond'},CROWN:{label:'皇冠勳章',file:'crown'}};

function ArtworkEmblem({code,kind,compact=false}:{code:string;kind:'plan'|'rank';compact?:boolean}){
 const meta=(kind==='plan'?plans:ranks)[code],src=meta?`/badges/${meta.file}-v1.jpg`:'';
 const [failed,setFailed]=useState('');
 if(!meta)return null;
 if(failed===src)return kind==='plan'?<QualificationEmblem code={code} compact={compact}/>:<GlobalRankEmblem code={code} compact={compact}/>;
 return <span className="uc-art-emblem" data-kind={kind} data-code={code}><img src={src} width="48" height="48" alt={meta.label+(kind==='plan'?'會員資格':'聘階')} onError={()=>setFailed(src)}/>{!compact&&<span>{meta.label}</span>}</span>;
}
export function MembershipPlanEmblem({code,compact=false}:{code:string;compact?:boolean}){return <ArtworkEmblem code={code} kind="plan" compact={compact}/>;}
export function MembershipRankEmblem({code,compact=false}:{code:string;compact?:boolean}){return <ArtworkEmblem code={code} kind="rank" compact={compact}/>;}
export function BallRankBadge({qualificationNo}:{qualificationNo?:string}){
 const state=useOptionalQualification();
 if(!qualificationNo||!state||state.globalRankStatus==='unavailable'||!state.globalRankStatus)return <small className="uc-ball-rank-state">聘階資料待確認</small>;
 if(state.globalRankStatus==='loading')return <small className="uc-ball-rank-state">聘階載入中…</small>;
 const rank=state.globalRanks?.[qualificationNo];
 return rank?<span className="uc-ball-rank"><span>聘階</span><MembershipRankEmblem code={rank}/></span>:<small className="uc-ball-rank-state">尚無已達成聘階</small>;
}
