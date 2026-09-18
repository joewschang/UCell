// HTTP response schemas include the production data/meta envelope.
const text={type:'string'},uuid={type:'string',format:'uuid'},date={type:'string',format:'date-time'},nullableDate={...date,nullable:true};
export const PERIOD_ERROR_SCHEMA={type:'object',required:['code','message','request_id','timestamp'],properties:{code:text,message:{oneOf:[text,{type:'array',items:text}]},details:{nullable:true},request_id:text,timestamp:date}};
export const periodEnvelope=(data:any)=>({type:'object',required:['data','meta'],properties:{data,meta:{type:'object',required:['request_id','timestamp','api_version'],properties:{request_id:text,timestamp:date,api_version:{type:'string',enum:['v1']}}}}});
export const periodJobAccepted=(id:string)=>periodEnvelope({type:'object',required:[id,'status','replayed'],properties:{[id]:uuid,status:{type:'string',enum:['REQUESTED','RUNNING','COMPLETED','FAILED','EXPIRED']},replayed:{type:'boolean'}}});
export const PERIOD_JOB_STATUS=periodEnvelope({type:'object',required:['job_id','status','mode','query','result','failure_code','requested_at','started_at','completed_at'],properties:{
 job_id:uuid,status:{type:'string',enum:['REQUESTED','RUNNING','COMPLETED','FAILED']},mode:{type:'string',enum:['DRY_RUN','REBUILD','RECONCILE']},query:{type:'object'},requested_at:date,started_at:nullableDate,completed_at:nullableDate,failure_code:{...text,nullable:true},
 result:{type:'object',nullable:true,properties:{mode:text,generation:{...uuid,nullable:true},sourceHash:text,previousGeneration:{...uuid,nullable:true},reconciles:{type:'boolean',nullable:true},rowCount:{type:'integer'},status:{type:'string',enum:['CURRENT','STALE']},manifest:{type:'object'}}}
}});
export const PERIOD_EXPORT_STATUS=periodEnvelope({type:'object',required:['export_id','status','snapshot','query','requested_at','generated_at','expires_at','data_through','definition_version','row_count','chunk_count','content_hash','failure_code'],properties:{
 export_id:uuid,status:{type:'string',enum:['REQUESTED','RUNNING','COMPLETED','FAILED','EXPIRED']},snapshot:uuid,query:{type:'object'},requested_at:date,generated_at:nullableDate,expires_at:date,data_through:date,definition_version:text,
 row_count:{type:'integer',nullable:true},chunk_count:{type:'integer',nullable:true},content_hash:{...text,nullable:true},failure_code:{...text,nullable:true}
}});
export const PERIOD_QUERY_RESPONSE=periodEnvelope({type:'object',required:['status','projectionStatus','snapshot','nextCursor','dataThrough','definitionVersion','result','time'],properties:{
 status:{type:'string',enum:['AVAILABLE','PARTIAL','UNAVAILABLE']},projectionStatus:{type:'string',enum:['CURRENT','UPDATING','REBUILDING','STALE','FAILED']},
 snapshot:{...uuid,nullable:true},nextCursor:{...text,nullable:true},dataThrough:nullableDate,definitionVersion:text,projectionVersion:text,
 time:{type:'object'},scope:{type:'object',additionalProperties:text},isLatestGeneration:{type:'boolean'},updatedAt:date,metricKey:text,total:{type:'integer',minimum:0},
 finality:{type:'string',enum:['NOT_APPLICABLE']},quality:{type:'string',enum:['VERIFIED','PARTIAL','UNAVAILABLE']},
 ruleVersion:{...text,nullable:true},parameterVersion:{...text,nullable:true},versionReason:text,dataClassification:{type:'string',enum:['FINANCE_CONFIDENTIAL']},
 evidenceRefs:{type:'array',items:{type:'object',required:['type','id','revision'],properties:{type:text,id:text,revision:text}}},explainCode:text,canonicalDeepLink:{...text,nullable:true},manifest:{type:'object'},
 result:{type:'array',nullable:true,maxItems:100,items:{type:'object',required:['key','dimensions','measures','evidence'],properties:{key:text,dimensions:{type:'object',additionalProperties:text},measures:{type:'object',additionalProperties:{oneOf:[{type:'string',nullable:true},{type:'number'}]}},evidence:{type:'object'}}}}
}});
