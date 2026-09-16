import {SectionHeader,QualificationBadge} from '@ucell/design-system';
import type {Qualification} from './api';
export function MemberPageHeader({title,q}:{title:string;q?:Qualification}){return <div className="uc-member-title"><SectionHeader title={title}/>{q&&<QualificationBadge code={q.code} ball={q.ballLabel}/>}</div>}
