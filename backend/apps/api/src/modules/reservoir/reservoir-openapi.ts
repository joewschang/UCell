import {periodEnvelope} from '../analytics/period-openapi';
const text={type:'string'},uuid={type:'string',format:'uuid'},date={type:'string',format:'date-time'},decimal={type:'string',pattern:'^-?[0-9]+(?:\\.[0-9]+)?$'};
export const RESERVOIR_RESPONSE=periodEnvelope({type:'object',required:['kind','time','filters','status','sourceEvidence','definitionVersion','dataThrough','dataClassification','flowPolicy','unit','snapshotToken','snapshotExpiresAt','items','total','cumulative','periodInflow','nextCursor','lastUpdated'],properties:{
 kind:{type:'string',enum:['A','B']},status:{type:'string',enum:['CURRENT','STALE']},
 time:{type:'object',required:['timezone','asOf','knowledgeCutoff','periodStart','periodEnd'],properties:{timezone:{type:'string',enum:['Asia/Taipei']},asOf:date,knowledgeCutoff:date,periodStart:date,periodEnd:date}},
 filters:{type:'object',properties:{tree:uuid,position:{type:'integer',minimum:1,maximum:3},awardType:text}},
 sourceEvidence:{type:'object',required:['status','pendingReturns','pendingReplays'],properties:{status:{type:'string',enum:['CURRENT','STALE']},pendingReturns:{type:'string',pattern:'^[0-9]+$'},pendingReplays:{type:'string',pattern:'^[0-9]+$'}}},
 definitionVersion:text,dataThrough:date,lastUpdated:{...date,nullable:true},dataClassification:{type:'string',enum:['FINANCE_CONFIDENTIAL']},flowPolicy:{type:'string',enum:['INFLOW_ONLY']},unit:{type:'string',enum:['TWD']},
 snapshotToken:uuid,snapshotExpiresAt:date,nextCursor:{...uuid,nullable:true},total:{type:'integer',minimum:0},cumulative:decimal,periodInflow:decimal,
 items:{type:'array',maxItems:100,items:{type:'object',required:['id','effectType','amount','recordedAt','settlement','periodStart','periodEnd','ruleVersion','snapshotHash'],properties:{
  id:uuid,effectType:text,amount:decimal,recordedAt:date,settlement:{...uuid,nullable:true},periodStart:date,periodEnd:date,ruleVersion:text,snapshotHash:text,
  tree:uuid,position:{type:'integer',minimum:1,maximum:3,nullable:true},qualificationId:uuid,awardType:{type:'string',enum:['REFERRAL','EQUALIZATION','BINARY','MATCHING','EPV','RPV','GLOBAL']},parameterVersion:text,replayPostingId:{...uuid,nullable:true}
 }}}
}});
