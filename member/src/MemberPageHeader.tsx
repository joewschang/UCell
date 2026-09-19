import {SectionHeader,QualificationBadge} from '@ucell/design-system';
import type {Qualification} from './api';
import {useOptionalQualification} from './QualificationContext';
import {qualificationPlanLevelLabel} from './terminology';

export function MemberPageHeader({title,q}:{title:string;q?:Qualification}){
 const qualification=useOptionalQualification();
 const memberNo=qualification?.memberNo??null;
 const memberNoStatus=qualification?.memberNoStatus??'unavailable';
 const memberNoText=memberNo??(memberNoStatus==='loading'?'正在確認':'尚未提供');
 return <div className="uc-member-title">
  <SectionHeader title={title}/>
  <div className="uc-member-identity-context" role="status" aria-live="polite">
   <span>會員編號</span><strong>{memberNoText}</strong>
   {memberNoStatus==='unavailable'&&<small>帳戶資料尚未同步；請前往「我的」重新載入。</small>}
  </div>
  {q&&<QualificationBadge code={`球編號 ${q.code}`} rank={`方案 ${qualificationPlanLevelLabel(q.rank)}`}/>}
 </div>;
}
