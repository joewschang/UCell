import { READ_DEFINITIONS, DataClassification, ToolName } from './catalog';

export type ReadErrorCode = 'INVALID_QUERY' | 'DENIED' | 'CONTEXT_CHANGED'
  | 'SOURCE_UNAVAILABLE' | 'INVALID_EVIDENCE' | 'HISTORICAL_UNAVAILABLE' | 'TIMEOUT';
export class ReadContractError extends Error {
  constructor(readonly code: ReadErrorCode) { super(code); this.name = 'ReadContractError'; }
}
/** Supplied by trusted server integration, never deserialized from model/client arguments. */
export interface ReadRequestContext {
  actorId: string; audience: 'MEMBER' | 'ADMIN'; personId?: string;
  selectedQualificationId?: string; contextVersion: string;
  permissions: readonly string[]; correlationId: string;
}
export interface ReadQuery {
  qualificationId?: string; binaryTreeId?: string; periodEnd?: string; entryId?: string; settlementBatchId?: string;
}
export interface AuthorizedReadTarget {
  qualificationId: string; binaryTreeId?: string; entryId?: string; settlementBatchId?: string;
}
export interface EvidenceReference { type: string; id: string; revision: string; }
export interface SourceRead {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  finality: 'FINALIZED' | 'PROVISIONAL' | 'NOT_APPLICABLE';
  scope: AuthorizedReadTarget; periodEnd?: string; updatedAt: string;
  ruleVersion: string; parameterVersion: string; evidenceRefs: EvidenceReference[];
  // Unknown intentionally: validate and project before release to a UI or future model.
  result: unknown;
}
export interface ReadEnvelope {
  status: SourceRead['status']; finality: SourceRead['finality'];
  scope: AuthorizedReadTarget; periodEnd?: string; updatedAt: string;
  definitionKey: string; definitionVersion: string; ruleVersion: string; parameterVersion: string;
  classification: DataClassification; evidenceRefs: EvidenceReference[];
  result: Record<string, string | boolean> | null;
}
export interface ReadAudit {
  tool: ToolName; definitionVersion: string; correlationId: string;
  outcome: 'AVAILABLE' | 'UNAVAILABLE' | ReadErrorCode;
}
export interface ReadGatewayDependencies {
  /** Resolve authenticated server session AND current context on every invocation. */
  resolveContext: () => Promise<ReadRequestContext>;
  /** Must check current ownership/RBAC/resource existence; null never discloses why. */
  authorize: (context: ReadRequestContext, tool: ToolName, query: Readonly<ReadQuery>) => Promise<AuthorizedReadTarget | null>;
  read: (tool: ToolName, target: Readonly<AuthorizedReadTarget>, query: Readonly<ReadQuery>, signal: AbortSignal) => Promise<unknown>;
  /** Trusted server configuration; bounds the source read, not an HTTP request SLA. */
  readTimeoutMs?: number;
  /** Controlled metadata only. Failure prevents releasing the result. */
  audit: (event: Readonly<ReadAudit>) => Promise<void>;
}
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const instant = (v: unknown): v is string => typeof v === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object'
  && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const fail = (code: ReadErrorCode): never => { throw new ReadContractError(code); };
