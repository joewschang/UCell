import { HttpException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@ucell/database';
import { createExplainGateway, ExplainQuery, ReadContractError, UCellRequestContext } from '@ucell/shared';
import { readStructuredExplanation } from './structured-explain-source';
export interface AdminExplainRequest {user:{sessionId:string;personId?:string;provider:string;subject:string;role:string};correlationId?:string;}
const roles=['FINANCE','SUPER_ADMIN','COMPLIANCE_AUDIT'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
@Injectable()
export class AdminStructuredExplainService {
 constructor(private readonly db:PrismaService){}
 async explain(request:AdminExplainRequest,tool:'explainReservoirA'|'explainReservoirB',query:ExplainQuery){
  const p=request.user;
  if(!p || p.provider!=='ENTRA' || !p.personId || !uuid.test(p.personId) || !uuid.test(p.sessionId) || !roles.includes(p.role)) throw new HttpException({code:'DENIED'},403);
  if(!query.resourceId || !uuid.test(query.resourceId) || query.qualificationId || query.binaryTreeId) throw new HttpException({code:'INVALID_QUERY'},400);
  const correlationId=request.correlationId && uuid.test(request.correlationId)?request.correlationId:randomUUID();
  const resolveContext=async():Promise<UCellRequestContext>=>{
   const now=new Date();
   const [session,link,grants]=await Promise.all([
    this.db.authSession.findUnique({where:{authSessionId:p.sessionId}}),
    this.db.identityLink.findUnique({where:{provider_providerSubject:{provider:'ENTRA',providerSubject:p.subject}}}),
    this.db.adminAccessGrant.findMany({where:{personId:p.personId,provider:'ENTRA',providerSubject:p.subject,roleCode:p.role,status:'ACTIVE',validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]},take:2}),
   ]);
   if(!session || session.provider!=='ENTRA' || session.personId!==p.personId || session.subject!==p.subject || session.roleCode!==p.role
    || session.status!=='ACTIVE' || session.revokedAt || session.expiresAt<=now || link?.personId!==p.personId || grants.length!==1) throw new ReadContractError('DENIED');
   return {actorId:p.personId!,actorType:'ADMIN',personId:p.personId,roles:[p.role],permissions:['explain:reservoir-a:read','explain:reservoir-b:read'],
    scopes:['finance:reservoir:read'],locale:'zh-TW',timezone:'Asia/Taipei',correlationId,contextVersion:p.sessionId+'.'+grants[0].adminAccessGrantId};
  };
  const gateway=createExplainGateway({activatedTools:['explainReservoirB'],resolveContext,authorize:async c=>c.actorType==='ADMIN' && c.scopes.includes('finance:reservoir:read'),
   read:async(name,q,_context,signal)=>{
    const now=new Date().toISOString();if(q.time.asOf>now || q.time.knowledgeCutoff>now) throw new ReadContractError('INVALID_QUERY');
    return this.db.$transaction(async tx=>{if(signal.aborted)throw new ReadContractError('TIMEOUT');const result=await readStructuredExplanation(tx,name,q);if(signal.aborted)throw new ReadContractError('TIMEOUT');return result;},{isolationLevel:'RepeatableRead',maxWait:500,timeout:1500});
   },audit:async event=>{await this.db.auditEvent.create({data:{actorType:'USER',actorId:p.personId,action:'ADMIN_STRUCTURED_EXPLAIN_READ',entityType:'ReservoirLedgerEffect',entityId:query.resourceId,
    afterData:{tool:event.tool,outcome:event.outcome,definitionVersion:'1'},requestId:correlationId,correlationId}});}});
  try{return await gateway(tool,query);}catch(error){const code=error instanceof ReadContractError?error.code:'SOURCE_UNAVAILABLE';throw new HttpException({code},code==='DENIED'?403:code==='INVALID_QUERY'?400:code==='CONTEXT_CHANGED'?409:code==='TIMEOUT'?504:503);}
 }
}
