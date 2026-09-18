import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { QualificationWorkflowService } from '../src/modules/qualification/qualification-workflow.service';
let evidence: any[];
beforeAll(() => {
 const root=resolve(__dirname,'../../../..'),directory=mkdtempSync(join(tmpdir(),'ucell-v060-'));
 const file=join(directory,'evidence.json');
 try {
  execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public',PHASE2_DB_EVIDENCE_PATH:file},timeout:30000});
  const run=JSON.parse(readFileSync(file,'utf8'));expect(run.result).toBe('PASS');evidence=run.results;
 } finally { rmSync(directory,{recursive:true,force:true}); }
},30000);
function actual(label:string){const row=evidence.find(item=>item.label===label);expect(row).toBeDefined();expect(row.result).toBe('PASS');expect(row.actual).toEqual(row.expected);return row.actual;}
function workflowHarness(workflow:any){
 const effectiveAt=new Date('2100-01-01T00:00:00Z'),currentPlan={qualificationPlanHistoryId:'plan-old'},currentHolder={holderHistoryId:'holder-old'};
 const tx:any={
      $queryRaw:jest.fn(async()=>[]),binaryTreeMembership:{findUnique:jest.fn(async()=>null)},qualificationWorkflow:{findUniqueOrThrow:jest.fn(async()=>workflow),update:jest.fn(async({data}:any)=>({...workflow,...data}))},qualificationPlanHistory:{findFirst:jest.fn(async()=>currentPlan),update:jest.fn(),create:jest.fn(async({data}:any)=>data)},qualificationHolderHistory:{findFirst:jest.fn(async()=>currentHolder),update:jest.fn(),create:jest.fn(async({data}:any)=>data)},qualification:{findUniqueOrThrow:jest.fn(async()=>({kind:'MEMBER_ORIGIN'})),update:jest.fn(async({data}:any)=>({qualificationId:workflow.qualificationId,...data}))},person:{findUnique:jest.fn(async({where}:any)=>({personId:where.personId}))},sponsorRelationship:{update:jest.fn(),create:jest.fn(),delete:jest.fn()},binaryPlacement:{update:jest.fn(),create:jest.fn(),delete:jest.fn()},bonusAward:{update:jest.fn(),delete:jest.fn()}};
 const statusService={transition:jest.fn()};
 return {effectiveAt,tx,statusService,service:new QualificationWorkflowService({$transaction:async(work:any)=>work(tx)} as any,statusService as any)};
}
describe('R1.0B FROZEN v0.6 invariants',()=>{
 it('return never mutates original Binary settlement',()=>expect(actual('all original Binary settlement batches unchanged')).toBe(true));
 it('return never mutates original Matching settlement',()=>{expect(actual('all original Matching settlement batches unchanged')).toBe(true);expect(actual('all original Matching award rows unchanged')).toBe(true);});
 it('replay uses original carry-in and reversal PV events',()=>{
  expect(actual('GPV reversal references original GPV event')).toBe(true);
  expect(actual('later reversal belongs to original historical week')).toBe(true);
  expect(actual('DB effective subtree honors partial return')).toBe('500');
  expect(actual('historical cap preserves nonzero left carry')).toBe('500');
  expect(actual('historical cap preserves nonzero right carry')).toBe('800');
 });
 it('positive delta creates compensating award',()=>{
  expect(actual('positive replay delta creates exact compensating award').slice(2)).toEqual(['REFERRAL','23.6364','23.6364']);
  actual('positive replay compensating award retains historical evidence');
  expect(actual('positive replay compensating award has one historical replay lifecycle')).toBe(1);
  actual('duplicate return creates no second posting compensating award or recovery');
  actual('K0 original award baseline preserved');
 });
 it('negative delta creates recovery',()=>{
  expect(actual('negative replay delta creates exact original award recovery').slice(3)).toEqual(['263.6364','263.6364','OPEN']);
  expect(actual('replay delta uses exactly one correction direction')).toEqual([null,null]);
  actual('duplicate return creates no second posting compensating award or recovery');
  actual('K0 original award baseline preserved');
 });
 it('future subscription recognition is cancelled, not deleted',()=>{expect(actual('subscription future rows cancelled')).toBe('CANCELLED');expect(actual('cancelled future recognition row retained')).toBe(1);});
 it('recognized RPV gets explicit reversal event',()=>{expect(actual('RPV one negative historical reversal')).toBe(1);actual('original RPV award rows unchanged');});
 it('upgrade has no retroactive bonus effect',async()=>{const workflow={qualificationWorkflowId:'upgrade',qualificationId:'ball-A',workflowType:'UPGRADE',status:'SUBMITTED',targetPlanCode:'LEADER',payload:{reviewFeePaid:true}},h=workflowHarness(workflow);await h.service.approve('upgrade',h.effectiveAt);expect(h.tx.qualificationPlanHistory.create).toHaveBeenCalledWith({data:expect.objectContaining({qualificationId:'ball-A',planCode:'LEADER',effectiveFrom:h.effectiveAt})});expect(h.tx.bonusAward.update).not.toHaveBeenCalled();expect(h.tx.bonusAward.delete).not.toHaveBeenCalled();});
 it('transfer preserves qualificationId and tree positions',async()=>{const workflow={qualificationWorkflowId:'transfer',qualificationId:'ball-A',workflowType:'TRANSFER',status:'SUBMITTED',receivingPersonId:'person-new',payload:{reviewFeePaid:true}},h=workflowHarness(workflow);await h.service.approve('transfer',h.effectiveAt);expect(h.tx.qualificationHolderHistory.create).toHaveBeenCalledWith({data:expect.objectContaining({qualificationId:'ball-A',holderPersonId:'person-new'})});for(const graph of [h.tx.sponsorRelationship,h.tx.binaryPlacement]){expect(graph.update).not.toHaveBeenCalled();expect(graph.create).not.toHaveBeenCalled();expect(graph.delete).not.toHaveBeenCalled();}});
 it('exit preserves qualification for company-held re-transfer',async()=>{const exit={qualificationWorkflowId:'exit',qualificationId:'ball-A',workflowType:'EXIT',status:'SUBMITTED',payload:{reviewFeePaid:true,companyHolderPersonId:'company'}},h=workflowHarness(exit);await h.service.approve('exit',h.effectiveAt);expect(h.tx.qualificationHolderHistory.create).toHaveBeenCalledWith({data:expect.objectContaining({qualificationId:'ball-A',holderPersonId:'company',sourceType:'QUALIFICATION_EXIT_COMPANY_HELD'})});expect(h.statusService.transition).toHaveBeenCalledWith(h.tx,'ball-A','EXITED',h.effectiveAt,'QUALIFICATION_EXIT','exit');for(const graph of [h.tx.sponsorRelationship,h.tx.binaryPlacement]){expect(graph.update).not.toHaveBeenCalled();expect(graph.create).not.toHaveBeenCalled();expect(graph.delete).not.toHaveBeenCalled();}});
});