const knownTool = (v: unknown): v is ToolName => typeof v === 'string' && Object.prototype.hasOwnProperty.call(READ_DEFINITIONS, v);
export function parseReadQuery(tool: ToolName, raw: unknown): Readonly<ReadQuery> {
  if (!knownTool(tool) || !record(raw)) return fail('INVALID_QUERY');
  const fields = tool === 'getActiveStatus' ? ['qualificationId']
    : tool === 'explainBinaryCarry' ? ['qualificationId', 'binaryTreeId', 'periodEnd'] : tool === 'explainBinarySettlementCarry' ? ['qualificationId', 'settlementBatchId'] : ['entryId'];
  // No actor, role, permission, SQL, URL, arbitrary time mode or context override.
  if (Object.keys(raw).some(k => !fields.includes(k))) return fail('INVALID_QUERY');
  if (fields.some(k => !(k === 'periodEnd' ? instant(raw[k]) : id(raw[k])))) return fail('INVALID_QUERY');
  return Object.freeze(Object.fromEntries(fields.map(k => [k, raw[k]])) as ReadQuery);
}
function snapshotContext(value: ReadRequestContext): ReadRequestContext {
  if (!value || !id(value.actorId) || !id(value.contextVersion) || !id(value.correlationId)
    || !['MEMBER', 'ADMIN'].includes(value.audience) || !Array.isArray(value.permissions)
    || value.permissions.some(p => !id(p)) || (value.personId !== undefined && !id(value.personId))
    || (value.selectedQualificationId !== undefined && !id(value.selectedQualificationId))) return fail('DENIED');
  return Object.freeze({ actorId: value.actorId, audience: value.audience, personId: value.personId,
    selectedQualificationId: value.selectedQualificationId, contextVersion: value.contextVersion,
    correlationId: value.correlationId, permissions: Object.freeze([...value.permissions].sort()) });
}
function checkAccess(context: ReadRequestContext, tool: ToolName, query: ReadQuery): void {
  if (!context.permissions.includes(READ_DEFINITIONS[tool].requiredPermission)) fail('DENIED');
  if (context.audience === 'MEMBER' && (tool === 'explainReservoirB' || !context.personId
    || !context.selectedQualificationId || query.qualificationId !== context.selectedQualificationId)) fail('DENIED');
}
function targetCopy(value: AuthorizedReadTarget | null, query: ReadQuery): Readonly<AuthorizedReadTarget> {
  if (!value || !id(value.qualificationId) || (value.binaryTreeId !== undefined && !id(value.binaryTreeId))
    || (value.entryId !== undefined && !id(value.entryId))
    || (value.settlementBatchId !== undefined && !id(value.settlementBatchId))
    || (query.settlementBatchId !== undefined && query.settlementBatchId !== value.settlementBatchId)
    || (query.qualificationId !== undefined && query.qualificationId !== value.qualificationId)
    || (query.binaryTreeId !== undefined && query.binaryTreeId !== value.binaryTreeId)
    || (query.entryId !== undefined && query.entryId !== value.entryId)) return fail('DENIED');
  return Object.freeze({ qualificationId: value.qualificationId, binaryTreeId: value.binaryTreeId, entryId: value.entryId, settlementBatchId: value.settlementBatchId });
}
const decimal = (v: unknown): v is string => typeof v === 'string' && /^-?(?:0|[1-9]\d{0,17})(?:\.\d{1,8})?$/.test(v);
function projectResult(tool: ToolName, raw: unknown): Record<string, string | boolean> {
  if (!record(raw)) return fail('INVALID_EVIDENCE');
  if (tool === 'getActiveStatus') {
    if (typeof raw.active !== 'boolean' || typeof raw.ownerType !== 'string' || !['MEMBER', 'COMPANY'].includes(raw.ownerType) || typeof raw.reasonCode !== 'string' || !['THRESHOLD_MET', 'BELOW_THRESHOLD', 'COMPANY_RULE', 'NOT_EFFECTIVE'].includes(raw.reasonCode)) return fail('INVALID_EVIDENCE');
    if (raw.ownerType === 'COMPANY' && (raw.active !== true || raw.reasonCode !== 'COMPANY_RULE')) return fail('INVALID_EVIDENCE');
    if (raw.ownerType === 'MEMBER' && (raw.reasonCode === 'COMPANY_RULE' || raw.active !== (raw.reasonCode === 'THRESHOLD_MET'))) return fail('INVALID_EVIDENCE');
    return { active: raw.active, ownerType: raw.ownerType as string, reasonCode: raw.reasonCode };
  }
  if (tool === 'explainBinaryCarry' || tool === 'explainBinarySettlementCarry') {
    if (!decimal(raw.leftCarry) || !decimal(raw.rightCarry) || raw.leftCarry.startsWith('-') || raw.rightCarry.startsWith('-')) return fail('INVALID_EVIDENCE');
    return { leftCarry: raw.leftCarry, rightCarry: raw.rightCarry };
  }
  if (!decimal(raw.amount) || raw.currency !== 'TWD' || typeof raw.kind !== 'string' || !['ACCRUAL', 'CORRECTION'].includes(raw.kind)) return fail('INVALID_EVIDENCE');
  if (raw.kind === 'ACCRUAL' && raw.amount.startsWith('-')) return fail('INVALID_EVIDENCE');
  if (raw.kind === 'CORRECTION' && !id(raw.adjustsEntryId)) return fail('INVALID_EVIDENCE');
  return { amount: raw.amount, currency: 'TWD', kind: raw.kind as string,
    ...(raw.kind === 'CORRECTION' ? { adjustsEntryId: raw.adjustsEntryId as string } : {}) };
}
function envelope(tool: ToolName, raw: unknown, target: AuthorizedReadTarget, query: ReadQuery, audience: ReadRequestContext['audience']): ReadEnvelope {
  if (!record(raw) || !record(raw.scope) || typeof raw.status !== 'string' || !['AVAILABLE', 'UNAVAILABLE'].includes(raw.status)
    || typeof raw.finality !== 'string' || !['FINALIZED', 'PROVISIONAL', 'NOT_APPLICABLE'].includes(raw.finality)
    || !instant(raw.updatedAt) || !id(raw.ruleVersion) || !id(raw.parameterVersion)
    || !Array.isArray(raw.evidenceRefs) || raw.evidenceRefs.length > 100) return fail('INVALID_EVIDENCE');
  for (const field of ['qualificationId', 'binaryTreeId', 'entryId', 'settlementBatchId'] as const) {
    if (raw.scope[field] !== target[field]) return fail('INVALID_EVIDENCE');
  }
  if (tool === 'explainBinarySettlementCarry' ? !instant(raw.periodEnd) : raw.periodEnd !== query.periodEnd) return fail('INVALID_EVIDENCE');
  if (raw.status === 'AVAILABLE' && (raw.evidenceRefs.length === 0
    || (tool !== 'getActiveStatus' && raw.finality !== 'FINALIZED'))) return fail('INVALID_EVIDENCE');
  if (raw.status === 'UNAVAILABLE' && raw.result !== null) return fail('INVALID_EVIDENCE');
  const refs = raw.evidenceRefs.map(ref => {
    if (!record(ref) || !id(ref.type) || !id(ref.id) || !id(ref.revision)) return fail('INVALID_EVIDENCE');
    return { type: ref.type, id: ref.id, revision: ref.revision };
  });
  const definition = READ_DEFINITIONS[tool];
  // Explicit projection: arbitrary source fields, PII, prose and links never pass through.
  return { status: raw.status as SourceRead['status'], finality: raw.finality as SourceRead['finality'],
    scope: { ...target }, ...(raw.periodEnd ? { periodEnd: raw.periodEnd as string } : {}), updatedAt: raw.updatedAt,
    definitionKey: definition.key, definitionVersion: definition.version,
    ruleVersion: raw.ruleVersion, parameterVersion: raw.parameterVersion, classification: definition.classification === 'MEMBER_SELF' && audience === 'ADMIN' ? 'ADMIN_OPERATIONAL' : definition.classification,
    evidenceRefs: refs, result: raw.status === 'AVAILABLE' ? projectResult(tool, raw.result) : null };
}

