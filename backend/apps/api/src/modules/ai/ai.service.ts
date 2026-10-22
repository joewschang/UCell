import {Injectable,ForbiddenException,NotFoundException,ConflictException,HttpException,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {PrismaService,Prisma} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {Actor,Audience,Answer,boundedText,hash,strict,uuid,reportCsv,unavailable} from './ai-contract';
import {AiProvider} from './ai-provider';
import {AiData} from './ai-data';
const cap=(audience:Audience)=>audience==='ADMIN'?'AI_EXEC_READ':'AI_MEMBER_SELF';
@Injectable()
export class AiService implements OnModuleInit,OnModuleDestroy{
 private running=new Map<string,AbortController>();private timer?:ReturnType<typeof setInterval>;
 constructor(private readonly db:PrismaService,private readonly config:ConfigService,private readonly provider:AiProvider,private readonly data:AiData){}
 private enabled(){const env=this.config.get('UCELL_ENVIRONMENT');return this.config.get('AI_ENABLED')==='true'&&(env==='STAGE'||env==='PRODUCTION'&&this.config.get('NODE_ENV')==='production');}
 private roleCapabilities(actor:Actor){if(this.config.get('UCELL_ENVIRONMENT')!=='PRODUCTION'||this.config.get('AI_ACCESS_MODE')!=='PRODUCTION_ROLES')return [];return actor.audience==='MEMBER'?['AI_MEMBER_SELF']:actor.role==='SUPER_ADMIN'?['AI_EXEC_READ','AI_REPORT_EXPORT','AI_KB_EDIT','AI_KB_APPROVE','AI_AUDIT_READ']:[];}
 onModuleInit(){if(this.config.get('AI_ENABLED')==='true'){this.timer=setInterval(()=>void this.cleanup().catch(()=>undefined),60000);this.timer.unref();}}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);for(const c of this.running.values())c.abort();}
 async cleanup(){await this.db.$executeRaw`UPDATE ai.turn SET status='FAILED',result='{"code":"AI_WORK_INTERRUPTED"}'::jsonb,completed_at=now() WHERE status IN ('QUEUED','RUNNING') AND created_at<now()-interval '2 minutes'`;await this.db.$executeRaw`DELETE FROM ai.report_job WHERE expires_at<now()`;await this.db.$executeRaw`DELETE FROM ai.snapshot WHERE expires_at<now()`;await this.db.$executeRaw`UPDATE ai.turn SET result=NULL WHERE created_at<now()-interval '30 days' AND result IS NOT NULL`;await this.db.$executeRaw`DELETE FROM ai.audit_event WHERE created_at<now()-interval '180 days'`;}
 async authorize(user:any,audience:Audience,capability=cap(audience)):Promise<Actor>{
  if(!this.enabled())throw new HttpException({code:'AI_DISABLED'},503);
  if(!user||!uuid(user.personId)||!user.sessionId)throw new ForbiddenException({code:'AI_VERIFIED_SESSION_REQUIRED'});
  const actor:Actor={id:user.personId,audience,sessionId:user.sessionId,provider:user.provider,subject:user.subject,role:user.role};
  await this.assertActor(actor,capability);return actor;
 }
 async assertActor(actor:Actor,capability=cap(actor.audience)){
  if(!this.enabled())throw new HttpException({code:'AI_DISABLED'},503);
  const stageMember=actor.audience==='MEMBER'&&actor.sessionId==='STAGE_UAT_MEMBER'&&actor.id==='51000000-0000-4000-8000-000000000001'&&this.config.get('UCELL_ENVIRONMENT')==='STAGE'&&this.config.get('NODE_ENV')==='staging';
  if(!stageMember){
   if(!uuid(actor.sessionId))throw new ForbiddenException({code:'AI_VERIFIED_SESSION_REQUIRED'});
   const session=await this.db.authSession.findUnique({where:{authSessionId:actor.sessionId}});
   if(!session||session.personId!==actor.id||session.status!=='ACTIVE'||session.revokedAt||session.expiresAt<=new Date()||session.provider!==actor.provider||session.subject!==actor.subject||(actor.audience==='ADMIN'?!session.roleCode:!!session.roleCode))throw new ForbiddenException({code:'AI_SESSION_REVOKED'});
   if(actor.audience==='ADMIN'){
    if(actor.role!==session.roleCode)throw new ForbiddenException({code:'AI_SCOPE_DENIED'});
    const grant=await this.db.adminAccessGrant.findFirst({where:{personId:actor.id,provider:actor.provider as any,providerSubject:actor.subject,status:'ACTIVE',roleCode:session.roleCode!,validFrom:{lte:new Date()},OR:[{validTo:null},{validTo:{gt:new Date()}}]}});if(!grant)throw new ForbiddenException({code:'AI_SCOPE_DENIED'});
   }
  }
  const person=await this.db.person.findUnique({where:{personId:actor.id},select:{status:true,securityStatus:true,membershipState:true}});
  if(person?.status!=='EFFECTIVE'||person.securityStatus!=='NORMAL')throw new ForbiddenException({code:'AI_SCOPE_DENIED'});
  if(this.config.get('UCELL_ENVIRONMENT')==='PRODUCTION'&&actor.audience==='MEMBER'&&!person.membershipState)throw new ForbiddenException({code:'AI_SCOPE_DENIED'});
  if(this.roleCapabilities(actor).includes(capability))return;
  const grants=await this.db.$queryRaw<any[]>`SELECT id FROM ai.capability_grant WHERE actor_id=${actor.id}::uuid AND capability=${capability} AND valid_from<=now() AND valid_to>now()`;
  if(!grants.length)throw new ForbiddenException({code:'AI_CAPABILITY_REQUIRED'});
 }
 async audit(actor:Actor,action:string,id:string|null,outcome:string,details:any={}){await this.db.$executeRaw`INSERT INTO ai.audit_event(id,actor_id,audience,action,entity_id,outcome,details) VALUES(${randomUUID()}::uuid,${actor.id}::uuid,${actor.audience},${action},${id}::uuid,${outcome},${JSON.stringify(details)}::jsonb)`;}
 async capabilities(actor:Actor){await this.assertActor(actor);const grants=await this.db.$queryRaw<any[]>`SELECT capability FROM ai.capability_grant WHERE actor_id=${actor.id}::uuid AND valid_from<=now() AND valid_to>now()`;const stage=this.config.get('UCELL_ENVIRONMENT')==='STAGE';return{stageOnly:stage,environment:stage?'STAGE':'PRODUCTION',modelConfigured:this.provider.configured(),mode:'MODEL_PLANNER_GROUNDED_FACTS',capabilities:[...new Set([...grants.map(x=>x.capability),...this.roleCapabilities(actor)])],maxMessageLength:2000,timezone:'Asia/Taipei',notice:(stage?'Stage 測試版：':'')+'模型只解析問題，資料與數字由系統產生。退款淨額與同期比較尚未開放。'};}
 async createConversation(actor:Actor,input:any){strict(input,['qualificationId']);const q=input.qualificationId??null;if(q!==null&&(!uuid(q)||actor.audience!=='MEMBER'))throw new HttpException({code:'AI_INVALID_CONTEXT'},400);if(q)await this.data.own(this.db as any,actor,q);const id=randomUUID();await this.db.$executeRaw`INSERT INTO ai.conversation(id,actor_id,audience,qualification_id,expires_at) VALUES(${id}::uuid,${actor.id}::uuid,${actor.audience},${q}::uuid,now()+interval '30 days')`;await this.audit(actor,'CONVERSATION_CREATED',id,'CREATED');return{id,contextVersion:1,qualificationId:q};}
 async conversation(actor:Actor,id:string){if(!uuid(id))throw new NotFoundException();const [c]=await this.db.$queryRaw<any[]>`SELECT * FROM ai.conversation WHERE id=${id}::uuid AND actor_id=${actor.id}::uuid AND audience=${actor.audience} AND expires_at>now()`;if(!c)throw new NotFoundException();if(c.qualification_id)await this.data.own(this.db as any,actor,c.qualification_id);return c;}
 async turn(actor:Actor,conversationId:string,input:any,key:string){
  strict(input,['message','contextVersion']);const message=boundedText(input.message);if(input.contextVersion!==1)throw new ConflictException({code:'AI_CONTEXT_CHANGED'});boundedText(key,8,100);
  const conversation=await this.conversation(actor,conversationId),inputHash=hash(message),id=randomUUID(),requestId=randomUUID();
  const row=await this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('ai-stage-quota'))::text`;
   const [old]=await tx.$queryRaw<any[]>`SELECT id,input_hash,status FROM ai.turn WHERE conversation_id=${conversationId}::uuid AND idempotency_key=${key}`;
   if(old){if(old.input_hash!==inputHash)throw new ConflictException({code:'AI_IDEMPOTENCY_CONFLICT'});return{...old,reused:true};}
   const [counts]=await tx.$queryRaw<any[]>`SELECT count(*) FILTER(WHERE actor_id=${actor.id}::uuid AND created_at>now()-interval '1 minute')::int AS minute,count(*) FILTER(WHERE actor_id=${actor.id}::uuid AND created_at>=date_trunc('day',now() AT TIME ZONE 'Asia/Taipei') AT TIME ZONE 'Asia/Taipei')::int AS day,COALESCE(sum(reserved_tokens) FILTER(WHERE created_at>=date_trunc('month',now() AT TIME ZONE 'Asia/Taipei') AT TIME ZONE 'Asia/Taipei'),0)::int AS reserved FROM ai.turn WHERE created_at>=date_trunc('month',now() AT TIME ZONE 'Asia/Taipei') AT TIME ZONE 'Asia/Taipei'`;
   const limit=Math.min(10000000,Math.max(8192,Number(this.config.get('AI_MONTHLY_TOKEN_LIMIT')??'500000')));
   if(!Number.isFinite(limit)||counts.minute>=(actor.audience==='MEMBER'?5:10)||counts.day>=(actor.audience==='MEMBER'?50:200)||counts.reserved+8192>limit)throw new HttpException({code:'AI_QUOTA_EXCEEDED'},429);
   await tx.$executeRaw`INSERT INTO ai.turn(id,conversation_id,actor_id,audience,idempotency_key,input_hash,status,request_id,reserved_tokens) VALUES(${id}::uuid,${conversationId}::uuid,${actor.id}::uuid,${actor.audience},${key},${inputHash},'QUEUED',${requestId}::uuid,8192)`;return{id,status:'QUEUED',reused:false};
  });
  if(!row.reused)void this.run(actor,row.id,conversation,message).catch(()=>undefined);
  return{turnId:row.id,status:row.status,contextVersion:1};
 }
 private async run(actor:Actor,id:string,c:any,message:string){
  const controller=new AbortController();this.running.set(id,controller);const timer=setTimeout(()=>controller.abort(),24000);
  try{
   await this.db.$executeRaw`UPDATE ai.turn SET status='RUNNING' WHERE id=${id}::uuid AND status='QUEUED'`;
   await this.assertActor(actor);const planned=await this.provider.plan(message,actor.audience,controller.signal);
   await this.assertActor(actor);let answer=await this.data.execute(actor,planned.plan,c.qualification_id);if(controller.signal.aborted)throw Error('AI_TIMEOUT');await this.assertActor(actor);
   if(c.qualification_id)await this.data.own(this.db as any,actor,c.qualification_id);
   const snapshotId=randomUUID();const status=answer.status==='CLARIFY'?'NEEDS_CLARIFICATION':'COMPLETED';
   await this.db.$transaction(async tx=>{
    const changed=await tx.$executeRaw`UPDATE ai.turn SET status=${status},result=${JSON.stringify({answer,snapshotId,contextVersion:1})}::jsonb,intent=${planned.plan.intent},model_version=${planned.model},token_count=${planned.tokens},completed_at=now() WHERE id=${id}::uuid AND status='RUNNING'`;
    if(changed){await tx.$executeRaw`INSERT INTO ai.snapshot(id,turn_id,actor_id,audience,qualification_id,payload,payload_hash,expires_at) VALUES(${snapshotId}::uuid,${id}::uuid,${actor.id}::uuid,${actor.audience},${c.qualification_id}::uuid,${JSON.stringify(answer)}::jsonb,${hash(JSON.stringify(answer))},now()+interval '24 hours')`;}
   });await this.audit(actor,'TURN_COMPLETED',id,status,{intent:planned.plan.intent,model:planned.model,tokens:planned.tokens,definitionVersion:answer.definitionVersion,status:answer.status});
  }catch(e:any){const response=e?.getResponse?.();const code=typeof response?.code==='string'?response.code:'AI_SOURCE_UNAVAILABLE';await this.db.$executeRaw`UPDATE ai.turn SET status='FAILED',result=${JSON.stringify({code})}::jsonb,completed_at=now() WHERE id=${id}::uuid AND status IN ('QUEUED','RUNNING')`;await this.audit(actor,'TURN_FAILED',id,'FAILED',{code});}
  finally{clearTimeout(timer);this.running.delete(id);}
 }
 async getTurn(actor:Actor,id:string){if(!uuid(id))throw new NotFoundException();const [t]=await this.db.$queryRaw<any[]>`SELECT * FROM ai.turn WHERE id=${id}::uuid AND actor_id=${actor.id}::uuid AND audience=${actor.audience}`;if(!t)throw new NotFoundException();await this.conversation(actor,t.conversation_id);if(['RUNNING','QUEUED'].includes(t.status)&&Date.now()-new Date(t.created_at).getTime()>30000){await this.db.$executeRaw`UPDATE ai.turn SET status='FAILED',result='{"code":"AI_WORK_INTERRUPTED"}'::jsonb,completed_at=now() WHERE id=${id}::uuid AND status IN ('RUNNING','QUEUED')`;return{turnId:id,status:'FAILED',code:'AI_WORK_INTERRUPTED'};}return{turnId:id,status:t.status,createdAt:t.created_at,requestId:t.request_id,...t.result};}
 async cancel(actor:Actor,id:string){await this.getTurn(actor,id);this.running.get(id)?.abort();await this.db.$executeRaw`UPDATE ai.turn SET status='CANCELLED',completed_at=now(),result=NULL WHERE id=${id}::uuid AND status IN ('RUNNING','QUEUED')`;await this.audit(actor,'TURN_CANCELLED',id,'CANCELLED');return{cancelled:true};}
 async feedback(actor:Actor,id:string,input:any){strict(input,['rating']);if(!['HELPFUL','INCORRECT','UNCLEAR'].includes(input.rating))throw new HttpException({code:'AI_INVALID_INPUT'},400);await this.getTurn(actor,id);await this.db.$executeRaw`INSERT INTO ai.feedback(id,turn_id,actor_id,rating) VALUES(${randomUUID()}::uuid,${id}::uuid,${actor.id}::uuid,${input.rating}) ON CONFLICT(turn_id,actor_id) DO UPDATE SET rating=EXCLUDED.rating`;return{saved:true};}
 async createReport(actor:Actor,input:any){strict(input,['snapshotId']);await this.assertActor(actor,'AI_REPORT_EXPORT');const snapshot=await this.snapshot(actor,input.snapshotId);if(!snapshot.payload.exportable||snapshot.payload.status!=='AVAILABLE')throw new ConflictException({code:'AI_REPORT_UNAVAILABLE'});const [job]=await this.db.$queryRaw<any[]>`INSERT INTO ai.report_job(id,snapshot_id,actor_id,status,expires_at) VALUES(${randomUUID()}::uuid,${snapshot.id}::uuid,${actor.id}::uuid,'READY',${snapshot.expires_at}) ON CONFLICT(snapshot_id,actor_id) DO UPDATE SET snapshot_id=EXCLUDED.snapshot_id RETURNING id,status`;await this.audit(actor,'REPORT_CREATED',job.id,'READY');return job;}
 async snapshot(actor:Actor,id:string){if(!uuid(id))throw new NotFoundException();const [s]=await this.db.$queryRaw<any[]>`SELECT * FROM ai.snapshot WHERE id=${id}::uuid AND actor_id=${actor.id}::uuid AND audience=${actor.audience} AND expires_at>now()`;if(!s)throw new NotFoundException();if(s.qualification_id)await this.data.own(this.db as any,actor,s.qualification_id);return s;}
 async download(actor:Actor,id:string){await this.assertActor(actor,'AI_REPORT_EXPORT');if(!uuid(id))throw new NotFoundException();const [job]=await this.db.$queryRaw<any[]>`SELECT * FROM ai.report_job WHERE id=${id}::uuid AND actor_id=${actor.id}::uuid AND expires_at>now()`;if(!job)throw new NotFoundException();const s=await this.snapshot(actor,job.snapshot_id);await this.audit(actor,'REPORT_DOWNLOADED',id,'READY');return reportCsv(s.payload,s.id);}
 async knowledge(actor:Actor){await this.assertActor(actor,'AI_KB_EDIT');return this.db.$queryRaw<any[]>`SELECT * FROM ai.knowledge_version ORDER BY created_at DESC LIMIT 100`;}
 async createKnowledge(actor:Actor,input:any){await this.assertActor(actor,'AI_KB_EDIT');strict(input,['topic','title','body','audience','sourceRef','effectiveFrom','effectiveTo']);const topic=boundedText(input.topic,2,40),title=boundedText(input.title,2,100),body=boundedText(input.body,10,4000),source=boundedText(input.sourceRef,3,300);if(!/^[a-z-]{2,40}$/.test(topic)||!['ALL','MEMBER','ADMIN'].includes(input.audience))throw new HttpException({code:'AI_INVALID_INPUT'},400);const from=new Date(input.effectiveFrom),to=new Date(input.effectiveTo);if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||to<=from)throw new HttpException({code:'AI_INVALID_INPUT'},400);
  const id=randomUUID();await this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${topic}))::text`;const [v]=await tx.$queryRaw<any[]>`SELECT COALESCE(max(version),0)+1 AS next FROM ai.knowledge_version WHERE topic=${topic}`;await tx.$executeRaw`INSERT INTO ai.knowledge_version(id,topic,version,title,body,audience,source_ref,source_hash,effective_from,effective_to,status,author_id) VALUES(${id}::uuid,${topic},${v.next},${title},${body},${input.audience},${source},${hash(body+'|'+source)},${from},${to},'DRAFT',${actor.id}::uuid)`;});await this.audit(actor,'KNOWLEDGE_CREATED',id,'DRAFT');return{id};
 }
 async knowledgeAction(actor:Actor,id:string,action:string,input:any){const required=action==='submit'?'AI_KB_EDIT':'AI_KB_APPROVE';await this.assertActor(actor,required);strict(input,['revision']);if(!uuid(id)||!Number.isInteger(input.revision))throw new HttpException({code:'AI_INVALID_INPUT'},400);
  const status=action==='submit'?'IN_REVIEW':action==='approve'?'PUBLISHED':action==='disable'?'DISABLED':null;if(!status)throw new NotFoundException();
  await this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('ai-knowledge-publication'))::text`;const [v]=await tx.$queryRaw<any[]>`SELECT * FROM ai.knowledge_version WHERE id=${id}::uuid FOR UPDATE`;if(!v)throw new NotFoundException();if(v.revision!==input.revision)throw new ConflictException({code:'AI_REVISION_CONFLICT'});if(action==='submit'&&(v.status!=='DRAFT'||v.author_id!==actor.id)||action==='approve'&&(v.status!=='IN_REVIEW'||v.author_id===actor.id)||action==='disable'&&v.status!=='PUBLISHED')throw new ConflictException({code:'AI_KNOWLEDGE_WORKFLOW'});
   if(action==='approve'){const overlap=await tx.$queryRaw<any[]>`SELECT id FROM ai.knowledge_version WHERE topic=${v.topic} AND status='PUBLISHED' AND (audience='ALL' OR ${v.audience}='ALL' OR audience=${v.audience}) AND effective_from<${v.effective_to} AND effective_to>${v.effective_from}`;if(overlap.length)throw new ConflictException({code:'AI_KNOWLEDGE_OVERLAP'});}
   await tx.$executeRaw`UPDATE ai.knowledge_version SET status=${status},revision=revision+1,approver_id=${action==='approve'?actor.id:v.approver_id}::uuid WHERE id=${id}::uuid`;
  });await this.audit(actor,'KNOWLEDGE_'+action.toUpperCase(),id,status);return{status};
 }
 async auditList(actor:Actor){await this.assertActor(actor,'AI_AUDIT_READ');return this.db.$queryRaw<any[]>`SELECT id,audience,action,entity_id,outcome,details,created_at FROM ai.audit_event ORDER BY created_at DESC LIMIT 100`;}
}
