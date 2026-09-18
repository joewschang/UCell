import { AnalyticsQuery, parseAnalyticsQuery, parseAsOfContext, strictObject, UCellRequestContext } from './contracts';
import { createExplainGateway, ExplainPorts } from './explain';
import { KnowledgeDocument, KnowledgeUnit, lookupGovernedKnowledge } from './knowledge';
import { ReadContractError } from './read-gateway';
export interface FoundationSimulatorPorts extends ExplainPorts {
  /** Supplied by a governed local registry, never from a prompt or client request. */
  knowledgeDocuments: readonly KnowledgeDocument[];
  knowledgeUnits: readonly KnowledgeUnit[];
  authorizeMetric(context:UCellRequestContext,query:AnalyticsQuery):Promise<boolean>;
  auditAuxiliary(event:{tool:'queryMetric'|'lookupKnowledge';correlationId:string;outcome:string}):Promise<void>;
}
/** A bounded, provider-free integration simulator. Analytics execution remains deliberately unavailable until a registered source adapter exists. */
export function createFoundationSimulator(ports:FoundationSimulatorPorts){
 const explain=createExplainGateway(ports);
 return async(name:unknown,input:unknown):Promise<unknown>=>{
  if(name!=='queryMetric' && name!=='lookupKnowledge') return explain(name,input);
  const tool=name;
  let context:UCellRequestContext;
  try {context=structuredClone(await ports.resolveContext());} catch {throw new ReadContractError('DENIED');}
  try {
   let result:unknown;
   let parsed:AnalyticsQuery|undefined;
   if(tool==='queryMetric') {
    parsed=parseAnalyticsQuery(input,context);
    if(!await ports.authorizeMetric(context,parsed)) throw new ReadContractError('DENIED');
    result={status:'UNAVAILABLE',quality:'UNAVAILABLE',result:null,explainCode:'SOURCE_UNAVAILABLE',metrics:parsed.metrics,time:parsed.time,evidenceRefs:[],canonicalDeepLink:null};
   } else {
    const q=strictObject(input,['topic','time','locale']),time=parseAsOfContext(q.time);
    result=lookupGovernedKnowledge(ports.knowledgeDocuments,ports.knowledgeUnits,
      {topic:q.topic as string,effectiveAt:time.asOf,knowledgeCutoff:time.knowledgeCutoff,locale:q.locale as 'zh-TW'|'en'},context);
   }
   const current=await ports.resolveContext();
   if(JSON.stringify(current)!==JSON.stringify(context)) throw new ReadContractError('CONTEXT_CHANGED');
   if(parsed && !await ports.authorizeMetric(current,parsed)) throw new ReadContractError('DENIED');
   await ports.auditAuxiliary({tool,correlationId:context.correlationId,outcome:'READ'});
   return result;
  } catch(error) {
   const code=error instanceof ReadContractError?error.code:'SOURCE_UNAVAILABLE';
   try {await ports.auditAuxiliary({tool,correlationId:context.correlationId,outcome:code});} catch {throw new ReadContractError('SOURCE_UNAVAILABLE');}
   throw new ReadContractError(code);
  }
 };
}
