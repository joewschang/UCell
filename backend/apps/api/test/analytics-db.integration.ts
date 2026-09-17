import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { mkdirSync,writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaService,captureParameters,replayHash } from '@ucell/database';
import { AuditService } from '../src/common/audit/audit.service';
import { AnalyticsController } from '../src/modules/analytics/analytics.controller';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { AnalyticsRefreshWorker } from '../src/modules/analytics/analytics.refresh';
import { AdminAuthenticationGuard } from '../src/modules/auth/admin-authentication.guard';
import { AdminRoleGuard } from '../src/modules/auth/admin-role.guard';
import { IdentityTokenService } from '../src/modules/auth/identity-token.service';
import { ANALYTICS_POLICY, DAY } from '../src/modules/analytics/analytics.policy';
import { addMonths, localDate, monthEndDate } from '../src/modules/analytics/analytics.history';

// Invoked only by management-analytics-test.mjs against a newly created disposable database.
describe('Management analytics PostgreSQL and HTTP evidence',()=>{
  const fixturePath=process.env.ANALYTICS_BROWSER_FIXTURE_PATH??resolve(tmpdir(),`ucell-analytics-browser-fixture-${process.pid}.json`);
  const db=new PrismaService(),actor=randomUUID(),oldOwner=randomUUID(),newOwner=randomUUID(),newPerson=randomUUID(),root=randomUUID();
  const chain=Array.from({length:13},()=>randomUUID());let app:NestFastifyApplication,service:AnalyticsService;
  const days=(n:number)=>new Date(Date.now()-n*DAY);
  beforeAll(async()=>{
    if(!process.env.DATABASE_URL?.includes('/ucell_analytics_test_'))throw new Error('ISOLATED_ANALYTICS_TEST_DATABASE_REQUIRED');
    await db.$connect();
    await db.person.createMany({data:[{personId:actor,legalName:'Analytics TEST root',createdAt:days(120),membershipState:'FORMAL_MEMBER',status:'EFFECTIVE'},
      {personId:oldOwner,legalName:'Analytics TEST former owner',createdAt:days(120),membershipState:'FORMAL_MEMBER',status:'EFFECTIVE'},
      {personId:newOwner,legalName:'Analytics TEST current owner',createdAt:days(60),membershipState:'FORMAL_MEMBER',status:'EFFECTIVE'},
      {personId:newPerson,legalName:'Analytics TEST new',createdAt:days(10),membershipState:'NETWORK_MEMBER',status:'EFFECTIVE'}]});
    await db.qualification.createMany({data:[{qualificationId:root,currentHolderPersonId:actor,planLevelCode:'STARTER',status:'EFFECTIVE',createdAt:days(100)},
      ...chain.map(qualificationId=>({qualificationId,currentHolderPersonId:newOwner,planLevelCode:'STARTER',status:'EFFECTIVE' as const,createdAt:days(60)}))]});
    for(let i=0;i<chain.length;i++)await db.sponsorRelationship.create({data:{sponsorQualificationId:i===0?root:chain[i-1],childQualificationId:chain[i],sponsorSequenceNo:1,effectiveFrom:days(60)}});
    await db.binaryPlacement.create({data:{parentQualificationId:root,childQualificationId:chain[0],side:'LEFT',effectiveFrom:days(60)}});
    await db.qualificationHolderHistory.createMany({data:[{qualificationId:chain[0],holderPersonId:oldOwner,effectiveFrom:days(100),effectiveTo:days(2),sourceType:'TEST'},
      {qualificationId:chain[0],holderPersonId:newOwner,effectiveFrom:days(2),sourceType:'TEST'}]});
    await db.activePeriod.create({data:{qualificationId:chain[0],activeFrom:days(10),activeTo:days(-10),sourceType:'TEST',ruleVersionCode:'R1.0B'}});
    await db.order.create({data:{qualificationId:chain[0],purpose:'REPURCHASE',status:'PAID',paidAt:days(5),grossAmount:100,netAmount:100,ruleVersionCode:'R1.0B'}});
    const module=await Test.createTestingModule({controllers:[AnalyticsController],providers:[AnalyticsService,AnalyticsRefreshWorker,AuditService,{provide:PrismaService,useValue:db},
      {provide:ConfigService,useValue:{get:()=>undefined}},
      {provide:IdentityTokenService,useValue:{authenticate:async(role:string)=>({personId:actor,subject:'test',role})}},
      {provide:APP_GUARD,useClass:AdminAuthenticationGuard},{provide:APP_GUARD,useClass:AdminRoleGuard}]}).compile();
    service=module.get(AnalyticsService);app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');await app.init();await app.getHttpAdapter().getInstance().ready();
  },30000);
  afterAll(async()=>{await app?.close();await db.$disconnect();});
  const request=(method:'GET'|'POST',path:string,role?:string,payload?:object,key?:string)=>app.inject({method,url:'/api/v1/admin/analytics'+path,headers:{...(role?{authorization:'Bearer '+role}:{}),...(key?{'idempotency-key':key}:{})},payload});

  test('401 unauthenticated; 403 unrelated role; finance cannot rebuild or drill down',async()=>{
    expect((await request('GET','/overview')).statusCode).toBe(401);
    expect((await request('GET','/overview','CUSTOMER_SERVICE')).statusCode).toBe(403);
    expect((await request('POST','/rebuild','FINANCE',{},randomUUID())).statusCode).toBe(403);
    expect((await request('GET',`/sonar/sponsor/${root}/contributors?generation=1`,'FINANCE')).statusCode).toBe(403);
  });
  test('empty projection is unavailable; invalid input rejected before projection writes',async()=>{
    expect((await request('GET','/overview','SUPER_ADMIN')).json().data.status).toBe('UNAVAILABLE');
    expect((await request('GET',`/sonar/invalid/${root}`,'SUPER_ADMIN')).statusCode).toBe(400);
    expect((await request('POST','/rebuild','SUPER_ADMIN',{asOf:'1900-01-01'},randomUUID())).statusCode).toBe(400);
    expect((await request('POST','/rebuild','SUPER_ADMIN',{})).statusCode).toBe(400);
  });
  test('real source capture preserves transfer-time attribution and core counts; append-only + idempotency',async()=>{
    const before={people:await db.person.count(),orders:await db.order.count(),awards:await db.bonusAward.count(),pv:await db.pvLedger.count()};
    const key=randomUUID(),response=await request('POST','/rebuild','SUPER_ADMIN',{rootQualificationId:root},key);
    expect(response.statusCode).toBe(201);expect(response.json().data.replayed).toBe(false);
    const overview=await request('GET','/overview','FINANCE'),data=overview.json().data;
    expect(data).toMatchObject({status:'AVAILABLE',total:4,counts:{N:1,A:1,S:1,L:1},transitions:null});
    // The current owner remains S; the former owner receives the five-day-old payment activity.
    const [internal]=await db.$queryRaw<any[]>`SELECT payload FROM integration.management_analytics_snapshot WHERE snapshot_id=${key}::uuid`;
    expect(internal.payload.nasl.states[oldOwner].state).toBe('A');expect(internal.payload.nasl.states[newOwner].state).toBe('S');
    expect(JSON.stringify(data)).not.toContain(oldOwner);expect(JSON.stringify(data)).not.toContain('Analytics TEST');
    const sponsor=(await request('GET',`/sonar/sponsor/${root}`,'FINANCE')).json().data;
    expect(sponsor.generations).toHaveLength(12);expect(sponsor.total.qualificationCount).toBe(12);expect(sponsor.total.personCount).toBe(1);
    expect(sponsor.generations[0].activeRate).toBe(1);expect(sponsor.total.qualificationIds).toBeUndefined();expect(sponsor.health.score).toBeNull();
    const binary=(await request('GET',`/sonar/binary/${root}`,'FINANCE')).json().data;
    expect(binary.total.qualificationCount).toBe(1);expect(binary.left.qualificationCount).toBe(1);expect(binary.right.qualificationCount).toBe(0);
    const replay=await request('POST','/rebuild','SUPER_ADMIN',{rootQualificationId:root},key);expect(replay.json().data.replayed).toBe(true);
    expect((await request('POST','/rebuild','SUPER_ADMIN',{},key)).statusCode).toBe(409);
    const after={people:await db.person.count(),orders:await db.order.count(),awards:await db.bonusAward.count(),pv:await db.pvLedger.count()};expect(after).toEqual(before);
    expect(await db.auditEvent.count({where:{action:'MANAGEMENT_ANALYTICS_PROJECTED'}})).toBe(1);
    await expect(db.$executeRaw`UPDATE integration.management_analytics_snapshot SET source_hash='changed' WHERE snapshot_id=${key}::uuid`).rejects.toThrow('APPEND_ONLY');
    await expect(db.$executeRaw`DELETE FROM integration.management_analytics_snapshot WHERE snapshot_id=${key}::uuid`).rejects.toThrow('APPEND_ONLY');
  });
  test('second capture exposes transitions; daily history, scoped drilldown, bounded root search',async()=>{
    await service.rebuild(randomUUID(),root,actor,actor);
    const overview=(await request('GET','/overview','SUPER_ADMIN')).json().data;
    expect(overview.transitions.matrix).toEqual({'N->N':1,'A->A':1,'S->S':1,'L->L':1});
    const history=(await request('GET','/nasl/history','SUPER_ADMIN')).json().data;
    expect(history.rows).toHaveLength(1);expect(history.rows[0].counts).toEqual(overview.counts);
    const contributors=(await request('GET',`/sonar/sponsor/${root}/contributors?generation=12`,'MEMBERSHIP_OPS')).json().data;
    expect(contributors.qualificationIds).toEqual([chain[11]]);
    expect((await request('GET',`/sonar/sponsor/${root}/contributors?generation=13`,'MEMBERSHIP_OPS')).statusCode).toBe(400);
    const roots=(await request('GET','/roots','FINANCE')).json().data;expect(roots).toHaveLength(14);expect(Object.keys(roots[0])).toEqual(['id','label']);
    mkdirSync(resolve(fixturePath,'..'),{recursive:true});
    writeFileSync(fixturePath,JSON.stringify({label:'ISOLATED_TEST_FIXTURE_NOT_BUSINESS_DATA',root,overview,history,roots,
      sponsor:(await request('GET',`/sonar/sponsor/${root}`,'SUPER_ADMIN')).json().data,
      binary:(await request('GET',`/sonar/binary/${root}`,'SUPER_ADMIN')).json().data,contributors,
      cohorts:(await request('GET','/nasl/cohorts','SUPER_ADMIN')).json().data,
      versions:(await request('GET','/policy-versions','SUPER_ADMIN')).json().data,
      refresh:(await request('GET','/refresh/status','SUPER_ADMIN')).json().data},null,2));
  });
  test('HTTP history rejects malformed bounds and separates policies; month-end retention never exposes identities',async()=>{
    for(const query of ['from=2026-01-01','from=2026-02-30&to=2026-03-01','unexpected=true','from=x&from=y&to=z'])expect((await request('GET','/nasl/history?'+query,'FINANCE')).statusCode).toBe(400);
    const month=addMonths(localDate(new Date()).slice(0,7),-2),next=addMonths(month,1),end=addMonths(month,2);
    const version='HISTORY-TEST-v1';
    for(const [m,states] of [[month,{one:{state:'A',joinedMonth:month},two:{state:'S',joinedMonth:month}}],[next,{one:{state:'A',joinedMonth:month}}]] as const){
      const at=new Date(`${monthEndDate(m)}T23:55:00+08:00`),payload={nasl:{states,summary:{total:2,counts:{N:0,A:1,S:1,L:0}}},policy:{version},issues:[],comparisonAsOf:null};
      await db.$executeRaw`INSERT INTO integration.management_analytics_snapshot(snapshot_id,actor_key,scope_key,as_of,policy_version,source_hash,payload) VALUES(${randomUUID()}::uuid,'TEST','GLOBAL',${at},${version},'TEST',${JSON.stringify(payload)}::jsonb)`;
    }
    const query=`?from=${month}-01&to=${end}-01&policyVersion=${version}`;
    const history=await request('GET','/nasl/history'+query,'FINANCE');expect(history.statusCode).toBe(200);expect(history.json().data.rows).toHaveLength(2);
    const result=await request('GET','/nasl/cohorts'+query,'FINANCE');expect(result.statusCode).toBe(200);
    const cohort=result.json().data.rows[0];expect(cohort.baselineSize).toBe(2);expect(cohort.cells[0].activeShare).toBe(.5);expect(cohort.cells[1]).toMatchObject({status:'PARTIAL',missing:1,activeShare:null,activeRetention:null});
    expect(JSON.stringify(result.json())).not.toContain('"one"');expect(JSON.stringify(result.json())).not.toContain('"states"');
    const empty=await request('GET',`/nasl/history?from=${month}-01&to=${end}-01&policyVersion=ABSENT`,'FINANCE');expect(empty.json().data.rows).toEqual([]);
    expect((await request('GET','/policy-versions','FINANCE')).json().data).toEqual(expect.arrayContaining([version,ANALYTICS_POLICY.version]));
  });
  test('saved historical ledger projection honors reversals, ignores current paths, and returns corrected settled carry',async()=>{
    const occurredAt=days(3),event=await db.pvLedger.create({data:{qualificationId:chain[1],pvType:'GPV',amount:'100.1234',sourceType:'TEST',sourceId:randomUUID(),eventType:'GPV_CREATED',ruleVersionCode:'R1.0B',occurredAt,correlationId:randomUUID()}});
    await db.pvLedger.create({data:{qualificationId:chain[1],pvType:'GPV',amount:'-20',sourceType:'TEST',sourceId:randomUUID(),eventType:'GPV_REVERSAL',ruleVersionCode:'R1.0B',occurredAt:days(1),reversalOfEventId:event.eventId,correlationId:randomUUID()}});
    const envelope={format:'UCELL_HISTORICAL_REPLAY_V1',kind:'GPV',sourceId:event.eventId,ruleVersionCode:'R1.0B',at:occurredAt.toISOString(),parameters:await captureParameters(db as any,occurredAt,'R1.0B'),recipients:[],
      evidence:{at:occurredAt.toISOString(),sourceQualification:{qualificationId:chain[1]},sponsor:[{childQualificationId:chain[1],sponsorQualificationId:root}],binary:[{childQualificationId:chain[1],parentQualificationId:root,side:'RIGHT'}]},inputs:{volume:event.amount.toString()}};
    await db.historicalReplaySnapshot.create({data:{kind:'GPV',sourceId:event.eventId,ruleVersionCode:'R1.0B',content:envelope as any,hash:replayHash(envelope)}});
    const periodEnd=days(2),batch=await db.settlementBatch.create({data:{settlementType:'BINARY_K1',periodStart:days(9),periodEnd,ruleVersionCode:'R1.0B',status:'FINALIZED',finalizedAt:days(1)}});
    await db.binaryCarry.create({data:{qualificationId:root,periodEnd,ruleVersionCode:'R1.0B',leftCarryIn:0,rightCarryIn:0,leftPeriodGpv:100,rightPeriodGpv:20,pairedPv:20,leftCarryOut:80,rightCarryOut:0,weeklyCapSnapshot:100}});
    await db.replayCarryProjection.create({data:{actionKey:randomUUID(),settlementBatchId:batch.settlementBatchId,periodEnd,ruleVersionCode:'R1.0B',carry:{[root]:{left:'60',right:'0'}},stateHash:'ISOLATED_TEST'}});
    const before=await db.pvLedger.count();await service.rebuild(randomUUID(),root,actor,actor);expect(await db.pvLedger.count()).toBe(before);
    const sponsor=(await request('GET',`/sonar/sponsor/${root}/volumes`,'FINANCE')).json().data;
    expect(sponsor.status).toBe('AVAILABLE');expect(sponsor.volumes[0].generations[0].net).toBe('80.1234');expect(sponsor.volumes[0].generations[1].net).toBe('0.0000');expect(sponsor.carry).toBeNull();
    const binary=(await request('GET',`/sonar/binary/${root}/volumes`,'FINANCE')).json().data;
    expect(binary.volumes[0].right.net).toBe('80.1234');expect(binary.carry).toMatchObject({status:'AVAILABLE',left:'60.0000',originalLeft:'80.0000',basis:'LATEST_REPLAY_CORRECTION'});
    expect(JSON.stringify(binary)).not.toContain(chain[1]);expect(JSON.stringify(binary)).not.toContain(event.eventId);
    expect((await request('GET',`/sonar/binary/${root}/volumes`,'CUSTOMER_SERVICE')).statusCode).toBe(403);
    const fs=await import('fs');const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));fs.writeFileSync(fixturePath,JSON.stringify({...fixture,volumeSponsor:sponsor,volumeBinary:binary},null,2));
    await db.pvLedger.create({data:{qualificationId:root,pvType:'EPV',amount:5,sourceType:'TEST',sourceId:randomUUID(),eventType:'EPV_CREATED',ruleVersionCode:'R1.0B',occurredAt:days(1),correlationId:randomUUID()}});
    await service.rebuild(randomUUID(),root,actor,actor);
    expect((await request('GET',`/sonar/sponsor/${root}/volumes`,'FINANCE')).json().data).toMatchObject({status:'UNAVAILABLE',reason:'HISTORICAL_VOLUME_EVIDENCE_INCOMPLETE',volumes:null});
    expect((await request('GET','/overview','FINANCE')).json().data.status).toBe('AVAILABLE');
  });
  test('automatic refresh persists SYSTEM audit and replays the same time bucket across workers',async()=>{
    const config={get:(key:string)=>key==='UCELL_ANALYTICS_REFRESH_ENABLED'?'true':undefined} as ConfigService;
    const first=new AnalyticsRefreshWorker(service,config),second=new AnalyticsRefreshWorker(service,config);
    await first.runOnce();const before=await db.auditEvent.count({where:{action:'MANAGEMENT_ANALYTICS_PROJECTED',actorType:'SYSTEM'}});
    await second.runOnce();expect(await db.auditEvent.count({where:{action:'MANAGEMENT_ANALYTICS_PROJECTED',actorType:'SYSTEM'}})).toBe(before);
    expect(before).toBe(1);expect((await second.status()).scopeFreshness[0].status).toBe('AVAILABLE');
    await first.onApplicationShutdown();await second.onApplicationShutdown();
  });
  test('concurrent projector lock rejects competing writer; missing owner history cannot become false inactivity',async()=>{
    await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(19670919,1301)::text`;
      await expect(service.rebuild(randomUUID(),root,actor,actor)).rejects.toThrow('REBUILD_IN_PROGRESS');
    });
    const key=randomUUID();await db.order.create({data:{qualificationId:chain[1],status:'PAID',paidAt:days(1),grossAmount:1,netAmount:1,ruleVersionCode:'R1.0B'}});
    await expect(service.rebuild(key,root,actor,actor)).rejects.toThrow('EVENT_OWNER_UNAVAILABLE');
    const rows=await db.$queryRaw<any[]>`SELECT snapshot_id FROM integration.management_analytics_snapshot WHERE snapshot_id=${key}::uuid`;expect(rows).toHaveLength(0);
  });
});
