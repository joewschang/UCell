import type {Qualification} from './api';
import * as data from './memberData';
import {useResource} from './useResource';
import {ErrorState,LoadingState,UCellButton} from '@ucell/design-system';
import {availabilityText,formatNullableNumber,qualificationActiveLabel} from './terminology';

type RepurchaseState='ACTIVE'|'PENDING'|'INACTIVE';

const taskCopy:Record<RepurchaseState,{title:string;detail:string}>={
 ACTIVE:{title:'本月重購已完成',detail:'目前資格的本月重購狀態已由系統回傳。'},
 PENDING:{title:'重購認列確認中',detail:'系統尚在確認本月重購認列；不以畫面自行推算完成時間。'},
 INACTIVE:{title:'本月重購尚未完成',detail:'請查看重購認列詳情，確認目前球的有效資格資訊。'},
};

/** Displays only authoritative member facts; no binary pairing, Carry or payout is calculated in the browser. */
export default function MemberTodaySummary({q,monthlyRepurchaseStatus,repurchaseDetailsOpen,onShowRepurchaseDetails}:{q:Qualification;monthlyRepurchaseStatus:RepurchaseState;repurchaseDetailsOpen:boolean;onShowRepurchaseDetails:()=>void}){
 const binary=useResource(`today-binary:${q.id}`,signal=>data.getBinary(q,signal));
 const task=taskCopy[monthlyRepurchaseStatus];
 return <section className="card uc-today-summary" aria-labelledby="today-summary-title">
  <div className="uc-card-heading"><div><small>MY UCELL TODAY</small><h3 id="today-summary-title">目前球摘要</h3></div><span>球編號 {q.code}</span></div>
  <dl className="uc-today-facts">
   <div><dt>方案</dt><dd>{data.displayPlanLevel(q.rank)}</dd></div>
   <div><dt>資格</dt><dd>{qualificationActiveLabel(q.active)}</dd></div>
   <div><dt>下次撥付</dt><dd>{availabilityText.fieldMissing}</dd></div>
  </dl>
  <div className="uc-today-binary" aria-labelledby="today-binary-title">
   <div><small>BINARY SUMMARY</small><h4 id="today-binary-title">二元摘要</h4></div>
   {!binary.data&&!binary.error&&<LoadingState label="正在載入二元摘要…"/>}
   {binary.error&&<ErrorState message={binary.error} retry={binary.retry}/>}
   {binary.data&&<dl>
    <div><dt>左區球數</dt><dd>{formatNullableNumber(binary.data.left.count)}</dd></div>
    <div><dt>右區球數</dt><dd>{formatNullableNumber(binary.data.right.count)}</dd></div>
    <div><dt>左區 Carry</dt><dd>{binary.data.settlementMetrics.status==='AVAILABLE'?formatNullableNumber(binary.data.left.carry):availabilityText.readModelMissing}</dd></div>
   <div><dt>右區 Carry</dt><dd>{binary.data.settlementMetrics.status==='AVAILABLE'?formatNullableNumber(binary.data.right.carry):availabilityText.readModelMissing}</dd></div>
   </dl>}
   {binary.data?.settlementMetrics.status==='UNAVAILABLE'&&<p className="uc-binary-unavailable" role="status">二元結算讀取模型尚未提供，Carry 不顯示為零。</p>}
  </div>
  <div className="uc-today-task"><div><small>目前待辦</small><strong>{task.title}</strong><p>{task.detail}</p></div><UCellButton className="uc-today-task-link" aria-expanded={repurchaseDetailsOpen} aria-controls="repurchase-details" onClick={onShowRepurchaseDetails}>查看重購詳情</UCellButton></div>
 </section>;
}
