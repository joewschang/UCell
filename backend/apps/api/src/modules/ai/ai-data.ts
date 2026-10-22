import {Injectable,ForbiddenException} from '@nestjs/common';
import {PrismaService,Prisma} from '@ucell/database';
import {Actor,Answer,Plan,period,unavailable} from './ai-contract';
import {readStructuredExplanation} from '../explain/structured-explain-source';
type Tx=Prisma.TransactionClient;
const stateLabels:Record<string,string>={DRAFT:'草稿',CONFIRMED:'待付款',PAID:'已付款',FULFILLED:'已履約',CANCELLED:'已取消',PARTIAL_RETURN:'部分退貨',RETURNED:'已退貨',EFFECTIVE:'有效',PENDING:'待處理',EXITED:'已退出',CLOSED:'已關閉',CALCULATED:'已計算',PENDING_45D:'待生效',PAYABLE:'可支付',REVERSED:'已沖銷',CLAWBACK:'待回收'};
const label=(s:string)=>stateLabels[s]??s;
@Injectable()
export class AiData{
 constructor(private readonly db:PrismaService){}
 async own(tx:Tx,actor:Actor,qid:string){
  const rows=await tx.$queryRaw<any[]>`SELECT h.effective_from AS "from" FROM membership.qualification_holder_history h JOIN membership.qualification q USING(qualification_id) WHERE h.qualification_id=${qid}::uuid AND h.holder_person_id=${actor.id}::uuid AND q.current_holder_person_id=${actor.id}::uuid AND q.current_holder_legal_entity_id IS NULL AND q.kind='MEMBER_ORIGIN' AND q.current_company_principal_id IS NULL AND NOT EXISTS(SELECT 1 FROM rules.system_assignment_pool_entry pool WHERE pool.qualification_id=q.qualification_id AND pool.enabled_from<=now() AND (pool.enabled_to IS NULL OR pool.enabled_to>now())) AND h.effective_from<=now() AND (h.effective_to IS NULL OR h.effective_to>now())`;
  if(rows.length!==1)throw new ForbiddenException({code:'AI_SCOPE_DENIED'});return rows[0].from as Date;
 }
 async execute(actor:Actor,plan:Plan,qid:string|null):Promise<Answer>{
  const now=new Date(),bounds=period(plan,now);const base=(title:string,text:string):Answer=>({status:'AVAILABLE',title,text,facts:[],sources:[],definitionVersion:'ai-stage-read-v1',updatedAt:now.toISOString(),period:{start:bounds.start.toISOString(),end:bounds.end.toISOString()},scope:actor.audience==='ADMIN'?'公司彙總':qid?'目前選取的本人資格':'本人',finality:'NOT_APPLICABLE'});
  if(plan.intent==='DENIED')return{...base('此問題超出可查詢範圍','AI 只提供授權資料，不能修改資格、付款或提供他人的個人資料。'),status:'DENIED'};
  if(plan.intent==='CLARIFY')return{...base('請選擇查詢項目','請選擇下方常用問題，或明確指定資料種類與期間。實收、GPV 與獎金的口徑不同。'),status:'CLARIFY'};
  return this.db.$transaction(async tx=>{
   let ownedFrom:Date|null=null;if(qid)ownedFrom=await this.own(tx,actor,qid);
   if(plan.intent==='FAQ'){
    const topic=plan.topic??'enrollment';
    const rows=await tx.$queryRaw<any[]>`SELECT id,title,body,version,source_ref FROM ai.knowledge_version WHERE topic=${topic} AND status='PUBLISHED' AND audience IN ('ALL',${actor.audience}) AND effective_from<=${now} AND effective_to>${now} ORDER BY version DESC LIMIT 2`;
    if(rows.length!==1)return unavailable('目前沒有可引用的核准說明','找不到唯一有效版本，請使用原功能頁或洽客服。');
    return{...base(rows[0].title,rows[0].body),sources:[{label:'核准知識 v'+rows[0].version,ref:rows[0].source_ref}],definitionVersion:'knowledge-'+rows[0].id};
   }
   if(actor.audience==='ADMIN'){
    if(plan.intent==='MEMBERSHIP_COUNTS'){
     if(plan.start||plan.end||plan.couponCode||plan.topic)return{...base('目前僅支援即時會員統計','請問「目前會員數與會員資格數」。歷史時點及條件篩選尚未開放。'),status:'CLARIFY'};
     const people=await tx.$queryRaw<any[]>`SELECT membership_state::text AS state,count(*)::text AS total,count(*) FILTER(WHERE status='EFFECTIVE')::text AS effective FROM identity.person WHERE membership_state IS NOT NULL GROUP BY membership_state ORDER BY membership_state`;
     const qualifications=await tx.$queryRaw<any[]>`SELECT q.status::text AS status,count(*)::text AS total,count(*) FILTER(WHERE q.current_holder_person_id IS NOT NULL AND q.current_holder_legal_entity_id IS NULL)::text AS personal,count(*) FILTER(WHERE q.current_holder_legal_entity_id IS NOT NULL AND q.current_holder_person_id IS NULL)::text AS corporate,count(*) FILTER(WHERE (q.current_holder_person_id IS NULL AND q.current_holder_legal_entity_id IS NULL) OR (q.current_holder_person_id IS NOT NULL AND q.current_holder_legal_entity_id IS NOT NULL))::text AS unresolved FROM membership.qualification q WHERE q.kind='MEMBER_ORIGIN' AND q.current_company_principal_id IS NULL AND NOT EXISTS(SELECT 1 FROM rules.system_assignment_pool_entry pool WHERE pool.qualification_id=q.qualification_id AND pool.enabled_from<=${now} AND (pool.enabled_to IS NULL OR pool.enabled_to>${now})) GROUP BY q.status ORDER BY q.status`;
     const total=(rows:any[],key:string)=>rows.reduce((s,r)=>s+BigInt(r[key]),0n).toString();
     const states:Record<string,string>={NETWORK_MEMBER:'網路會員',FORMAL_PENDING:'正式會員申請中',FORMAL_MEMBER:'正式會員'};
     const a=base('目前會員與資格統計','會員人數按自然人會員紀錄計算，一人只計一次；會員資格按資格紀錄計算，一人可持有多個資格。法人資格另列，不加進自然人人數。');
     delete a.period;a.definitionVersion='membership-counts-v1';
     a.facts=[{label:'已登錄自然人會員（所有狀態）',value:total(people,'total'),unit:'人'},{label:'有效自然人會員',value:total(people,'effective'),unit:'人'},...['NETWORK_MEMBER','FORMAL_PENDING','FORMAL_MEMBER'].map(state=>({label:'有效'+states[state],value:people.find(r=>r.state===state)?.effective??'0',unit:'人'})),{label:'會員來源資格（所有狀態）',value:total(qualifications,'total'),unit:'個'},{label:'有效會員來源資格',value:qualifications.find(r=>r.status==='EFFECTIVE')?.total??'0',unit:'個'}];
     a.columns=['資格狀態','資格總數','個人持有','法人持有','持有人待核對'];a.rows=qualifications.map(r=>[label(r.status),r.total,r.personal,r.corporate,r.unresolved]);
     a.sources=[{label:'會員狀態登錄',ref:'identity.person/membership_state'},{label:'會員來源資格與系統池排除',ref:'membership.qualification/rules.system_assignment_pool_entry'}];
     a.notice='僅為 Stage 測試資料，可能包含測試會員，不能視為正式站營運數字。未登錄會員狀態的人員不計入會員人數；公司建置資格、公司主體及目前系統池資格不計入。有效指紀錄狀態 EFFECTIVE，不代表當月符合領獎活躍條件。持有人待核對資格仍列入總數並單獨揭露。';a.exportable=true;return a;
    }
    if(!['SUMMARY','COUPON'].includes(plan.intent))return unavailable();
    if(plan.intent==='COUPON'&&!plan.couponCode)return{...base('請指定優惠碼','例如：UCELL888 本月付款成效。'),status:'CLARIFY'};
    let couponJoin=Prisma.empty;
    if(plan.intent==='COUPON'){
     const [schema]=await tx.$queryRaw<any[]>`SELECT to_regclass('commerce.coupon_redemption')::text AS name`;
     if(!schema?.name)return unavailable('Stage 尚無優惠碼資料來源','優惠碼資料表尚未導入此 Stage 版本；不會以正式站資料或示範數字代替。');
     couponJoin=Prisma.sql`JOIN commerce.coupon_redemption cr ON cr.order_id=o.order_id JOIN commerce.coupon_definition cd ON cd.id=cr.coupon_id AND cd.code=${plan.couponCode}`;
    }
    const rows=await tx.$queryRaw<any[]>(Prisma.sql`SELECT COALESCE(ps.package_code,'RETAIL') AS package,
      count(DISTINCT o.order_id)::text AS orders,count(DISTINCT o.purchaser_person_id)::text AS people,
      COALESCE(sum(pe.amount),0)::text AS receipts,
      count(*) FILTER(WHERE o.currency<>'TWD')::text AS foreign_currency,
      count(*) FILTER(WHERE pe.amount<>o.net_amount)::text AS partial_payment,
      COALESCE(sum(CASE WHEN ps.recognition_config_ref='PO_20261021_ENTRY_V2' AND pe.amount=o.net_amount THEN COALESCE((to_jsonb(ps)->>'qualification_fee')::numeric,0) ELSE 0 END),0)::text AS fees,
      count(*) FILTER(WHERE ps.package_purchase_snapshot_id IS NULL OR ps.package_class<>'QUALIFICATION' OR ps.recognition_config_ref IS DISTINCT FROM 'PO_20261021_ENTRY_V2')::text AS legacy
     FROM commerce.payment_event pe JOIN commerce."order" o ON o.order_id=pe.order_id ${couponJoin}
     LEFT JOIN commerce.package_purchase_snapshot ps ON ps.order_id=o.order_id
     WHERE pe.event_type='PAYMENT_CONFIRMED' AND pe.occurred_at>=${bounds.start} AND pe.occurred_at<${bounds.end} AND pe.recorded_at<=${now}
     GROUP BY COALESCE(ps.package_code,'RETAIL') ORDER BY package`);
    if(rows.some(r=>r.partial_payment!=='0'))return unavailable('付款資料需要核對','此版尚未支援分次付款分攤，請至訂單與收款核對。');
    if(rows.some(r=>r.foreign_currency!=='0'))return unavailable('此期間包含不同幣別','目前只提供單一 TWD 報表，不能合併不同幣別金額。');
    // Reject multiple payment events per order until split-payment allocation is governed.
    const dup=await tx.$queryRaw<any[]>(Prisma.sql`SELECT o.order_id FROM commerce.payment_event pe JOIN commerce."order" o ON o.order_id=pe.order_id ${couponJoin} WHERE pe.event_type='PAYMENT_CONFIRMED' AND pe.occurred_at>=${bounds.start} AND pe.occurred_at<${bounds.end} GROUP BY o.order_id HAVING count(*)>1 LIMIT 1`);
    if(dup.length)return unavailable('付款資料需要核對','此範圍包含同一訂單多筆付款確認；拆分口徑尚未驗證，不提供可能重複的總額。');
    const receipts=rows.reduce((s,r)=>s.add(r.receipts),new Prisma.Decimal(0)),fees=rows.reduce((s,r)=>s.add(r.fees),new Prisma.Decimal(0));
    const a=base(plan.intent==='COUPON'?`${plan.couponCode} 付款成效`:'本期付款營運摘要','以下依付款確認事件的發生日期統計。付款總額包含資格費；不是淨收入，也不是已認列 GPV。');
    a.facts=[{label:'付款入帳總額',value:receipts.toFixed(2),unit:'TWD'},{label:'已付款訂單',value:rows.reduce((s,r)=>s+Number(r.orders),0).toString(),unit:'筆'}];
    if(!rows.some(r=>r.legacy!=='0'))a.facts.push({label:'資格建立費',value:fees.toFixed(2),unit:'TWD'},{label:'扣除資格費後商品款',value:receipts.sub(fees).toFixed(2),unit:'TWD'});
    a.columns=['套組','付款訂單','付款入帳總額 TWD'];a.rows=rows.map(r=>[r.package,r.orders,new Prisma.Decimal(r.receipts).toFixed(2)]);
    a.sources=[{label:'付款確認與套組不可變快照',ref:'commerce.payment_event/PAYMENT_CONFIRMED'}];a.exportable=true;
    a.notice='退款現金完成證據尚未統一，此版不顯示退款或淨收款；退貨過帳不等於已退款。'+(rows.some(r=>r.legacy!=='0')?'此期間有尚未驗證拆分口徑的訂單，故不拆分資格費與商品款。':'');return a;
   }
   if(plan.intent==='QUALIFICATIONS'){
    const rows=await tx.$queryRaw<any[]>`SELECT q.qualification_id,q.ball_no,q.plan_level_code,q.status::text FROM membership.qualification q WHERE q.current_holder_person_id=${actor.id}::uuid AND q.current_holder_legal_entity_id IS NULL AND q.kind='MEMBER_ORIGIN' AND q.current_company_principal_id IS NULL AND NOT EXISTS(SELECT 1 FROM rules.system_assignment_pool_entry pool WHERE pool.qualification_id=q.qualification_id AND pool.enabled_from<=now() AND (pool.enabled_to IS NULL OR pool.enabled_to>now())) AND EXISTS(SELECT 1 FROM membership.qualification_holder_history h WHERE h.qualification_id=q.qualification_id AND h.holder_person_id=${actor.id}::uuid AND h.effective_from<=now() AND (h.effective_to IS NULL OR h.effective_to>now())) ORDER BY q.qualification_no LIMIT 51`;
    if(rows.length>50)return unavailable('資格資料超過單次上限','請在原資格清單查閱。');
    return{...base('我的會員資格',rows.length?'以下是目前持有且有持有證據的個人資格。':'目前沒有可顯示的正式會員資格。'),columns:['資格代碼','方案','狀態'],rows:rows.map(r=>[r.ball_no??'尚未編碼',r.plan_level_code??'待確認',label(r.status)]),sources:[{label:'資格與有效持有紀錄',ref:'membership.qualification_holder_history'}]};
   }
   if(plan.intent==='ORDERS'){
    const rows=await tx.$queryRaw<any[]>(Prisma.sql`SELECT o.order_no::text,o.status::text,o.net_amount::text,o.currency,o.created_at,ps.selectable_product_quantity,ps.price_amount::text,(to_jsonb(ps)->>'qualification_fee') AS fee FROM commerce."order" o LEFT JOIN commerce.package_purchase_snapshot ps ON ps.order_id=o.order_id WHERE o.purchaser_person_id=${actor.id}::uuid ${qid?Prisma.sql`AND o.qualification_id=${qid}::uuid`:Prisma.empty} AND o.created_at>=${bounds.start} AND o.created_at<${bounds.end} ORDER BY o.created_at DESC LIMIT 21`);
    return{...base('我的訂單',rows.length?'顯示最近 20 筆本人購買訂單；訂單狀態不代表物流即時狀態。':'此期間沒有符合條件的本人購買訂單。'),columns:['訂單','狀態','總額','幣別','商品需求'],rows:rows.slice(0,20).map(r=>[r.order_no,label(r.status),r.net_amount,r.currency,r.selectable_product_quantity===0?'0 盒，無需寄送商品':'請查看出貨明細']),notice:rows.length>20?'尚有更多訂單，請至訂單列表查看。':undefined,sources:[{label:'本人購買訂單',ref:'commerce.order/purchaser_person_id'}]};
   }
   if(!qid)return{...base('請先選擇會員資格','此問題需要目前持有的正式會員資格；仍可查詢個人訂單與常見問題。'),status:'CLARIFY'};
   if(ownedFrom&&bounds.start<ownedFrom&&plan.intent!=='ACTIVE')return unavailable('此期間跨越資格持有邊界','請將起始日期改為你取得此資格之後。此版不提供轉移前的歷史資料。');
   if(plan.intent==='ACTIVE'||plan.intent==='PERFORMANCE'){
    const at=plan.intent==='ACTIVE'?new Date(Math.min(bounds.end.getTime(),now.getTime())-1):now;
    if(ownedFrom&&at<ownedFrom)return unavailable('無法查詢取得資格前的狀態');
    let evidence:any;try{evidence=await readStructuredExplanation(tx,plan.intent==='ACTIVE'?'explainActive':'explainPerformance',{qualificationId:qid,time:{periodStart:bounds.start.toISOString(),periodEnd:bounds.end.toISOString(),asOf:at.toISOString(),knowledgeCutoff:now.toISOString(),timezone:'Asia/Taipei'}} as any);}catch(error:any){if(['HISTORICAL_UNAVAILABLE','INVALID_EVIDENCE'].includes(error.code))return unavailable();throw error;}
    if(evidence.status!=='AVAILABLE')return unavailable();
    const a=base(plan.intent==='ACTIVE'?'我的活躍資格':'已認列個人業績',plan.intent==='ACTIVE'?(evidence.result.active?'依系統證據，查詢時點符合活躍資格。':'依系統證據，查詢時點尚未符合活躍資格。'):'以下是已認列證據中的業績；不是套組付款估算。600 元資格費不列入新資格商品 GPV。');
    a.facts=plan.intent==='ACTIVE'?[{label:'活躍資格',value:evidence.result.active?'符合':'尚未符合'}]:['gpv','rpv','epv'].map(k=>({label:k.toUpperCase(),value:evidence.result[k],unit:k.toUpperCase()}));a.sources=[{label:'規則 '+evidence.ruleVersion,ref:evidence.evidenceRefs.map((x:any)=>x.type+':'+x.id).join(';')}];a.finality=evidence.finality;a.updatedAt=evidence.updatedAt;return a;
   }
   if(plan.intent==='BONUS'){
    const rows=await tx.$queryRaw<any[]>`SELECT b.award_type::text,b.payable_amount::text,b.rule_version_code,s.status::text AS settlement_status,l.status::text AS lifecycle FROM ledger.bonus_award b LEFT JOIN ledger.settlement_batch s USING(settlement_batch_id) LEFT JOIN LATERAL(SELECT status FROM ledger.bonus_award_lifecycle_event WHERE bonus_award_id=b.bonus_award_id ORDER BY occurred_at DESC,created_at DESC LIMIT 1) l ON true WHERE b.recipient_qualification_id=${qid}::uuid AND b.occurred_at>=${bounds.start} AND b.occurred_at<${bounds.end} ORDER BY b.occurred_at DESC LIMIT 21`;
    if(!rows.length)return unavailable('本期獎金尚無可顯示證據','尚無已保存的獎金結果；不代表獎金金額為零。');
    return{...base('我的獎金狀態','顯示最近 20 筆獎金生命週期。已核定金額不等於實際匯款，回收與付款請至獎金明細確認。'),columns:['獎金類型','狀態','核定金額','規則'],rows:rows.slice(0,20).map(r=>[r.award_type,label(r.lifecycle??'PENDING'),r.settlement_status==='FINALIZED'?r.payable_amount:'尚未核定',r.rule_version_code]),sources:[{label:'獎金及生命週期證據',ref:'ledger.bonus_award'}],notice:rows.length>20?'清單已截斷，請回原頁查閱完整資料。':undefined};
   }
   return unavailable();
  },{isolationLevel:'RepeatableRead',maxWait:1000,timeout:5000});
 }
}
