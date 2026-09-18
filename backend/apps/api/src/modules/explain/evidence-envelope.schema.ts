const instant={type:'string',format:'date-time'};
const decimal={type:'string',pattern:'^-?(0|[1-9][0-9]{0,17})(\\.[0-9]{1,8})?$'};
const id={type:'string',maxLength:128};
export const structuredEnvelopeSchema={type:'object',additionalProperties:false,
 required:['status','quality','finality','scope','time','updatedAt','dataThrough','metricKey','definitionVersion','ruleVersion','parameterVersion','evidenceRefs','explainCode','canonicalDeepLink','dataClassification','result'],
 properties:{
  status:{type:'string',enum:['AVAILABLE','PARTIAL','UNAVAILABLE']},quality:{type:'string',enum:['VERIFIED','PARTIAL','UNAVAILABLE']},
  finality:{type:'string',enum:['FINALIZED','PAID','NOT_APPLICABLE']},
  scope:{type:'object',additionalProperties:false,properties:{qualificationId:id,binaryTreeId:id,resourceId:id}},
  time:{type:'object',additionalProperties:false,required:['timezone','asOf','periodStart','periodEnd','knowledgeCutoff'],properties:{timezone:{type:'string',enum:['Asia/Taipei']},asOf:instant,periodStart:instant,periodEnd:instant,knowledgeCutoff:instant,ruleVersion:id,settlementId:id}},
  updatedAt:{...instant,nullable:true},dataThrough:{...instant,nullable:true},metricKey:id,definitionVersion:{type:'string',enum:['1']},
  ruleVersion:{...id,nullable:true},parameterVersion:{...id,nullable:true},
  evidenceRefs:{type:'array',maxItems:100,items:{type:'object',additionalProperties:false,required:['type','id','revision'],properties:{type:id,id,revision:id}}},
  explainCode:{type:'string',enum:['VERIFIED_SOURCE','PARTIAL_EVIDENCE','SOURCE_UNAVAILABLE','NOT_ACTIVATED']},
  canonicalDeepLink:{type:'string',nullable:true,description:'Null while no authorized deployed canonical page is registered.'},
  dataClassification:{type:'string',enum:['MEMBER_SELF','ADMIN_OPERATIONAL','FINANCE_CONFIDENTIAL']},
  result:{type:'object',nullable:true,additionalProperties:false,description:'Tool-specific projection of persisted facts; UNAVAILABLE has null result. Return PARTIAL has replayStatus UNAVAILABLE.',properties:{
   active:{type:'boolean'},ownerType:{type:'string',enum:['MEMBER','COMPANY']},reasonCode:id,gpv:decimal,rpv:decimal,epv:decimal,
   pairPV:decimal,leftCarry:decimal,rightCarry:decimal,theory:decimal,k:decimal,final:decimal,awardType:id,settlementType:id,status:id,
   amount:decimal,postedAmount:decimal,replayStatus:id,kind:{type:'string',enum:['ACCRUAL','CORRECTION']},
  }},
 },
};
