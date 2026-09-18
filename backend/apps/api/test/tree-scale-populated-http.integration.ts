import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaService,Prisma,replayHash,captureParameters} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {BinaryTreeService,TreePrincipal} from '../src/modules/binary-tree/binary-tree.service';
import {BinaryTreeReadController} from '../src/modules/binary-tree/binary-tree-read.controller';
import {BinaryTreeReadService} from '../src/modules/binary-tree/binary-tree-read.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
import {ApiExceptionFilter} from '../src/common/filters/api-exception.filter';
import {PeriodProjectionService} from '../src/modules/analytics/period-projection.service';
import {projectPeriodFacts} from '../src/modules/analytics/period-projection-sources';
import {readFoundingCarry} from '../src/modules/binary-tree/binary-tree-metrics';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1))||(process.env.UCELL_SCALE_SEED!=='true'&&process.env.UCELL_SCALE_REUSE_DATABASE!==new URL(url).pathname.slice(1)))throw Error('EXPLICIT_SYNTHETIC_DATABASE_REQUIRED');
const size=Number(process.env.UCELL_SCALE_SIZE??1000000),shape=process.env.UCELL_SCALE_SHAPE??'deep';
if(!['balanced','deep','skewed','wide'].includes(shape))throw Error('INVALID_SCALE_SHAPE');
if(![10000,100000,1000000].includes(size))throw Error('INVALID_SCALE_SIZE');
if(process.env.UCELL_SCALE_SEED==='true')require('./tree-scale.integration');
const db=new PrismaService(),tokens=new IdentityTokenService(db),commands=new BinaryTreeService(db,new IdempotencyService(db),new OrganizationService(db)),reader=new BinaryTreeReadService(db,commands);
let app:NestFastifyApplication;
afterAll(async()=>{await app?.close();await db.$disconnect();});
it('measures populated million-node deep tree with real loopback HTTP and authoritative stored Carry',async()=>{
 const tree=await db.binaryTree.findFirstOrThrow({where:{treeName:'Scale '+size+' '+shape}});
 expect(await db.binaryTreeMembership.count({where:{binaryTreeId:tree.binaryTreeId}})).toBe(size);
 const person=await db.person.findFirstOrThrow({where:{legalName:'SYNTHETIC SCALE '+size+' '+shape}});
 const link=await db.identityLink.findFirstOrThrow({where:{personId:person.personId,provider:'ENTRA'}});
 const session=await tokens.issue({provider:'ENTRA',subject:link.providerSubject,personId:person.personId,roleCode:'SUPER_ADMIN',ttlSeconds:7200});
 const p:TreePrincipal={provider:'ENTRA',personId:person.personId,subject:link.providerSubject,role:'SUPER_ADMIN',sessionId:session.sessionId};
 const slots=await db.treeCanonicalPosition.findMany({where:{binaryTreeId:tree.binaryTreeId,positionNo:{gte:4}},orderBy:{positionNo:'asc'}});
 const seedStart=performance.now(),at=new Date();
 // Storage/read benchmark fixture, not a replacement for Core calculation Golden.
 await db.$executeRaw`INSERT INTO ledger.pv_ledger(event_id,qualification_id,pv_type,amount,source_type,source_id,source_line_id,event_type,rule_version_code,occurred_at,correlation_id)
 SELECT m.qualification_id,m.qualification_id,'GPV',100,'SYNTHETIC_SCALE_READ',m.qualification_id,m.qualification_id,'GPV_CREATED','R1.0B',${at},m.qualification_id
 FROM organization.binary_tree_membership m WHERE m.binary_tree_id=${tree.binaryTreeId}::uuid
 AND NOT EXISTS(SELECT 1 FROM ledger.pv_ledger e WHERE e.event_id=m.qualification_id)`;
 const [pv]=await db.$queryRaw<any[]>`SELECT count(*)::text n,min(occurred_at) first_at FROM ledger.pv_ledger WHERE source_type='SYNTHETIC_SCALE_READ'`;
 expect(pv.n).toBe(String(size));
 const periodEnd=new Date(),parameters=await captureParameters(db as unknown as Prisma.TransactionClient,periodEnd,'R1.0B');
 const batch=await db.settlementBatch.create({data:{settlementType:'BINARY_K1',periodStart:at,periodEnd,ruleVersionCode:'R1.0B',status:'FINALIZED',finalizedAt:periodEnd,parameterSnapshot:parameters as any}});
 const carryRecipients=[];
 for(const slot of slots){
  const carry=await db.binaryCarry.create({data:{qualificationId:slot.occupantQualificationId!,periodEnd,leftCarryIn:0,rightCarryIn:0,leftPeriodGpv:1234,rightPeriodGpv:234,pairedPv:234,leftCarryOut:1000,rightCarryOut:0,weeklyCapSnapshot:1500000,ruleVersionCode:'R1.0B'}});
  carryRecipients.push(JSON.parse(JSON.stringify(carry)));
 }
 const content={format:'UCELL_HISTORICAL_REPLAY_V1',kind:'BINARY_K1',sourceId:batch.settlementBatchId,ruleVersionCode:'R1.0B',at:periodEnd.toISOString(),parameters,recipients:[],evidence:{carryRecipients,fixture:'SYNTHETIC_READ_BENCHMARK_NOT_CORE_CALCULATION'},inputs:{}};
 await db.historicalReplaySnapshot.create({data:{kind:'BINARY_K1',sourceId:batch.settlementBatchId,ruleVersionCode:'R1.0B',content:content as any,hash:replayHash(content)}});
 await db.$executeRaw`ANALYZE ledger.pv_ledger`;await db.$executeRaw`ANALYZE ledger.binary_carry`;
 const seedMs=performance.now()-seedStart,now=new Date().toISOString(),time={timezone:'Asia/Taipei' as const,asOf:now,knowledgeCutoff:now,periodStart:'2026-01-01T00:00:00.000Z',periodEnd:'2099-01-01T00:00:00.000Z'};
 const detail=await reader.detail(p,tree.binaryTreeId,time),projections=new PeriodProjectionService(db);
 const job=await projections.request(p,detail.result!.statistics.query,'REBUILD',randomUUID()),begin=performance.now();
 expect(await projections.runOne()).toMatchObject({jobId:job.jobId,status:'COMPLETED'});
 const projectionBuildMs=performance.now()-begin,ready=await reader.detail(p,tree.binaryTreeId,time),founding=ready.result!.positions.find(r=>r.positionNo===4)!;
 let expectedDescendants=0;
 for(let i=8;i<=size;i++){const founder=shape==='deep'||shape==='skewed'?4:shape==='wide'?4+(i-8)%4:i>>(Math.floor(Math.log2(i))-2);if(founder===4)expectedDescendants++;}
 expect(ready.result!.statistics.projectionStatus).toBe('CURRENT');expect(founding.descendantBalls).toBe(expectedDescendants);
 expect(new Prisma.Decimal(founding.performance!.value!.cumulative).eq(expectedDescendants*100)).toBe(true);
 expect(founding.carry).toMatchObject({status:'AVAILABLE',value:{left:'1000.0000',right:'0.0000',pairedPv:'234.0000'}});
 const module=await Test.createTestingModule({controllers:[BinaryTreeReadController],providers:[{provide:BinaryTreeReadService,useValue:reader},{provide:BinaryTreeService,useValue:commands},{provide:PrismaService,useValue:db},{provide:IdentityTokenService,useValue:tokens},{provide:ConfigService,useValue:{get:(key:string)=>key==='NODE_ENV'?'production':'false'}},AdminAuthenticationGuard,AdminRoleGuard]}).compile();
 app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalGuards(module.get(AdminAuthenticationGuard),module.get(AdminRoleGuard));app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalInterceptors(new EnvelopeInterceptor());app.useGlobalFilters(new ApiExceptionFilter());await app.listen(0,'127.0.0.1');
 const base=await app.getUrl(),route='/api/v1/admin/organization/trees/'+tree.binaryTreeId,headers={authorization:'Bearer '+session.accessToken};
 const get=async(path:string)=>{const r=await fetch(base+path,{headers});expect(r.status).toBe(200);return r.json();};
 const qs=new URLSearchParams(time),first=(await get(route+'/nodes?'+qs)).data;
 const timings:any={};
 async function measure(name:string,run:()=>Promise<unknown>,samples=100){
  const ms:number[]=[];let bytes=0,rss=process.memoryUsage().rss;await run();
  for(let i=0;i<samples;i++){const start=performance.now(),value=await run();ms.push(performance.now()-start);bytes=Math.max(bytes,Buffer.byteLength(JSON.stringify(value)));rss=Math.max(rss,process.memoryUsage().rss);}
  ms.sort((a,b)=>a-b);const pct=(p:number)=>{const x=(ms.length-1)*p,a=Math.floor(x);return ms[a]+(ms[Math.ceil(x)]-ms[a])*(x-a);};
  timings[name]={samples,p50Ms:pct(.5),p95Ms:pct(.95),p99Ms:pct(.99),maxMs:ms.at(-1),payloadBytes:bytes,maxNodeRssBytes:rss};
 }
 await measure('projectedTreeDetailHttp',()=>get(route+'?'+qs));
 await measure('snapshotPage2Http',()=>get(route+'/nodes?'+qs+'&after='+first.nextCursor+'&snapshotToken='+first.snapshotToken));
 await measure('nodeExpansionHttp',()=>get(route+'/nodes?'+qs+'&snapshotToken='+first.snapshotToken+'&parentQualificationId='+slots[0].occupantQualificationId));
 await measure('authoritativeCarryService',()=>db.$transaction(tx=>readFoundingCarry(tx,slots[0].occupantQualificationId!,time)));
 await measure('monthlyNewBallsDbSource',()=>db.$transaction(tx=>projectPeriodFacts(tx,{metrics:['tree.monthly_new_balls'],time,filters:{binaryTreeId:tree.binaryTreeId},dimensions:['binaryTreeId'],groupBy:['binaryTreeId'],limit:100}),{timeout:120000}),20);
 const plan=await db.$queryRaw<any[]>`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT sum(e.amount) FROM ledger.pv_ledger e JOIN organization.binary_tree_ancestry a ON a.descendant_qualification_id=e.qualification_id
 WHERE a.binary_tree_id=${tree.binaryTreeId}::uuid AND a.ancestor_qualification_id=${slots[0].occupantQualificationId}::uuid AND a.depth>0 AND e.pv_type='GPV' AND e.event_type='GPV_CREATED' AND e.occurred_at<=${new Date(now)}`;
 const output={size,shape,seedMs,projectionBuildMs,timings,gpvQueryPlan:plan[0]['QUERY PLAN'],workload:{economicSourceEvents:size,carryRows:4,http:'REAL_LOOPBACK_TCP_AUTH_GUARDS_DTO_ENVELOPE',fixture:'SYNTHETIC_STORED_VALUES_NOT_ENGINE_THROUGHPUT',productionClaim:false,dbMemory:'MEASURE_EXTERNALLY',monthlySamples:20}};
 writeFileSync('../../../governance/next-generation/evidence/tree-scale-'+size+'-'+shape+'-populated-http.json',JSON.stringify(output,null,2));
 console.log('TREE_POPULATED_HTTP_SCALE_PASS '+JSON.stringify({projectionBuildMs,timings}));
},14400000);
