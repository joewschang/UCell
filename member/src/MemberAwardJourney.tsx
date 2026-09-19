import {AwardLifecycle,MoneyState} from '@ucell/design-system';
import {useId} from 'react';
import type {Award,Qualification} from './api';
import {availabilityText,awardStatusLabels,formatNullableMoney} from './terminology';

function field(value:string|null|undefined){return value??availabilityText.fieldMissing;}
function pendingReasonText(reason:string|null|undefined){
 return ({
  SETTLEMENT_NOT_FINALIZED:'結算尚未完成',
  SETTLEMENT_NOT_ASSIGNED:'尚未排入結算',
  SETTLEMENT_NOT_AVAILABLE:'結算資料尚未提供',
 } as Record<string,string>)[reason??'']??(reason?'目前尚未提供進一步原因':'');
}

/** Member-safe explanation: it only repeats the authoritative Award projection and never computes an entitlement. */
export default function MemberAwardJourney({award,q,period}:{award:Award;q:Qualification;period:string}){
 const titleId=useId();
 const recovery=award.status==='REVERSED'||award.status==='CLAWBACK'?awardStatusLabels[award.status]:availabilityText.fieldMissing;
 const paid=award.status==='PAID'?'已支付':availabilityText.fieldMissing;
 return <article className="card uc-award-card" aria-labelledby={titleId}>
  <div className="uc-award-heading"><div><small>AWARD JOURNEY</small><h3 id={titleId}>{award.name}</h3><p className="uc-award-status">{awardStatusLabels[award.status]}</p></div><MoneyState amount={award.finalAmount??null} status={award.finalAmount==null?'PENDING':award.status}/></div>
  <p className="uc-award-context"><span>球編號</span> {q.code}<span aria-hidden="true"> · </span><span>查詢月份</span> {period}</p>
  <AwardLifecycle status={award.status}/>
  <dl className="uc-award-journey-grid">
   <div><dt>獎項類型</dt><dd>{award.name}</dd></div>
   <div><dt>來源</dt><dd>{availabilityText.fieldMissing}</dd></div>
   <div><dt>結算狀態</dt><dd>{field(award.settlementStatus)}</dd></div>
   <div><dt>Theory</dt><dd>{formatNullableMoney(award.theoryAmount)}</dd></div>
   <div><dt>Final</dt><dd>{formatNullableMoney(award.finalAmount)}</dd></div>
   <div><dt>Payable</dt><dd>{formatNullableMoney(award.payableAmount)}</dd></div>
   <div><dt>已支付</dt><dd>{paid}</dd></div>
   <div><dt>結算日期</dt><dd>{field(award.settlementDate)}</dd></div>
   <div><dt>撥付日期</dt><dd>{field(award.adjustedPayoutDate??award.nominalPayoutDate)}</dd></div>
   <div><dt>沖回／追扣</dt><dd>{recovery}</dd></div>
  </dl>
  <details className="uc-domain-detail uc-member-explain">
   <summary>查看可用的結算說明</summary>
   <p>這份說明只使用伺服器回傳的本球、月份、結算狀態與版本資料；未提供的來源、調整或金額不會由網頁自行推算。</p>
   <dl className="uc-audit-grid">
    <div><dt>球編號</dt><dd>{q.code}</dd></div>
    <div><dt>月份</dt><dd>{period}</dd></div>
    <div><dt>結算</dt><dd>{field(award.settlementStatus)}{award.pendingReason?` · ${pendingReasonText(award.pendingReason)}`:''}</dd></div>
    <div><dt>制度版本</dt><dd>{field(award.ruleVersion)}</dd></div>
    <div><dt>結算日曆</dt><dd>{field(award.businessCalendarVersion)}</dd></div>
    <div><dt>參數快照</dt><dd>{award.parameterSnapshotHash?'已提供，可供系統比對':availabilityText.fieldMissing}</dd></div>
   </dl>
  </details>
 </article>;
}
