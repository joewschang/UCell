import {Prisma,snapshotDecimal,verifyReplayEnvelope,verifySnapshot} from '@ucell/database';

const levels=['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN'];
type OwnedQualification={qualificationId:string;qualificationNo:bigint;globalRankHistory:{rankCode:string}[]};
const unavailableReason='尚無可驗證的本人原結算進度；不以目前資料推算歷史成果。';

/** Read only the authenticated owner's sealed original period facts, never other recipients or live economic estimates. */
export async function memberGrowthRankProgress(tx:Prisma.TransactionClient,owned:OwnedQualification[],now:Date){
 const targets=owned.map(q=>({q,next:levels[Math.max(-1,...q.globalRankHistory.map(r=>levels.indexOf(r.rankCode)))+1]??null}));
 const unavailable=(q:OwnedQualification,next:string|null)=>({qualificationNo:q.qualificationNo.toString(),status:next?'UNAVAILABLE':'HIGHEST_ACHIEVED',rankCode:next,periodStart:null as string|null,periodEnd:null as string|null,weakSidePv:null as string|null,thresholdPv:null as string|null,remainingPv:null as string|null,progressPercent:null as string|null,activeAtClose:null as boolean|null});
 let items=targets.map(({q,next})=>unavailable(q,next));
 if(targets.some(row=>row.next)){
  const latest=await tx.globalPoolSettlement.findMany({where:{periodEnd:{lte:now}},orderBy:[{periodEnd:'desc'},{globalPoolSettlementId:'asc'}],take:2});
  const source=latest[0];
  // Equal latest end dates with multiple rule/period identities are ambiguous; never select an arbitrary rule.
  if(source&&(!latest[1]||latest[1].periodEnd.getTime()!==source.periodEnd.getTime())){
   const stored=await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'GLOBAL',sourceId:source.globalPoolSettlementId}}});
   try{
    const envelope=verifyReplayEnvelope(stored),parameters=verifySnapshot(source.parameterSnapshot);
    if(envelope.kind!=='GLOBAL'||envelope.sourceId!==source.globalPoolSettlementId||envelope.ruleVersionCode!==source.ruleVersionCode||envelope.parameters.hash!==parameters.hash||envelope.at!==source.periodEnd.toISOString()||envelope.inputs.periodStart!==source.periodStart.toISOString()||envelope.inputs.periodEnd!==source.periodEnd.toISOString())throw new Error('GROWTH_RANK_SOURCE_MISMATCH');
    const decisions=envelope.evidence.globalEligibilityDecisions;
    if(!Array.isArray(decisions))throw new Error('GROWTH_RANK_EVIDENCE_MISSING');
    items=targets.map(({q,next})=>{
     const empty=unavailable(q,next);if(!next)return empty;
     const rows=decisions.filter((row:any)=>row?.qualificationId===q.qualificationId&&row.rankLevel===next);
     if(rows.length!==1)return empty;
     const row=rows[0],threshold=snapshotDecimal(parameters,'global.rank.weak_threshold',next),weak=new Prisma.Decimal(row.weakSidePv),recorded=new Prisma.Decimal(row.threshold);
     if(!threshold.isFinite()||!threshold.gt(0)||!weak.isFinite()||weak.isNegative()||!recorded.eq(threshold)||typeof row.active!=='boolean'||row.rankAchieved!==false||row.eligible!==false||row.reasonCode!==(row.active?'WEAK_SIDE_BELOW_THRESHOLD':'INACTIVE')||weak.gte(threshold))return empty;
     return {...empty,status:'RECORDED',periodStart:source.periodStart.toISOString(),periodEnd:source.periodEnd.toISOString(),weakSidePv:weak.toFixed(4),thresholdPv:threshold.toFixed(4),remainingPv:threshold.sub(weak).toFixed(4),progressPercent:weak.mul(100).div(threshold).toFixed(2,Prisma.Decimal.ROUND_DOWN),activeAtClose:row.active};
    });
   }catch{
    // Invalid/missing seals fail closed for this dimension; no raw error or fallback to an older period is shown.
    items=targets.map(({q,next})=>unavailable(q,next));
   }
  }
 }
 const recorded=items.some(row=>row.status==='RECORDED'),highest=items.length>0&&items.every(row=>row.status==='HIGHEST_ACHIEVED');
 return {status:recorded?'RECORDED':highest?'HIGHEST_ACHIEVED':'UNAVAILABLE',basis:'ORIGINAL_CLOSED_PERIOD',reason:recorded?'依最近一次可驗證原結算的本人弱邊 PV 與該期核准門檻呈現；不是本期即時進度、退貨更正後餘額或可領金額。':highest?'目前持有的資格皆已有最高階級紀錄。':unavailableReason,items};
}
