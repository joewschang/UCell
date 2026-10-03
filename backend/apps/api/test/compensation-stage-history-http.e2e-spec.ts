import 'reflect-metadata';
import {Test} from '@nestjs/testing';
import {APP_GUARD} from '@nestjs/core';
import {ConfigService} from '@nestjs/config';
import {UnauthorizedException,ValidationPipe} from '@nestjs/common';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaService} from '@ucell/database';
import {CompensationStageHistoryController} from '../src/modules/settlement-jobs/compensation-stage-history.controller';
import {CompensationStageHistoryService} from '../src/modules/settlement-jobs/compensation-stage-history.service';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../src/common/audit/audit.service';
import {CompensationPeriodControlService} from '../src/modules/settlement-jobs/compensation-period-control.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('COMPENSATION_STAGE_HISTORY_HTTP_REAL_DB',()=>{
 let app:NestFastifyApplication,db:PrismaService;const actor=randomUUID();const period={periodStart:'2026-09-01T00:00:00Z',periodEnd:'2026-10-01T00:00:00Z',ruleVersionCode:'R1.0B'};const query='?'+new URLSearchParams(period);
 beforeAll(async()=>{db=new PrismaService();await db.$connect();const module=await Test.createTestingModule({controllers:[CompensationStageHistoryController],providers:[CompensationStageHistoryService,CompensationPeriodControlService,AuditService,{provide:PrismaService,useValue:db},{provide:ConfigService,useValue:{get:(key:string)=>key==='NODE_ENV'?'production':undefined}},{provide:IdentityTokenService,useValue:{authenticate:async(role:string)=>({role:role==='NO_ACTOR'?'FINANCE':role,personId:role==='NO_ACTOR'?undefined:actor})}},{provide:APP_GUARD,useClass:AdminAuthenticationGuard},{provide:APP_GUARD,useClass:AdminRoleGuard}]}).compile();app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalInterceptors(new EnvelopeInterceptor());await app.init();await app.getHttpAdapter().getInstance().ready();});
 afterAll(async()=>{await app?.close();await db?.$disconnect();});
 const read=(suffix=query,role?:string)=>app.inject({method:'GET',url:'/api/v1/admin/compensation-period-control/stage-history'+suffix,headers:role?{authorization:'Bearer '+role}:{}});
 const refresh=(role:string,payload:any=period)=>app.inject({method:'POST',url:'/api/v1/admin/compensation-period-control/stage-history/refresh',headers:{authorization:'Bearer '+role},payload});
 it('enforces real guards and rejects caller-supplied stages and unsafe pagination',async()=>{
  expect((await read()).statusCode).toBe(401);expect((await read(query,'CUSTOMER_SERVICE')).statusCode).toBe(403);expect((await refresh('COMPLIANCE_AUDIT')).statusCode).toBe(403);expect((await refresh('NO_ACTOR')).statusCode).toBe(401);
  for(const payload of [{...period,stage:'CLOSED'},{...period,observedAt:'2020-01-01Z'},{...period,periodEnd:period.periodStart}])expect((await refresh('FINANCE',payload)).statusCode).toBe(400);
  for(const suffix of ['',query+'&take=101',query+'&cursor=0',query+'&asOf=2999-01-01T00:00:00Z',query+'&privateId=bad'])expect((await read(suffix,'FINANCE')).statusCode).toBe(400);
 });
 it('performs audited refresh and returns a safe observation without claiming business entry time',async()=>{
  expect((await read(query,'COMPLIANCE_AUDIT')).json().data.items).toEqual([]);const response=await refresh('FINANCE');expect(response.statusCode).toBe(200);expect(response.json().data.item).toMatchObject({revision:1,businessEnteredAt:null,basis:'AUTHORITATIVE_CONTROL_OBSERVATION'});expect((await refresh('SUPER_ADMIN')).json().data.item.reference).toBe(response.json().data.item.reference);expect(await db.auditEvent.count({where:{action:'COMPENSATION_STAGE_REFRESHED'}})).toBe(2);const result=await read(query,'COMPLIANCE_AUDIT');expect(result.statusCode).toBe(200);expect(result.json().data.items).toHaveLength(1);expect(JSON.stringify(result.json())).not.toContain(actor);expect(result.json().data.coverage).toBe('CURRENT_PAGE_ONLY');
 });
 it('traverses recorded revisions under one cutoff while newer observations stay outside the snapshot',async()=>{
  // Synthetic stage sequence tests transport paging, not domain transition production.
  const rule='PAGING-'+randomUUID(),base=Date.now()-10000;
  const record=(stage:string,time:number)=>db.$queryRaw`SELECT * FROM integration.ucell_observe_compensation_stage(${new Date(period.periodStart)},${new Date(period.periodEnd)},${rule},${stage},${new Date(time)},${'a'.repeat(64)})`;
  for(const [i,stage] of ['OPEN','PRECHECK','BLOCKED'].entries())await record(stage,base+i);
  // PostgreSQL records microseconds; establish a later millisecond cutoff before
  // expecting all three committed observations in the first snapshot.
  await new Promise(resolve=>setTimeout(resolve,5));
  const q='?'+new URLSearchParams({...period,ruleVersionCode:rule,take:'1'}),first=await read(q,'FINANCE'),page=first.json().data;expect(first.statusCode).toBe(200);expect(page.items.map((r:any)=>r.revision)).toEqual([3]);expect(page.nextCursor).toBe(3);
  await new Promise(resolve=>setTimeout(resolve,5));await record('PRECHECK',base+3);
  const second=(await read(q+'&cursor=3&asOf='+encodeURIComponent(page.asOf),'FINANCE')).json().data;expect(second.items.map((r:any)=>r.revision)).toEqual([2]);expect(second.nextCursor).toBe(2);
  const last=(await read(q+'&cursor=2&asOf='+encodeURIComponent(page.asOf),'FINANCE')).json().data;expect(last.items.map((r:any)=>r.revision)).toEqual([1]);expect(last.nextCursor).toBeNull();
  expect((await read(q+'&asOf='+encodeURIComponent(page.asOf),'FINANCE')).json().data.items[0].revision).toBe(3);
  await new Promise(resolve=>setTimeout(resolve,5));
  expect((await read(q,'FINANCE')).json().data.items[0].revision).toBe(4);
 });
});
