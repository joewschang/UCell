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
it('measures real indexed synthetic tree reads without disabling schema guards',async()=>{
 const person=await db.person.create({data:{legalName:'SYNTHETIC SCALE '+size+' '+shape}}),subject=randomUUID();
 await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
 await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode:'SUPER_ADMIN',validFrom:new Date(Date.now()-1000)}});
 const session=await db.authSession.create({data:{personId:person.personId,provider:'ENTRA',subject,roleCode:'SUPER_ADMIN',tokenHash:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+4*3600000)}});
 const p:TreePrincipal={personId:person.personId,provider:'ENTRA',subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};
 const tree=(await commands.create(p,{treeName:'Scale '+size+' '+shape,reason:'Synthetic read benchmark'},randomUUID())).value;
 await commands.change(p,tree.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'Synthetic benchmark'},randomUUID());
 const prefix=randomUUID().slice(0,24),qid=(i:number)=>i<=3?tree.companyQualificationIds[i-1]:prefix+i.toString(16).padStart(12,'0');
 const seedStart=performance.now(),at=new Date();
 await db.$transaction(async tx=>{
  await tx.$executeRaw`CREATE TEMP TABLE scale_nodes ON COMMIT DROP AS
   WITH n AS(SELECT i,CASE WHEN i<8 THEN floor(log(2,i::numeric))::integer WHEN ${shape}='deep' THEN i-5
    WHEN ${shape}='skewed' THEN (i-8)/2+3 WHEN ${shape}='wide' THEN floor(log(2,((i-8)/4+2)::numeric))::integer+2 ELSE floor(log(2,i::numeric))::integer END depth,
    CASE WHEN i<8 THEN i WHEN ${shape} IN ('deep','skewed') THEN 4 WHEN ${shape}='wide' THEN 4+(i-8)%4 ELSE i >> (floor(log(2,i::numeric))::integer-2) END founder,
    (i-8)/4+2 local_index,(i-8)%4 branch FROM generate_series(4,${size}::integer) i),
   p AS(SELECT *,CASE WHEN i<8 THEN i/2 WHEN ${shape}='deep' THEN CASE WHEN i=8 THEN 4 ELSE i-1 END
    WHEN ${shape}='skewed' THEN CASE WHEN i<10 THEN 4 WHEN i%2=0 THEN i-2 ELSE i-3 END
    WHEN ${shape}='wide' THEN CASE WHEN local_index/2=1 THEN founder ELSE 8+(local_index/2-2)*4+branch END ELSE i/2 END parent_i
    FROM n)
   SELECT i,depth,founder,parent_i,(${prefix}||lpad(to_hex(i),12,'0'))::uuid qid,
    CASE WHEN parent_i=2 THEN ${qid(2)}::uuid WHEN parent_i=3 THEN ${qid(3)}::uuid ELSE (${prefix}||lpad(to_hex(parent_i),12,'0'))::uuid END parent_id,
    (CASE WHEN i<8 THEN CASE WHEN i%2=0 THEN 'LEFT' ELSE 'RIGHT' END WHEN ${shape}='deep' THEN 'LEFT'
     WHEN ${shape}='wide' THEN CASE WHEN local_index%2=0 THEN 'LEFT' ELSE 'RIGHT' END ELSE CASE WHEN i%2=0 THEN 'LEFT' ELSE 'RIGHT' END END)::organization."SideCode" side,
    (CASE WHEN founder<6 THEN 'LEFT' ELSE 'RIGHT' END)::organization."SideCode" root_side,
    (CASE WHEN founder%2=0 THEN 'LEFT' ELSE 'RIGHT' END)::organization."SideCode" second_side,
    (CASE WHEN i<8 THEN NULL WHEN ${shape}='deep' THEN 'LEFT' WHEN ${shape}='skewed' THEN CASE WHEN i=9 THEN 'RIGHT' ELSE 'LEFT' END
     WHEN ${shape}='wide' THEN CASE WHEN local_index >> (depth-3)=2 THEN 'LEFT' ELSE 'RIGHT' END
     ELSE CASE WHEN (i >> (depth-3))%2=0 THEN 'LEFT' ELSE 'RIGHT' END END)::organization."SideCode" founding_side
   FROM p`;
  await tx.$executeRaw`INSERT INTO membership.qualification(qualification_id,current_holder_person_id,plan_level_code,status,effective_at,updated_at)
   SELECT qid,${person.personId}::uuid,'STARTER','EFFECTIVE',${at},${at} FROM scale_nodes`;
  await tx.$executeRaw`INSERT INTO membership.qualification_owner_interval(owner_interval_id,qualification_id,owner_type,person_id,effective_from,source_type,source_id,evidence_hash)
   SELECT qid,qid,'MEMBER',${person.personId}::uuid,${at},'SYNTHETIC_SCALE',qid,repeat('a',64) FROM scale_nodes`;
  await tx.$executeRaw`INSERT INTO organization.placement_tree_evidence(placement_tree_evidence_id,binary_tree_id,qualification_id,parent_qualification_id,side,placement_kind,source_type,actor_type,reason,effective_at,topology_version,correlation_id,evidence_hash)
   SELECT qid,${tree.binaryTreeId}::uuid,qid,parent_id,side,'PLACEMENT','SYNTHETIC_SCALE','SYSTEM','Synthetic bulk read fixture',${at},3,qid,repeat('a',64) FROM scale_nodes`;
  await tx.$executeRaw`INSERT INTO organization.binary_tree_membership(qualification_id,binary_tree_id,effective_from,placement_tree_evidence_id)
   SELECT qid,${tree.binaryTreeId}::uuid,${at},qid FROM scale_nodes`;
  await tx.$executeRaw`INSERT INTO organization.sponsor_relationship(sponsor_relationship_id,sponsor_qualification_id,child_qualification_id,sponsor_sequence_no,effective_from)
   SELECT qid,${qid(1)}::uuid,qid,i-1,${at} FROM scale_nodes WHERE i BETWEEN 4 AND 7`;
  await tx.$executeRaw`INSERT INTO organization.binary_placement(binary_placement_id,parent_qualification_id,child_qualification_id,side,effective_from)
   SELECT qid,parent_id,qid,side,${at} FROM scale_nodes ORDER BY i`;
  await tx.$executeRaw`UPDATE organization.tree_canonical_position c SET occupant_qualification_id=n.qid,occupied_at=${at} FROM scale_nodes n
   WHERE c.binary_tree_id=${tree.binaryTreeId}::uuid AND c.position_no=n.i AND n.i BETWEEN 4 AND 7`;
  await tx.$executeRaw`INSERT INTO organization.founding_occupation_evidence(founding_occupation_evidence_id,binary_tree_id,position_no,qualification_id,initial_person_id,company_sponsor_qualification_id,sponsor_relationship_id,actual_sponsor_sequence_no,effective_at,evidence_hash)
   SELECT qid,${tree.binaryTreeId}::uuid,i,qid,${person.personId}::uuid,${qid(1)}::uuid,qid,i-1,${at},repeat('a',64) FROM scale_nodes WHERE i BETWEEN 4 AND 7`;
  await tx.$executeRaw`INSERT INTO organization.binary_tree_ancestry(binary_tree_id,ancestor_qualification_id,descendant_qualification_id,depth,first_side,effective_from)
   SELECT ${tree.binaryTreeId}::uuid,qid,qid,0,NULL,${at} FROM scale_nodes`;
  await tx.$executeRaw`INSERT INTO organization.binary_tree_ancestry(binary_tree_id,ancestor_qualification_id,descendant_qualification_id,depth,first_side,effective_from)
   SELECT ${tree.binaryTreeId}::uuid,v.ancestor,n.qid,v.depth,v.side,${at} FROM scale_nodes n CROSS JOIN LATERAL (VALUES
    (${qid(1)}::uuid,n.depth,n.root_side),
    (CASE WHEN n.founder<6 THEN ${qid(2)}::uuid ELSE ${qid(3)}::uuid END,n.depth-1,n.second_side),
    ((${prefix}||lpad(to_hex(n.founder),12,'0'))::uuid,n.depth-2,n.founding_side)
   ) v(ancestor,depth,side) WHERE v.depth>0`;
  await tx.binaryTree.update({where:{binaryTreeId:tree.binaryTreeId},data:{topologyVersion:3}});
  await tx.binaryTreeProjectionCheckpoint.update({where:{binaryTreeId:tree.binaryTreeId},data:{sourceVersion:3,dataThrough:at,status:'READY'}});
 },{timeout:3600000,maxWait:10000});
 const seedMs=performance.now()-seedStart;
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
 await measure('treeDetailService',()=>reader.detail(p,tree.binaryTreeId,time));
 let projectionBuildMs:number|null=null;
 if(size>10000){
  const detail=await reader.detail(p,tree.binaryTreeId,time),projection=new PeriodProjectionService(db);
  const job=await projection.request(p,detail.result!.statistics.query,'REBUILD',randomUUID());
  const started=performance.now();expect(await projection.runOne()).toMatchObject({jobId:job.jobId,status:'COMPLETED'});projectionBuildMs=performance.now()-started;
  expect((await reader.detail(p,tree.binaryTreeId,time)).result!.statistics.projectionStatus).toBe('CURRENT');
  await measure('treeDetailProjected',()=>reader.detail(p,tree.binaryTreeId,time));
 }

 await measure('snapshotPage2Service',()=>reader.nodes(p,tree.binaryTreeId,time,first.nextCursor!,first.snapshotToken!));
 await measure('nodeExpansionService',()=>reader.nodes(p,tree.binaryTreeId,time,undefined,first.snapshotToken!,qid(4)));
 await measure('periodTreeAggregateSource',()=>db.$transaction(tx=>projectPeriodFacts(tx,{metrics:['tree.monthly_new_balls'],time,dimensions:['binaryTreeId'],groupBy:['binaryTreeId'],filters:{binaryTreeId:tree.binaryTreeId},limit:100}),{timeout:120000}));
 const plan=await db.$queryRaw<any[]>`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT count(*) FROM organization.binary_tree_ancestry
  WHERE binary_tree_id=${tree.binaryTreeId}::uuid AND ancestor_qualification_id=${qid(4)}::uuid AND depth>0`;
 const [stats]=await db.$queryRaw<any[]>`SELECT count(*)::text ancestry_rows,max(depth) max_depth FROM organization.binary_tree_ancestry WHERE binary_tree_id=${tree.binaryTreeId}::uuid`;
 expect(Number(stats.ancestry_rows)).toBeLessThanOrEqual(size*4);
 const output={size,shape,seedMs,projectionBuildMs,hardware:{cpu:cpus()[0]?.model,logicalCpus:cpus().length,hostMemoryBytes:totalmem(),node:process.version},stats,timings,foundingPlan:plan[0]['QUERY PLAN'],
  workload:{synthetic:true,bulkTopologyRevision:true,economicSourceEvents:0,carrySettlements:0,apiMeasurement:'SERVICE_PLUS_DB_NOT_HTTP_TRANSPORT',coverage:'Topology/first-placement counts/snapshot pagination; GPV and Carry populated-source workloads are separate required evidence.'}};
 const folder=join(process.cwd(),'../../../governance/next-generation/evidence');mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'tree-scale-'+size+'-'+shape+'.json'),JSON.stringify(output,null,2));
 console.log('TREE_SCALE_RESULT '+JSON.stringify({size,shape,seedMs,timings}));
},14400000);
