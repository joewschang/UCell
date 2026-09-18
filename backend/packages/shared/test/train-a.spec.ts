import { BUSINESS_TERMS, METRIC_DEFINITIONS, parseAsOfContext, eventVisible, projectClassifiedFields, classifyField,
  parseAnalyticsQuery, canonicalRoute, createExplainGateway, UCellRequestContext, ExplainPorts,
  lookupGovernedKnowledge, KnowledgeDocument, KnowledgeUnit, EXPLAIN_TOOL_NAMES } from '../src';
const time = {timezone:'Asia/Taipei' as const,periodStart:'2026-08-31T16:00:00.000Z',periodEnd:'2026-09-30T16:00:00.000Z',asOf:'2026-09-30T16:00:00.000Z',knowledgeCutoff:'2026-10-01T00:00:00.000Z'};
function harness() {
  const context: { -readonly [K in keyof UCellRequestContext]: UCellRequestContext[K] } = {actorId:'actor',actorType:'MEMBER',roles:['MEMBER'],personId:'person',selectedQualificationId:'ball',
    permissions:['explain:award:read'],scopes:['ball'],locale:'zh-TW',timezone:'Asia/Taipei',correlationId:'trace',contextVersion:'one'};
  const source = {status:'AVAILABLE',finality:'FINALIZED',scope:{qualificationId:'ball',resourceId:'award'},time,
    updatedAt:'2026-09-29T00:00:00.000Z',dataThrough:'2026-09-29T00:00:00.000Z',ruleVersion:'R1.0B',parameterVersion:'hash',
    evidenceRefs:[{type:'BonusAward',id:'award',revision:'one'}],result:{theory:'100',k:'0.5',final:'49.1234',awardType:'BINARY',password:'never-release',bankAccount:'123'}};
  const read = jest.fn(async () => source as unknown), authorize = jest.fn(async () => true), audit=jest.fn(async () => {});
  const ports: ExplainPorts = {resolveContext:async()=>context,authorize,read,audit};
  return {context,source,read,authorize,audit,ports,gateway:createExplainGateway(ports),query:{qualificationId:'ball',resourceId:'award',time}};
}
describe('Train A semantic and temporal foundation', () => {
  it.each(['Qualification','Person','CompanyBall','FoundingBall','Active','PV','BV','GPV','RPV','EPV','Carry','PairPV','K0','K1','K2','Rank','ReturnRate','ReservoirA','ReservoirB','Recovery','Clawback','Settlement','Payout','Tree','MonthlyNewBalls'])('defines %s', term => expect(BUSINESS_TERMS[term].meaning.length).toBeGreaterThan(20));
  it('never registers abstract PV/BV as concrete metrics',()=>{expect(BUSINESS_TERMS.PV.grain).toBe('CLASS');expect(BUSINESS_TERMS.BV.meaning).toContain('no active');expect(Object.values(METRIC_DEFINITIONS).some(m=>['PV','BV'].includes(m.term))).toBe(false);});
  it('uses Taipei half-open effective time and recorded-time cutoff independently',()=>{
    const t=parseAsOfContext(time);expect(eventVisible(time.periodStart,time.knowledgeCutoff,t)).toBe(true);
    expect(eventVisible(time.periodEnd,time.knowledgeCutoff,t)).toBe(false);
    expect(eventVisible(time.periodStart,'2026-10-01T00:00:00.001Z',t)).toBe(false);
  });
  it.each([{...time,timezone:'UTC'},{...time,periodEnd:time.periodStart},{...time,asOf:'2026-02-30T00:00:00.000Z'},{...time,currentFallback:true}])('rejects invalid temporal semantics %j',t=>expect(()=>parseAsOfContext(t)).toThrow('INVALID_QUERY'));
  it.each(['password','token','LINE_token','EntraToken','provider_secret','DB_secret','API_KEY','accessToken','DATABASE_URL'])('blocks secret field %s even when caller includes it',field=>{
    expect(classifyField(field)).toBe('SECRET_NEVER_AI');expect(projectClassifiedFields({[field]:'secret'},[field],['SECRET_NEVER_AI'])).toEqual({});
  });
  it('masks PII and removes unknown fields',()=>expect(projectClassifiedFields({bankAccount:'123456',phone:'0987',status:'PAID',raw:'secret'},['bankAccount','phone','status'],['MEMBER_SENSITIVE','ADMIN_OPERATIONAL'])).toEqual({bankAccount:'[MASKED]',phone:'[MASKED]',status:'PAID'}));
  it('rejects secret/path injection in canonical IDs',()=>expect(()=>canonicalRoute('Award','a?token=secret')).toThrow('INVALID_QUERY'));
  it('allowlists metric, dimension, role and limit before query execution',()=>{
    const h=harness();h.context.actorType='ADMIN';h.context.permissions=['metric:volume.gpv:read'];
    expect(parseAnalyticsQuery({metrics:['volume.gpv'],time,filters:{qualificationId:'ball'}},h.context).limit).toBe(50);
    for(const extra of [{sql:'select *'},{metrics:['unknown']},{limit:201},{filters:{sql:'injected'}},{groupBy:['personId']}]) expect(()=>parseAnalyticsQuery({metrics:['volume.gpv'],time,...extra},h.context)).toThrow();
    h.context.permissions=[];expect(()=>parseAnalyticsQuery({metrics:['volume.gpv'],time},h.context)).toThrow('DENIED');
  });
});
describe('Train A authoritative Explain contracts',()=>{
  it('preserves stored Final even when it differs from Theory times K; no second calculator',async()=>{
    const h=harness();const result=await h.gateway('explainAward',h.query);expect(result.result).toEqual({theory:'100',k:'0.5',final:'49.1234',awardType:'BINARY'});
    expect(result.quality).toBe('VERIFIED');expect(JSON.stringify(result)).not.toMatch(/never-release|bankAccount/);expect(h.authorize).toHaveBeenCalledTimes(2);
  });
  it.each(['roles','permissions','actorId','sql','prompt','qualificationIds'])('rejects argument injection %s',async key=>{const h=harness();await expect(h.gateway('explainAward',{...h.query,[key]:'override'})).rejects.toMatchObject({code:'INVALID_QUERY'});expect(h.read).not.toHaveBeenCalled();});
  it('does not switch or combine owned Balls',async()=>{const h=harness();await expect(h.gateway('explainAward',{...h.query,qualificationId:'other'})).rejects.toMatchObject({code:'DENIED'});expect(h.read).not.toHaveBeenCalled();});
  it('server resource check denies foreign award',async()=>{const h=harness();h.authorize.mockResolvedValue(false);await expect(h.gateway('explainAward',h.query)).rejects.toMatchObject({code:'DENIED'});expect(h.read).not.toHaveBeenCalled();});
  it('suppresses response on context change',async()=>{const h=harness();h.read.mockImplementation(async()=>{h.context.selectedQualificationId='other';return h.source;});await expect(h.gateway('explainAward',h.query)).rejects.toMatchObject({code:'CONTEXT_CHANGED'});});
  it('denies role-less admin permission escalation',async()=>{const h=harness();h.context.actorType='ADMIN';h.context.permissions=[];await expect(h.gateway('explainAward',h.query)).rejects.toMatchObject({code:'DENIED'});});
  it('fails closed when historical source substitutes today',async()=>{const h=harness();h.source.time={...time,asOf:'2026-10-02T00:00:00.000Z'};await expect(h.gateway('explainAward',h.query)).rejects.toMatchObject({code:'HISTORICAL_UNAVAILABLE'});});
  it('requires evidence instead of claiming missing Award equals zero',async()=>{const h=harness();h.source.evidenceRefs=[];await expect(h.gateway('explainAward',h.query)).rejects.toMatchObject({code:'INVALID_EVIDENCE'});});
  it('fails on audit persistence and hides source errors',async()=>{const h=harness();h.audit.mockRejectedValue(new Error('token-secret'));await expect(h.gateway('explainAward',h.query)).rejects.toMatchObject({message:'SOURCE_UNAVAILABLE'});});
  it('keeps Reservoir B unavailable even if an adapter offers money',async()=>{const h=harness();h.context.actorType='ADMIN';h.context.permissions=['explain:reservoir-b:read'];const r=await h.gateway('explainReservoirB',{resourceId:'entry',time});expect(r.result).toBeNull();expect(r.explainCode).toBe('NOT_ACTIVATED');expect(h.read).not.toHaveBeenCalled();});
  it('Member cannot access Reservoir B with injected finance permission',async()=>{const h=harness();h.context.permissions=['explain:reservoir-b:read'];await expect(h.gateway('explainReservoirB',{...h.query,resourceId:'entry'})).rejects.toMatchObject({code:'DENIED'});});
  it.each(['executeSql','createTree','payAward','constructor','__proto__'])('has no write/arbitrary tool %s',async name=>{const h=harness();await expect(h.gateway(name,h.query)).rejects.toMatchObject({code:'INVALID_QUERY'});});
  it('provides the required provider-free Explain family',()=>expect(EXPLAIN_TOOL_NAMES).toEqual(expect.arrayContaining(['getActiveStatus','explainActive','explainPerformance','explainBinaryCarry','explainAward','explainSettlement','explainPayout','explainReturnImpact','explainReservoirA','explainReservoirB','getTreeStats'])));
});
describe('Train A governed knowledge metadata',()=>{
  const doc:KnowledgeDocument={documentId:'rule',documentType:'RULE',title:'Approved rule',version:'one',recordedAt:time.periodStart,approvedAt:time.periodStart,status:'APPROVED',effectiveFrom:time.periodStart,effectiveTo:null,authorityLevel:1,approvedBy:'PO',approvalRef:'approval',supersedes:null,supersededBy:null,language:'zh-TW',source:'governance/sa-decisions/decisions.json',sourceHash:'a'.repeat(64),dataClassification:'PUBLIC',ingestionEligibility:true};
  const unit:KnowledgeUnit={unitId:'unit',parentDocumentId:'rule',parentVersion:'one',parentHash:doc.sourceHash,section:'Active',recordedAt:time.periodStart,semanticTopic:'ACTIVE_RULE',effectiveFrom:time.periodStart,effectiveTo:null,authorityLevel:1,citation:'Approved rule section',sourceRange:{start:1,end:3},supersedes:null,dataClassification:'PUBLIC'};
  function lookup(d:KnowledgeDocument[],u=unit){const h=harness();h.context.permissions=['knowledge:read'];return lookupGovernedKnowledge(d,[u],{topic:'ACTIVE_RULE',effectiveAt:time.asOf,knowledgeCutoff:time.knowledgeCutoff,locale:'zh-TW'},h.context);}
  it('excludes documents approved after known-at',()=>expect(lookup([{...doc,approvedAt:'2026-10-02T00:00:00.000Z'}]).result).toBeNull());
  it('excludes units recorded after known-at',()=>expect(lookup([doc],{...unit,recordedAt:'2026-10-02T00:00:00.000Z'}).result).toBeNull());
  it('returns citation metadata only',()=>expect(lookup([doc]).quality).toBe('KNOWLEDGE_ONLY'));
  it.each(['DRAFT','SUPERSEDED','ARCHIVED'] as const)('excludes %s rules',status=>expect(lookup([{...doc,status}]).result).toBeNull());
  it('unit cannot widen the parent version/period/classification',()=>{expect(lookup([doc],{...unit,parentVersion:'wrong'}).result).toBeNull();expect(lookup([{...doc,dataClassification:'SECRET_NEVER_AI'}]).result).toBeNull();expect(lookup([doc],{...unit,effectiveFrom:'2026-01-01T00:00:00.000Z'}).result).toBeNull();});
  it('rejects conflicting top authority documents',()=>{const h=harness();h.context.permissions=['knowledge:read'];expect(()=>lookupGovernedKnowledge([doc,{...doc,documentId:'other'}],[unit,{...unit,parentDocumentId:'other'}],{topic:'ACTIVE_RULE',effectiveAt:time.asOf,knowledgeCutoff:time.knowledgeCutoff,locale:'zh-TW'},h.context)).toThrow('INVALID_EVIDENCE');});
});


