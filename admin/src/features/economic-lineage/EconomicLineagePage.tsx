import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link,useSearchParams} from 'react-router-dom';
import {get} from '../../lib/api';
import {Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import './economic-lineage.css';

type Row=Record<string,any>;
export type Lineage={order:{orderNo:string;status:string;paidAt?:string;confirmedAt?:string};payments?:Row[];economicEvidence?:Record<string,Row[]>};
const awards:Record<string,string>={REFERRAL:'推薦獎金',RETAIL_REFERRAL:'零售推薦獎金',EQUALIZATION:'平級獎金',BINARY:'對碰獎金',MATCHING:'配對獎金',RPV:'RPV 獎金',EPV:'EPV 獎金',GLOBAL:'Global 獎金'};
const states:Record<string,string>={HISTORICAL_INTERVAL_REMOVED:'歷史資格區間已取消',HISTORICAL_INTERVAL_REPLACED:'歷史資格區間已替代',OPEN:'待處理',PAID:'已付款',PARTIALLY_PAID:'部分付款',FAILED:'失敗',READY:'準備中',ALLOCATED:'已編入付款',EXPORTED:'已匯出',RECOGNIZED:'已認列',SCHEDULED:'待認列',REVERSED:'已沖回',OFFSETTING:'抵扣中',RECOVERED:'已追回',CONVERGED:'重算已收斂',MAX_HORIZON:'達重算週數上限',PENDING:'待處理',POSTED:'已過帳',CALCULATED_FROM_POSTED_RETURNS:'依已過帳退貨計算',SOURCE_LINE_UNAVAILABLE:'缺少原始明細關聯',SOURCE_LINK_UNAVAILABLE:'缺少歷史關聯',NO_RECORDED_EFFECTS:'尚無對應入帳紀錄',RECORDED_EFFECTS:'已有對應入帳紀錄'};
const fields:Record<string,string>={rankLevel:'結算位階',weakSidePv:'當期弱邊 PV',weakSideThreshold:'當時弱邊門檻',rankAchieved:'當時已達成位階',eligibilityType:'期間資格類型',entitlementAmount:'當時權益金額',theoryKind:'理論類型',unlockEligible:'當時代數已解鎖',reasonCode:'判定原因',cumulativeBefore:'認列前月累計',eligibleDelta:'本次認列增量',cumulativeAfter:'認列後月累計',activeThreshold:'當時 Active 門檻',thresholdCrossed:'本筆跨越門檻',epvAfter:'當時累計 EPV',activeFrom:'歷史資格起始',activeTo:'歷史資格結束',eligibleAmount:'符合資格的認列量',exclusionReasonCode:'排除原因',recognizedAt:'認列時間',sku:'認列時 SKU',baseAmount:'計算基礎金額',baseType:'計算基礎',rate:'認列比例',calculationType:'計算方式',retailReferralEnabled:'當時啟用零售推薦',productRuleVersion:'商品規則版本',source:'歸屬來源',sourceDescription:'來源',occurredAt:'發生時間',effectiveAt:'生效時間',recordedAt:'記錄時間',availableAt:'可用時間',recognitionMonth:'認列月份',planCode:'方案',installmentNo:'期數',generation:'代數',amount:'金額',pvType:'PV 類型',originalGpv:'原始 GPV',reversedGpv:'退貨扣減 GPV',retainedGpv:'保留 GPV',theoryAmount:'理論金額',payableAmount:'可得金額',kFactor:'調整係數 K',activeAtRecognition:'認列時有效',active:'認列時有效',eligible:'符合資格',status:'狀態',originallyPosted:'原始權益',recalculatedEntitlement:'重算權益',delta:'本次調整',originalVolume:'原始 PV',recordedDelta:'已記錄調整',recordedRetainedVolume:'已記錄 PV 餘額',recordedEntitlement:'已記錄權益餘額',grossAmount:'總額',netAmount:'淨額',recoveryOffset:'追回款抵扣',recoveryAmount:'應追回',recoveredAmount:'已追回',outstandingAmount:'待追回',finalAmount:'原始入帳',amountDelta:'入帳調整',reportedPaidAmount:'回報累計付款額',batchStatus:'付款批次狀態',payoutBatchStatus:'付款批次狀態',recognizedAmount:'認列金額',rpvAmount:'RPV',scheduleRetainedEntitlementRatio:'排程保留比例',refundAmount:'退款金額',fullCancellation:'全額取消',orderOriginalGpv:'本單原始 GPV',original:'原始金額',recomputed:'重算金額',left:'左側結轉',right:'右側結轉',pairedPv:'配對 PV',ruleVersionCode:'規則版本',ruleVersion:'規則版本',periodStart:'期間開始',periodEnd:'期間結束',processedWeeks:'已處理週數',maxWeeks:'週數上限',actionCompleted:'有重算完成紀錄',originalK1:'原始 K1',recomputedK1:'重算 K1',originalK2:'原始 K2',recomputedK2:'重算 K2'};
const children:Record<string,string>={eligibilityDecisions:'期間資格判定（整期背景）',replacements:'本次資格區間變更',activeIntervals:'本筆產生的歷史 Active 區間',sources:'本單來源 PV',awards:'認列獎金',corrections:'重算調整',replayedEntitlements:'已重算權益',adjustments:'PV 調整',applications:'抵扣明細',payables:'應付款',paymentResults:'付款回報（累計金額，不相加）',effects:'入帳紀錄',recipients:'對象明細',postedCancellations:'已過帳取消',periods:'後續期間',carryChanges:'結轉差異',awardChanges:'獎金差異',postings:'實際分錄',carryProjections:'已記錄結轉'};
const objects:Record<string,string>={previousInterval:'被替代的歷史區間',monthContext:'歷史月累計背景',retailRecognition:'零售推薦歷史認列',attribution:'歷史推薦歸屬',periodContext:'整期背景（不歸給單筆訂單）',recordedRetention:'已記錄保留權益',replay:'歷史重算',recordedEffects:'對應入帳證據',correctionAward:'追加獎金',recovery:'追回款',reservoirBEffect:'Reservoir B 調整',payout:'付款明細（包含其他來源，不全歸給本筆）'};
const historicalLabels:Record<string,string>={NET_PAID_ITEM_AMOUNT:'商品實付淨額',PERCENTAGE:'按比例',RETAIL_CHECKOUT_CANDIDATE_REVALIDATED:'結帳時驗證推薦歸屬',ADMIN_FORWARD_CORRECTION:'管理員向後生效更正'};
const inputConditionLabels:Record<string,string>={RETAIL_REFERRAL_DISABLED:'當時未啟用零售推薦',NO_STORED_REFERRER:'當時未記錄推薦人',UNSUPPORTED_CALCULATION_TYPE:'當時計算方式不受支援',UNSUPPORTED_BASE_TYPE:'當時計算基礎不受支援',MISSING_RATE:'缺少當時比例',ZERO_RATE:'當時比例為零',ZERO_BASE_AMOUNT:'當時計算基礎金額為零'};
const theoryReasons:Record<string,string>={WEAK_SIDE_BELOW_THRESHOLD:'當期弱邊 PV 未達門檻',RANK_NOT_ACHIEVED:'當時尚未達成位階',INACTIVE:'當時未符合 Active',LOCKED:'當時代數尚未解鎖',ELIGIBLE:'符合當時計算條件',HISTORICAL_INACTIVE:'當時未符合 Active',FIXED_GENERATION_LOCKED:'固定代數尚未解鎖',G1_REFERRAL_THEORY_ZERO:'第一代推薦理論金額為零'};
function value(key:string,item:unknown){if(item===null)return '未提供';if(typeof item==='boolean')return item?'是':'否';if(typeof item!=='string'&&typeof item!=='number')return '';if(key==='eligibilityType')return ({GLOBAL_ELIGIBILITY:'Global 資格',REFERRAL_ELIGIBILITY:'推薦資格',REFERRAL_MATCHING_ELIGIBILITY:'平級資格',BINARY_ELIGIBILITY:'對碰資格',BINARY_MATCHING_ELIGIBILITY:'配對資格'} as Record<string,string>)[String(item)]??'其他期間資格';if(key==='theoryKind')return ({REFERRAL:'推薦',REFERRAL_MATCHING:'平級',BINARY_MATCHING:'配對'} as Record<string,string>)[String(item)]??'其他理論';if(key==='reasonCode')return theoryReasons[String(item)]??String(item);if(key==='exclusionReasonCode')return String(item)==='ZERO_ELIGIBLE_AMOUNT'?'符合資格的金額為零':String(item);if(['baseType','calculationType','source'].includes(key))return historicalLabels[String(item)]??'其他歷史設定';return key.toLowerCase().includes('status')?states[String(item)]??'待確認':String(item);}
function Evidence({row}:{row:Row}){return <><dl className="lineage-facts">{Object.entries(fields).filter(([key])=>key in row).map(([key,label])=>typeof row[key]==='object'&&row[key]!==null?null:<div key={key}><dt>{label}</dt><dd>{value(key,row[key])}</dd></div>)}</dl>
  {row.eligibilityType==='GLOBAL_ELIGIBILITY'&&<p>此筆說明結算時的位階資格，不提供假設獎金；實際權益請見整期對象明細。</p>}
  {row.eligibilityEvidenceStatus==='UNAVAILABLE'&&<p>此快照未保存期間資格判定，無法推定未產生獎金的原因。</p>}
  {row.eligibilityEvidenceStatus==='RECORDED'&&<p>以下為封存時的整期資格判定，不代表本單的獎金分配或目前資格；沒有明細不代表所有對象都符合資格。</p>}
  {row.basis==='ORIGINAL_THEORY_NOT_FINAL_ENTITLEMENT'&&<p>這是原始 GPV 的歷史理論計算，不代表最終可領獎金、結算完成或付款。零金額保留當時的資格判定，不使用目前狀態重算。</p>}
  {row.basis==='RETURN_MONTH_REPLAY_NOT_CURRENT_ACTIVE'&&<p>這是本單退貨引發的整月資格重算，不代表目前 Active 狀態。沒有替代區間紀錄不代表資格已取消；重複重算的月差額不能相加。</p>}
  {row.basis==='HISTORICAL_MONTH_CONTEXT_NOT_ORDER_TOTAL'&&<p>月累計可能包含其他訂單，不能全歸給本單。這是當時的資格證據，不代表目前 Active 狀態；沒有本筆產生的區間也不代表當時不具資格。</p>}
  {row.basis==='RECORDED_CONSUMPTION_DECISION'&&row.monthContext===null&&<p>缺少對應的歷史月累計證據，無法推定當時 Active 狀態。</p>}
  {row.basis==='RECORDED_CONSUMPTION_DECISION'&&<><p>這是當時保存的消費認列結果，不代表獎金或付款結果。</p>{row.volumeEvidence==='NO_RECORDED_VOLUME'&&<p>{row.eligible?'尚無對應 PV 紀錄；不能推定已完成後續入帳。':'已記錄為不符合認列資格，認列量為零。'}</p>}</>}
  {row.basis==='STORED_INPUT_NOT_RECOGNITION_RESULT'&&<><p>這是下單時保存的輸入，不代表已完成獎金認列。</p><p>{row.awardEvidence==='RECORDED_AWARD'?'已有對應獎金紀錄，金額請見獎金事件。':'尚無對應獎金紀錄；不推定為零金額或認列完成。'}</p>{row.inputConditions?.length?<ul>{row.inputConditions.map((code:string)=><li key={code}>{inputConditionLabels[code]??'其他歷史輸入條件'}</li>)}</ul>:<p>未發現上述輸入缺口；實際資格與處理結果仍須認列證據。</p>}</>}
  {row.awardType==='RETAIL_REFERRAL'&&row.retailRecognition===null&&<p>缺少歷史認列快照；無法提供當時的商品比例與歸屬。</p>}
  {row.basis==='RECORDED_PV_AND_ENTITLEMENT_STATE'&&<p>僅表示已記錄的調整；不表示所有退貨皆已完成重算。</p>}
  {row.evidenceType==='CALCULATION_CHECKPOINT_NOT_PAYMENT'&&<p>這是重算進度，不能視為已入帳或已付款。</p>}
  {row.basis==='RECOVERY_OFFSET_NOT_CASH_PAYMENT'&&<p>此筆為追回款抵扣，並非現金付款。</p>}
  {(['original','recomputed'] as const).map(key=>row[key]&&typeof row[key]==='object'?<details key={key}><summary>{key==='original'?'原始結轉':'重算結轉'}</summary><Evidence row={row[key]}/></details>:null)}
  {Object.entries(objects).map(([key,label])=>row[key]&&typeof row[key]==='object'?<details key={key}><summary>{label}</summary><Evidence row={row[key]}/></details>:null)}
  {Object.entries(children).map(([key,label])=>Array.isArray(row[key])?<details key={key}><summary>{label}（{row[key].length}）</summary>{row[key].length?row[key].map((item:Row,index:number)=><section className="lineage-child" key={index}><h4>{awards[item.awardType]??`${label} ${index+1}`}</h4><Evidence row={item}/></section>):<p>尚無對應紀錄；不推定為零金額或已完成。</p>}</details>:null)}</>;}
export function lineageEvents(data:Lineage){
  const evidence=data.economicEvidence??{};const rows:Array<{title:string;at?:string;row:Row;context?:string}>=[];
  const sourceLabels=new Map<string,string>();
  (evidence.pvEvents??[]).forEach((row,index)=>sourceLabels.set(row.reference,`${row.pvType} 認列 ${index+1}`));
  (evidence.awards??[]).forEach((row,index)=>sourceLabels.set(row.reference,`${awards[row.awardType]??'獎金'} ${index+1}`));
  const add=(key:string,title:string,date:string,context?:string)=>{for(const row of evidence[key]??[])rows.push({title:awards[row.awardType]??title,at:row[date],row:{...row,...(row.sourcePvReference||row.sourceAwardReference||row.sourceOrderLineReference?{sourceDescription:sourceLabels.get(row.sourcePvReference??row.sourceAwardReference)??'本單明細'}:{})},context});};
  for(const row of data.payments??[])rows.push({title:'訂單收款',at:row.occurredAt,row});
  add('returnActiveReplays','退貨後資格變更','recordedAt');add('consumptionRecognitions','消費認列結果','recognizedAt');add('retailRecognitionInputs','零售推薦認列輸入','recordedAt');add('pvEvents','PV 認列','occurredAt');add('theoryCalculations','GPV 理論計算依據','occurredAt');add('awards','訂單獎金','occurredAt');add('subscriptionRecognitions','訂閱認列','recognizedAt');
  add('periodContributions','期間結算背景','periodEnd','本單曾納入此期計算；整期獎金不等於本單獎金。');
  add('payables','應付款','availableAt');add('recoveries','追回款','occurredAt');add('reservoirBDestinations','Reservoir B 入帳','effectiveAt');
  add('gpvRetention','目前 GPV 保留量','occurredAt','依目前已過帳退貨計算。');add('epvRetentions','已記錄 EPV 保留量','occurredAt');add('returnReplays','退貨後續重算','convergedAt','各期差異與實際入帳分開列示。');
  return rows.map((row,index)=>({...row,index})).sort((a,b)=>(a.at?Date.parse(a.at):Infinity)-(b.at?Date.parse(b.at):Infinity)||a.index-b.index);
}
export function EconomicLineagePage(){
  const [params]=useSearchParams(),initial=params.get('orderNo')??'';
  const [input,setInput]=useState(initial),[orderNo,setOrderNo]=useState(/^\d{1,19}$/.test(initial)?initial:''),[error,setError]=useState<string|null>(null);
  const query=useQuery({queryKey:['economic-lineage',orderNo],queryFn:({signal})=>get<{data:Lineage}>(`/admin/operations/economic-lineage/orders/${orderNo}`,{signal}),enabled:!!orderNo,retry:false});
  const data=!error&&!query.error&&!query.isFetching?query.data?.data:undefined,events=data?lineageEvents(data):[];
  return <><PageHeader title="交易影響追蹤" subtitle="依訂單查看認列、獎金、退貨重算與付款證據。此頁為唯讀。" actions={<Link to="/orders">返回訂單與收款</Link>}/>
    <Card><form onSubmit={event=>{event.preventDefault();const next=input.trim();if(!/^\d{1,19}$/.test(next)){setError('請輸入 1 至 19 位數字的訂單號。');return;}setError(null);if(next===orderNo)void query.refetch();else setOrderNo(next);}}><Field label="訂單號"><input inputMode="numeric" value={input} onChange={event=>setInput(event.target.value)} required pattern="[0-9]{1,19}"/></Field><button disabled={query.isFetching}>查詢交易影響</button></form></Card>
    <ErrorBox error={error||query.error}/>{query.isFetching&&<p role="status">正在讀取交易證據…</p>}{!orderNo&&<p>輸入訂單號開始查詢。</p>}
    {data&&<Card title={`訂單 ${data.order.orderNo}`}><p>狀態：{states[data.order.status]??'待確認'}。金額為各階段紀錄，請勿跨階段加總。</p>{!events.length?<p>目前沒有可追溯的經濟紀錄；不表示獎金為零。</p>:<ol className="lineage-timeline">{events.map(item=><li key={item.index}><article><header><h3>{item.title}</h3><span>{item.at?new Date(item.at).toLocaleString('zh-TW'):'未提供事件時間／目前狀態'}</span></header>{item.context&&<p>{item.context}</p>}<details><summary>查看計算與來源明細</summary><Evidence row={item.row}/></details></article></li>)}</ol>}</Card>}
  </>;
}
