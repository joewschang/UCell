import {PeriodProjectionService} from '../src/modules/analytics/period-projection.service';
import {randomUUID} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {cpus,totalmem} from 'node:os';
import {performance} from 'node:perf_hooks';
import {PrismaService,Prisma} from '@ucell/database';
import {BinaryTreeService,TreePrincipal} from '../src/modules/binary-tree/binary-tree.service';
import {BinaryTreeReadService} from '../src/modules/binary-tree/binary-tree-read.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {projectPeriodFacts} from '../src/modules/analytics/period-projection-sources';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw Error('ISOLATED_DATABASE_REQUIRED');
const size=Number(process.env.UCELL_SCALE_SIZE??10000),shape=process.env.UCELL_SCALE_SHAPE??'balanced',samples=Number(process.env.UCELL_SCALE_SAMPLES??100);
if(![10000,100000,1000000].includes(size)||!['balanced','deep','skewed','wide'].includes(shape)||!Number.isInteger(samples)||samples<10||samples>200)throw Error('INVALID_SCALE_CONFIGURATION');
const db=new PrismaService(),commands=new BinaryTreeService(db,new IdempotencyService(db),new OrganizationService(db)),reader=new BinaryTreeReadService(db,commands);
afterAll(()=>db.$disconnect());

it('resumes read measurements on the explicitly retained synthetic dataset',async()=>{
 if(process.env.UCELL_SCALE_REUSE_DATABASE!==new URL(url!).pathname.slice(1))throw Error('EXPLICIT_REUSE_DATABASE_REQUIRED');
 const person=await db.person.findFirstOrThrow({where:{legalName:'SYNTHETIC SCALE '+size+' '+shape}});
 const session=await db.authSession.findFirstOrThrow({where:{personId:person.personId,provider:'ENTRA',roleCode:'SUPER_ADMIN',expiresAt:{gt:new Date()},revokedAt:null}});
 const p:TreePrincipal={personId:person.personId,provider:'ENTRA',subject:session.subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};
 const tree=await db.binaryTree.findFirstOrThrow({where:{treeName:'Scale '+size+' '+shape}});
 const slots=await db.treeCanonicalPosition.findMany({where:{binaryTreeId:tree.binaryTreeId}});
 const qid=(i:number)=>slots.find(s=>s.positionNo===i)!.occupantQualificationId!;
 expect(await db.binaryTreeMembership.count({where:{binaryTreeId:tree.binaryTreeId}})).toBe(size);
 const seedMs=null;
 await db.$executeRaw`ANALYZE organization.binary_tree_ancestry`;await db.$executeRaw`ANALYZE organization.binary_tree_membership`;
 await db.$executeRaw`ANALYZE organization.placement_tree_evidence`;await db.$executeRaw`ANALYZE membership.qualification_owner_interval`;
 const now=new Date().toISOString(),time={timezone:'Asia/Taipei' as const,asOf:now,knowledgeCutoff:now,periodStart:'2026-01-01T00:00:00.000Z',periodEnd:'2099-01-01T00:00:00.000Z'};
 const first=await reader.nodes(p,tree.binaryTreeId,time);expect(first.total).toBe(size);expect(first.items).toHaveLength(100);
 const timings:any={};
 async function measure(name:string,run:()=>Promise<unknown>){
  const ms:number[]=[];let payloadBytes=0,maxRss=process.memoryUsage().rss;
  const failures:Array<{ms:number;code:string}>=[];
  try{await run();}catch{} // Warm-up failures are captured in the measured attempts below.
  for(let i=0;i<samples;i++){const start=performance.now();try{const value=await run();ms.push(performance.now()-start);payloadBytes=Math.max(payloadBytes,Buffer.byteLength(JSON.stringify(value,(_k,v)=>typeof v==='bigint'?v.toString():v)));maxRss=Math.max(maxRss,process.memoryUsage().rss);}catch(error){failures.push({ms:performance.now()-start,code:(error as any).code??(error as Error).name});if(failures.length===3)break;}}
  ms.sort((a,b)=>a-b);const pct=(p:number)=>{if(!ms.length)return null;const x=(ms.length-1)*p,a=Math.floor(x);return ms[a]+(ms[Math.ceil(x)]-ms[a])*(x-a);};
  timings[name]={requestedSamples:samples,samples:ms.length,failures,p50Ms:pct(.5),p95Ms:pct(.95),p99Ms:pct(.99),maxMs:ms.at(-1),payloadBytes,maxProcessRssBytes:maxRss};
 }

 await measure('treeDetailBeforeProjection',()=>reader.detail(p,tree.binaryTreeId,time));
 const detail=await reader.detail(p,tree.binaryTreeId,time);
 expect(detail.result!.statistics.projectionStatus).toBe('STALE');
 expect(detail.result!.positions.find(p=>p.positionNo===4)!.descendantBalls).toBeNull();
 const projection=new PeriodProjectionService(db),job=await projection.request(p,detail.result!.statistics.query,'REBUILD',randomUUID());
 const projectionStarted=performance.now();expect(await projection.runOne()).toMatchObject({jobId:job.jobId,status:'COMPLETED'});const projectionBuildMs=performance.now()-projectionStarted;
 const ready=await reader.detail(p,tree.binaryTreeId,time);
 expect(ready.result!.statistics.projectionStatus).toBe('CURRENT');
 if(shape==='deep')expect(ready.result!.positions.find(p=>p.positionNo===4)!.descendantBalls).toBe(size-7);
 await measure('treeDetailProjected',()=>reader.detail(p,tree.binaryTreeId,time));

 await measure('snapshotPage2Service',()=>reader.nodes(p,tree.binaryTreeId,time,first.nextCursor!,first.snapshotToken!));
 await measure('nodeExpansionService',()=>reader.nodes(p,tree.binaryTreeId,time,undefined,first.snapshotToken!,qid(4)));
 await measure('periodTreeAggregateSource',()=>db.$transaction(tx=>projectPeriodFacts(tx,{metrics:['tree.monthly_new_balls'],time,dimensions:['binaryTreeId'],groupBy:['binaryTreeId'],filters:{binaryTreeId:tree.binaryTreeId},limit:100}),{timeout:120000}));
 const plan=await db.$queryRaw<any[]>`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT count(*) FROM organization.binary_tree_ancestry
  WHERE binary_tree_id=${tree.binaryTreeId}::uuid AND ancestor_qualification_id=${qid(4)}::uuid AND depth>0`;
 const [stats]=await db.$queryRaw<any[]>`SELECT count(*)::text ancestry_rows,max(depth) max_depth FROM organization.binary_tree_ancestry WHERE binary_tree_id=${tree.binaryTreeId}::uuid`;
 expect(Number(stats.ancestry_rows)).toBeLessThanOrEqual(size*4);
 const output={size,shape,seedMs,projectionBuildMs,hardware:{cpu:cpus()[0]?.model,logicalCpus:cpus().length,hostMemoryBytes:totalmem(),node:process.version},stats,timings,foundingPlan:plan[0]['QUERY PLAN'],
  workload:{synthetic:true,datasetReusedAfterInterruptedRun:true,bulkTopologyRevision:true,economicSourceEvents:0,carrySettlements:0,apiMeasurement:'SERVICE_PLUS_DB_NOT_HTTP_TRANSPORT',coverage:'Topology/first-placement counts/snapshot pagination; GPV and Carry populated-source workloads are separate required evidence.'}};
 const folder=join(process.cwd(),'../../../governance/next-generation/evidence');mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'tree-scale-'+size+'-'+shape+'-projection.json'),JSON.stringify(output,null,2));
 console.log('TREE_SCALE_RESULT '+JSON.stringify({size,shape,seedMs,timings}));
},14400000);