describe('Train A known-at and resolver hardening',()=>{
 it('rejects source metadata recorded after knowledge cutoff',async()=>{const h=harness();h.source.updatedAt='2026-10-02T00:00:00.000Z';await expect(h.gateway('explainAward',h.query)).rejects.toMatchObject({code:'INVALID_EVIDENCE'});});
 it('redacts resolver exceptions before any source read',async()=>{const h=harness();h.ports.resolveContext=async()=>{throw new Error('password=private');};await expect(h.gateway('explainAward',h.query)).rejects.toMatchObject({message:'DENIED'});expect(h.read).not.toHaveBeenCalled();});
});

describe('Train A partial return evidence',()=>{
 it('never labels unproven replay completion as VERIFIED',async()=>{
  const h=harness();h.context.permissions=['explain:return:read'];h.read.mockResolvedValue({...h.source,quality:'PARTIAL',result:{postedAmount:'20.25',replayStatus:'UNAVAILABLE'}});
  const r=await h.gateway('explainReturnImpact',h.query);expect(r.quality).toBe('PARTIAL');expect(r.status).toBe('PARTIAL');expect(r.explainCode).toBe('PARTIAL_EVIDENCE');
 });
});

describe('Train A timeout and quality downgrade',()=>{
 it('aborts a slow source and never releases a late result',async()=>{
  const h=harness();let observed:AbortSignal|undefined;
  h.ports.read=async(_tool,_query,_context,signal)=>{observed=signal;return new Promise(()=>{});};
  await expect(h.gateway('explainAward',h.query)).rejects.toMatchObject({code:'TIMEOUT'});expect(observed?.aborted).toBe(true);
 });
 it('never upgrades an explicitly partial source to verified',async()=>{const h=harness();h.read.mockResolvedValue({...h.source,quality:'PARTIAL'});await expect(h.gateway('explainAward',h.query)).rejects.toMatchObject({code:'INVALID_EVIDENCE'});});
});

describe('Train A additional secret and identity aliases',()=>{
 it.each(['privateKey','signingKey','encryptionKey'])('blocks %s',key=>expect(projectClassifiedFields({[key]:'private'},[key],['ADMIN_OPERATIONAL','MEMBER_SENSITIVE','SECRET_NEVER_AI'])).toEqual({}));
 it.each(['legalName','preferredName','idNumber','dateOfBirth','mobile'])('masks %s',key=>expect(projectClassifiedFields({[key]:'private'},[key],['ADMIN_OPERATIONAL','MEMBER_SENSITIVE'])).toEqual({[key]:'[MASKED]'}));
});
