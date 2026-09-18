import { AsOfContext, EvidenceEnvelope, UCellRequestContext, contractFail, isId, isInstant, isObject, parseAsOfContext, strictObject } from './contracts';
import { ReadContractError } from './read-gateway';

export interface ExplainActive { active: boolean; ownerType: 'MEMBER' | 'COMPANY'; reasonCode: string; }
export interface ExplainPerformance { gpv: string; rpv: string; epv: string; }
export interface ExplainBinaryPairCarry { pairPV: string; leftCarry: string; rightCarry: string; }
export interface ExplainAward { theory: string; k: string; final: string; awardType: string; }
export interface ExplainSettlement { settlementType: string; status: string; }
export interface ExplainPayout { amount: string; status: string; }
export interface ExplainReturnImpact { postedAmount: string; replayStatus: string; }
export interface ExplainReservoir { amount: string; kind: 'ACCRUAL' | 'CORRECTION'; }
export interface ExplainPayloads {
  getActiveStatus: ExplainActive; explainActive: ExplainActive; explainPerformance: ExplainPerformance;
  explainBinaryCarry: ExplainBinaryPairCarry; explainAward: ExplainAward; explainSettlement: ExplainSettlement;
  explainPayout: ExplainPayout; explainReturnImpact: ExplainReturnImpact; explainReservoirA: ExplainReservoir;
  explainReservoirB: ExplainReservoir & {theory:string;k:string;final:string;awardType:string;companyBall:string;profile:string;tree:string;position:string;economicDestination:'RESERVOIR_B';sourceRecognition:string;settlement:string;snapshotHash:string}; getTreeStats: { descendantCount: string; monthlyNewBalls: string };
}
export type ExplainTool = keyof ExplainPayloads;
const specs = Object.freeze({
  getActiveStatus: { permission: 'explain:active:read', metric: 'active.member', fields: ['active','ownerType','reasonCode'], financial: false },
  explainActive: { permission: 'explain:active:read', metric: 'active.member', fields: ['active','ownerType','reasonCode'], financial: false },
  explainPerformance: { permission: 'explain:performance:read', metric: 'volume.concrete', fields: ['gpv','rpv','epv'], financial: false },
  explainBinaryCarry: { permission: 'explain:binary:read', metric: 'binary.pair_carry', fields: ['pairPV','leftCarry','rightCarry'], financial: false },
  explainAward: { permission: 'explain:award:read', metric: 'award.stored', fields: ['theory','k','final','awardType'], financial: false },
  explainSettlement: { permission: 'explain:settlement:read', metric: 'settlement.status', fields: ['settlementType','status'], financial: false },
  explainPayout: { permission: 'explain:payout:read', metric: 'payout.status', fields: ['amount','status'], financial: false },
  explainReturnImpact: { permission: 'explain:return:read', metric: 'return.impact', fields: ['postedAmount','replayStatus'], financial: false },
  explainReservoirA: { permission: 'explain:reservoir-a:read', metric: 'reservoir.a', fields: ['amount','kind'], financial: true },
  explainReservoirB: { permission: 'explain:reservoir-b:read', metric: 'reservoir.b', fields: ['amount','kind'], financial: true },
  getTreeStats: { permission: 'tree:stats:read', metric: 'tree.stats', fields: ['descendantCount','monthlyNewBalls'], financial: true },
} as const);
export const EXPLAIN_TOOL_NAMES = Object.freeze(Object.keys(specs) as ExplainTool[]);
export interface ExplainQuery { qualificationId?: string; binaryTreeId?: string; resourceId?: string; time: AsOfContext; }
export interface ExplainPorts {
  activatedTools?:readonly ExplainTool[];
  resolveContext(): Promise<UCellRequestContext>;
  /** Real server ownership, role and resource checks are mandatory; never supplied by a client. */
  authorize(context: UCellRequestContext, tool: ExplainTool, query: Readonly<ExplainQuery>): Promise<boolean>;
  read(tool: ExplainTool, query: Readonly<ExplainQuery>, context: UCellRequestContext, signal: AbortSignal): Promise<unknown>;
  audit(event: { tool: ExplainTool; correlationId: string; outcome: string }): Promise<void>;
}
function query(raw: unknown): Readonly<ExplainQuery> {
  const v = strictObject(raw, ['qualificationId','binaryTreeId','resourceId','time']);
  if (['qualificationId','binaryTreeId','resourceId'].some(k => v[k] !== undefined && !isId(v[k]))) return contractFail('INVALID_QUERY');
  return Object.freeze({ ...(v.qualificationId ? {qualificationId:v.qualificationId as string} : {}),
    ...(v.binaryTreeId ? {binaryTreeId:v.binaryTreeId as string} : {}), ...(v.resourceId ? {resourceId:v.resourceId as string} : {}), time: parseAsOfContext(v.time) });
}
function contextCopy(v: UCellRequestContext): UCellRequestContext {
  if (!v || !isId(v.actorId) || !isId(v.contextVersion) || !isId(v.correlationId) || !['MEMBER','ADMIN'].includes(v.actorType)
    || !['zh-TW','en'].includes(v.locale) || v.timezone !== 'Asia/Taipei' || !Array.isArray(v.roles) || !Array.isArray(v.permissions) || !Array.isArray(v.scopes)
    || [...v.roles,...v.permissions,...v.scopes].some(x => !isId(x))
    || [v.personId,v.selectedQualificationId,v.binaryTreeId].some(x => x !== undefined && !isId(x))) return contractFail('DENIED');
  return Object.freeze({ actorId:v.actorId,actorType:v.actorType,personId:v.personId,selectedQualificationId:v.selectedQualificationId,
    binaryTreeId:v.binaryTreeId,contextVersion:v.contextVersion,correlationId:v.correlationId,locale:v.locale,timezone:v.timezone,
    roles:Object.freeze([...v.roles].sort()), permissions:Object.freeze([...v.permissions].sort()), scopes:Object.freeze([...v.scopes].sort()) });
}
function access(ctx: UCellRequestContext, tool: ExplainTool, q: ExplainQuery) {
  if (!ctx.permissions.includes(specs[tool].permission)) return contractFail('DENIED');
  if (ctx.actorType === 'MEMBER' && (specs[tool].financial || !ctx.personId || !ctx.selectedQualificationId
    || q.qualificationId !== ctx.selectedQualificationId || q.binaryTreeId !== ctx.binaryTreeId)) return contractFail('DENIED');
  if (tool === 'getTreeStats' && !q.binaryTreeId) return contractFail('INVALID_QUERY');
  if (['explainAward','explainSettlement','explainPayout','explainReturnImpact','explainReservoirA','explainReservoirB'].includes(tool) && !q.resourceId) return contractFail('INVALID_QUERY');
  if (!specs[tool].financial && !q.qualificationId) return contractFail('INVALID_QUERY');
}
const decimal = (v: unknown) => typeof v === 'string' && /^-?(0|[1-9]\d{0,17})(\.\d{1,8})?$/.test(v);
function payload(tool: ExplainTool, raw: unknown): ExplainPayloads[ExplainTool] {
  if (!isObject(raw)) return contractFail('INVALID_EVIDENCE');
  const fields: readonly string[] = specs[tool].fields;
  const values: Record<string,unknown> = {};
  for (const key of fields) {
    const value = raw[key];
    if (key === 'active' ? typeof value !== 'boolean' : ['ownerType','reasonCode','awardType','settlementType','status','replayStatus','kind'].includes(key)
      ? !isId(value) : !decimal(value)) return contractFail('INVALID_EVIDENCE');
    values[key] = value;
  }
  if (tool === 'getActiveStatus' || tool === 'explainActive') {
    if (!['MEMBER','COMPANY'].includes(raw.ownerType as string)
      || !['THRESHOLD_MET','BELOW_THRESHOLD','NOT_EFFECTIVE','COMPANY_RULE'].includes(raw.reasonCode as string)
      || (raw.ownerType === 'COMPANY' ? raw.active !== true || raw.reasonCode !== 'COMPANY_RULE'
        : raw.reasonCode === 'COMPANY_RULE' || raw.active !== (raw.reasonCode === 'THRESHOLD_MET'))) return contractFail('INVALID_EVIDENCE');
  }
  if (tool === 'explainAward' && !['REFERRAL','EQUALIZATION','BINARY','MATCHING','RPV','EPV','GLOBAL'].includes(raw.awardType as string)) return contractFail('INVALID_EVIDENCE');
  if (tool === 'explainSettlement' && (!['REFERRAL_K0','BINARY_K1','MATCHING_K2'].includes(raw.settlementType as string) || raw.status !== 'FINALIZED')) return contractFail('INVALID_EVIDENCE');
  if (tool === 'explainPayout' && raw.status !== 'PAID') return contractFail('INVALID_EVIDENCE');
  if (tool === 'explainBinaryCarry' && fields.some(k => (raw[k] as string).startsWith('-'))) return contractFail('INVALID_EVIDENCE');
  if (tool === 'getTreeStats' && fields.some(k => !/^(0|[1-9]\d*)$/.test(raw[k] as string))) return contractFail('INVALID_EVIDENCE');
  if (tool.startsWith('explainReservoir') && (!['ACCRUAL','CORRECTION'].includes(raw.kind as string) || (raw.kind === 'ACCRUAL' && (raw.amount as string).startsWith('-')))) return contractFail('INVALID_EVIDENCE');
  if(tool==='explainReservoirB'){
    for(const key of ['theory','k','final']){if(!decimal(raw[key])&&!(key!=='final'&&raw[key]==='NOT_APPLICABLE'))return contractFail('INVALID_EVIDENCE');values[key]=raw[key];}
    for(const key of ['awardType','companyBall','profile','tree','position','economicDestination','sourceRecognition','settlement','snapshotHash']){
      if(!isId(raw[key]))return contractFail('INVALID_EVIDENCE');values[key]=raw[key];
    }
    if(raw.economicDestination!=='RESERVOIR_B'||!['1','2','3','MEMBER_ORIGIN'].includes(raw.position as string)||!/^[a-f0-9]{64}$/.test(raw.snapshotHash as string))return contractFail('INVALID_EVIDENCE');
  }
  return Object.freeze(values) as unknown as ExplainPayloads[ExplainTool];
}
function unavailable(tool: ExplainTool, q: ExplainQuery, ctx: UCellRequestContext, activated = true): EvidenceEnvelope<never> {
  return { result:null,status:'UNAVAILABLE',finality:'NOT_APPLICABLE',quality:'UNAVAILABLE',scope:{qualificationId:q.qualificationId,binaryTreeId:q.binaryTreeId,resourceId:q.resourceId},
    time:q.time,updatedAt:null,dataThrough:null,metricKey:specs[tool].metric,definitionVersion:'1',ruleVersion:null,parameterVersion:null,
    evidenceRefs:[],explainCode:activated?'SOURCE_UNAVAILABLE':'NOT_ACTIVATED',canonicalDeepLink:null,
    dataClassification:specs[tool].financial?'FINANCE_CONFIDENTIAL':ctx.actorType==='MEMBER'?'MEMBER_SELF':'ADMIN_OPERATIONAL' };
}
function project(tool: ExplainTool, raw: unknown, q: ExplainQuery, ctx: UCellRequestContext): EvidenceEnvelope<ExplainPayloads[ExplainTool]> {
  if (!isObject(raw)) return contractFail('INVALID_EVIDENCE');
  if (raw.status === 'UNAVAILABLE' && raw.result === null) return unavailable(tool,q,ctx);
  if (raw.status !== 'AVAILABLE' || !isObject(raw.scope) || !isObject(raw.time)
    || !['FINALIZED','PAID','NOT_APPLICABLE'].includes(raw.finality as string)
    || !isInstant(raw.updatedAt) || raw.updatedAt > q.time.knowledgeCutoff || !isInstant(raw.dataThrough) || raw.dataThrough > q.time.asOf
    || !isId(raw.ruleVersion) || !isId(raw.parameterVersion) || !Array.isArray(raw.evidenceRefs)
    || raw.evidenceRefs.length < 1 || raw.evidenceRefs.length > 100) return contractFail('INVALID_EVIDENCE');
  for (const key of ['qualificationId','binaryTreeId','resourceId'] as const) if (raw.scope[key] !== q[key]) return contractFail('INVALID_EVIDENCE');
  if (JSON.stringify(parseAsOfContext(raw.time)) !== JSON.stringify(q.time)) return contractFail('HISTORICAL_UNAVAILABLE');
  if (q.time.ruleVersion && raw.ruleVersion !== q.time.ruleVersion) return contractFail('INVALID_EVIDENCE');
  if (['explainAward','explainBinaryCarry','explainReservoirA'].includes(tool) && raw.finality !== 'FINALIZED') return contractFail('INVALID_EVIDENCE');
  const refs = raw.evidenceRefs.map(ref => { if (!isObject(ref) || !isId(ref.type) || !isId(ref.id) || !isId(ref.revision)) return contractFail('INVALID_EVIDENCE'); return {type:ref.type,id:ref.id,revision:ref.revision}; });
  const partial = tool === 'explainReturnImpact' && raw.quality === 'PARTIAL' && isObject(raw.result) && raw.result.replayStatus === 'UNAVAILABLE';
  if ((raw.quality !== undefined && raw.quality !== 'VERIFIED' && !partial)
    || (tool === 'explainReturnImpact' && isObject(raw.result) && raw.result.replayStatus === 'UNAVAILABLE' && !partial)) return contractFail('INVALID_EVIDENCE');
  return {...unavailable(tool,q,ctx),result:payload(tool,raw.result),status:partial?'PARTIAL':'AVAILABLE',quality:partial?'PARTIAL':'VERIFIED',
    finality:raw.finality as 'FINALIZED'|'PAID'|'NOT_APPLICABLE',updatedAt:raw.updatedAt,dataThrough:raw.dataThrough,
    ruleVersion:raw.ruleVersion,parameterVersion:raw.parameterVersion,evidenceRefs:refs,explainCode:partial?'PARTIAL_EVIDENCE':'VERIFIED_SOURCE'};
}
/** Provider-free backend integration seam. No queries, calculation or mutation privileges are created here. */
export function createExplainGateway(ports: ExplainPorts) {
  return async (name: unknown, rawQuery: unknown): Promise<EvidenceEnvelope<ExplainPayloads[ExplainTool]>> => {
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(specs,name)) return contractFail('INVALID_QUERY');
    const tool = name as ExplainTool, q = query(rawQuery);
    let ctx: UCellRequestContext;
    try { ctx = contextCopy(await ports.resolveContext()); } catch { throw new ReadContractError('DENIED'); }
    try {
      access(ctx,tool,q);
      if (!await ports.authorize(ctx,tool,q)) return contractFail('DENIED');
      let result: EvidenceEnvelope<ExplainPayloads[ExplainTool]>;
      // Activation is server-owned; request payloads cannot enable a source adapter.
      if ((tool === 'explainReservoirB'&&!ports.activatedTools?.includes(tool)) || tool === 'getTreeStats') result = unavailable(tool,q,ctx,false);
      else {
        const signal = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
        try { const source = await Promise.race([ports.read(tool,q,ctx,signal.signal),new Promise<never>((_,reject) => {
          timer = setTimeout(() => {signal.abort(); reject(new ReadContractError('TIMEOUT'));},2000);
        })]); result = project(tool,source,q,ctx); } finally { if (timer) clearTimeout(timer); }
      }
      const current = contextCopy(await ports.resolveContext());
      if (JSON.stringify(current) !== JSON.stringify(ctx)) throw new ReadContractError('CONTEXT_CHANGED');
      access(current,tool,q);
      if (!await ports.authorize(current,tool,q)) return contractFail('DENIED');
      await ports.audit({tool,correlationId:ctx.correlationId,outcome:result.status});
      return result;
    } catch (error) {
      const code = error instanceof ReadContractError ? error.code : 'SOURCE_UNAVAILABLE';
      try { await ports.audit({tool,correlationId:ctx.correlationId,outcome:code}); } catch { throw new ReadContractError('SOURCE_UNAVAILABLE'); }
      throw new ReadContractError(code);
    }
  };
}