/** Read-only integration seam. No HTTP endpoint, credentials, model, DB access or write tools. */
export function createReadGateway(dependencies: ReadGatewayDependencies) {
  const timeoutMs = dependencies.readTimeoutMs ?? 2000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw new Error('INVALID_READ_TIMEOUT');
  async function readWithDeadline(tool: ToolName, target: Readonly<AuthorizedReadTarget>, query: Readonly<ReadQuery>) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() => dependencies.read(tool, target, query, controller.signal)),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new ReadContractError('TIMEOUT')); }, timeoutMs);
        }),
      ]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }
  return async (requestedTool: unknown, rawQuery: unknown): Promise<ReadEnvelope> => {
    if (!knownTool(requestedTool)) return fail('INVALID_QUERY');
    const tool = requestedTool;
    const query = parseReadQuery(tool, rawQuery);
    let context: ReadRequestContext;
    try { context = snapshotContext(await dependencies.resolveContext()); }
    catch { return fail('DENIED'); }
    try {
      checkAccess(context, tool, query);
      const target = targetCopy(await dependencies.authorize(context, tool, query), query);
      const source = await readWithDeadline(tool, target, query);
      const current = snapshotContext(await dependencies.resolveContext());
      if (JSON.stringify(current) !== JSON.stringify(context)) return fail('CONTEXT_CHANGED');
      checkAccess(current, tool, query);
      const authorizedAgain = targetCopy(await dependencies.authorize(current, tool, query), query);
      if (JSON.stringify(authorizedAgain) !== JSON.stringify(target)) return fail('CONTEXT_CHANGED');
      const result = envelope(tool, source, target, query, current.audience);
      await dependencies.audit(Object.freeze({ tool, definitionVersion: READ_DEFINITIONS[tool].version,
        correlationId: context.correlationId, outcome: result.status }));
      return result;
    } catch (error) {
      const code = error instanceof ReadContractError ? error.code : 'SOURCE_UNAVAILABLE';
      // Never propagate source exception messages, prompts or query arguments into audit/results.
      try { await dependencies.audit(Object.freeze({ tool, definitionVersion: READ_DEFINITIONS[tool].version,
        correlationId: context.correlationId, outcome: code })); } catch { return fail('SOURCE_UNAVAILABLE'); }
      return fail(code);
    }
  };
}
