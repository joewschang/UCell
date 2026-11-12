import {uiValue,uiText} from "../../../../shared/design-system/i18n";
import {QualificationDetail} from './QualificationDetail';
import {QualificationReturnReviews} from './QualificationReturnReviews';
import {BallPicker, useBallDirectory} from './BallPicker';
import './ball-picker.css';

import {Qualification} from '../../types/domain';
import {Badge,Card,PageHeader} from '../../components/ui';
import {holderName} from '../../lib/format';

import {EmptyState} from '@ucell/design-system';

type ListActivity={label:string;tone:'ok'|'neutral'};

/** The list endpoint does not include the bounded Company bootstrap binding. */
export function listPlanLabel(qualification:Qualification){
 if(qualification.kind==='COMPANY_BOOTSTRAP')return uiText("方案請於 Ball 360 確認");
 return qualification.kind==='MEMBER_ORIGIN'&&qualification.planLevelCode?qualification.planLevelCode:uiText("Plan 未提供");
}

/** Never convert a raw Company owner field into an Always Active assertion. */
export function listActivityLabel(qualification:Qualification):ListActivity{
 if(qualification.kind==='COMPANY_BOOTSTRAP'||qualification.currentCompanyPrincipalId)return {label:uiText("Active 狀態請於 Ball 360 確認"),tone:'neutral'};
 return qualification.activeFlag?{label:uiText("ACTIVE"),tone:'ok'}:{label:uiText("INACTIVE"),tone:'neutral'};
}

export function QualificationsPage() {
  const directory = useBallDirectory();
  return <>
    <PageHeader title="會員資格一覽" subtitle="搜尋並選取會員球，可查看資格明細、維護基本資料與匯款資料。"/>
    <QualificationReturnReviews/>
    <BallPicker directory={directory} holder={row => row.currentHolderLegalEntity?.registeredName || holderName(row)}
      facts={row => {
        const activity = listActivityLabel(row);
        return <>{row.currentHolder?.memberNo ?? row.currentHolderLegalEntity?.memberNo} · {uiValue(listPlanLabel(row))}
          <Badge tone="neutral">{row.status === 'DRAFT' ? '尚未啟用' : uiValue(row.status)}</Badge>
          <Badge tone={activity.tone}>{uiValue(activity.label)}</Badge></>;
      }}>
      <Card title="球 360"><section id="ball-detail" tabIndex={-1} aria-live="polite">
        {directory.selected ? <QualificationDetail key={directory.selected} id={directory.selected}/> :
          <EmptyState title="請選擇一顆球"><p>從清單選擇球位，查看會員資格明細。</p></EmptyState>}
      </section></Card>
    </BallPicker>
  </>;
}
