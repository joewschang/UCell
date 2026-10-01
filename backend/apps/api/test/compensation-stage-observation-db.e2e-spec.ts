import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('COMPENSATION_STAGE_OBSERVATION_REAL_DB',()=>{
 let db:PrismaClient;beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});afterAll(()=>db?.$disconnect());
 const start=new Date('2020-01-01Z'),end=new Date('2020-02-01Z'),hash='a'.repeat(64);
 const observe=(rule:string,stage:string,at:Date)=>db.$queryRaw<Array<{observation_id:string;revision:number;stage:string;previous_stage:string|null;source_as_of:Date;observed_at:Date}>>`SELECT * FROM integration.ucell_observe_compensation_stage(${start},${end},${rule},${stage},${at},${hash})`;
 it('retains transitions and rejects stale reads even after unchanged refreshes',async()=>{
  const rule=randomUUID(),base=Date.now()-10000;
  const [first]=await observe(rule,'OPEN',new Date(base));expect(first).toMatchObject({revision:1,stage:'OPEN',previous_stage:null});expect(first.observed_at.getTime()).toBeGreaterThanOrEqual(base);
  const [same]=await observe(rule,'OPEN',new Date(base+2000));expect(same.observation_id).toBe(first.observation_id);
  const [stale]=await observe(rule,'PRECHECK',new Date(base+1000));expect(stale.observation_id).toBe(first.observation_id);
  const [next]=await observe(rule,'PRECHECK',new Date(base+3000));expect(next).toMatchObject({revision:2,stage:'PRECHECK',previous_stage:'OPEN'});
  const [blocked]=await observe(rule,'BLOCKED',new Date(base+4000));expect(blocked).toMatchObject({revision:3,previous_stage:'PRECHECK'});
  const [resume]=await observe(rule,'PRECHECK',new Date(base+5000));expect(resume).toMatchObject({revision:4,previous_stage:'BLOCKED'});
  const rows=await db.$queryRaw<any[]>`SELECT stage FROM integration.compensation_stage_observation WHERE rule_version_code=${rule} ORDER BY revision`;expect(rows.map(r=>r.stage)).toEqual(['OPEN','PRECHECK','BLOCKED','PRECHECK']);
  await expect(db.$executeRaw`UPDATE integration.compensation_stage_observation SET stage='CLOSED' WHERE observation_id=${first.observation_id}::uuid`).rejects.toThrow();
  await expect(db.$executeRaw`DELETE FROM integration.compensation_stage_observation WHERE observation_id=${first.observation_id}::uuid`).rejects.toThrow();
 });
 it('deduplicates concurrent identical observations and validates untrusted state/time',async()=>{
  const rule=randomUUID(),at=new Date(Date.now()-1000);const results=await Promise.all([observe(rule,'OPEN',at),observe(rule,'OPEN',at),observe(rule,'OPEN',at)]);expect(new Set(results.map(r=>r[0].observation_id)).size).toBe(1);
  for(const [stage,time] of [['UNKNOWN',at],['OPEN',new Date('2999-01-01Z')]] as const)await expect(observe(rule,stage,time)).rejects.toThrow('COMPENSATION_STAGE_OBSERVATION_INVALID');
 });
});
