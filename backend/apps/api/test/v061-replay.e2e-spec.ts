import { execFileSync } from 'node:child_process';
import { QualificationWorkflowService } from '../src/modules/qualification/qualification-workflow.service';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { periodBinary, periodMatching, appendEntitlementDelta, verifyReplayEnvelope } from '@ucell/database';
import { binary, d, recipient, sealed } from './phase2-fixtures';

const volumes=()=>new Map([['left',d(800)],['right',d(1000)]]);
function matchingEnvelope() {
 const e=binary();
 e.kind='MATCHING_K2';
 const qualification=recipient().qualification;
 e.recipients=[recipient({awardType:'MATCHING',qualificationId:'sponsor-1',generation:1,sourceAwardId:'binary-award',rate:'.15',qualification})];
 e.evidence.matchingSources=[{
  sourceAwardId:'binary-award',sourceQualificationId:'binary-recipient',
  evidence:{
   at:e.at,
   sponsor:[{sponsorQualificationId:'sponsor-1',childQualificationId:'binary-recipient'}],
   binary:[{parentQualificationId:'binary-parent',childQualificationId:'binary-recipient',side:'LEFT'}],
   qualifications:{'binary-recipient':qualification,'sponsor-1':qualification,'binary-parent':qualification},
   effectiveDirectCounts:{'binary-recipient':0,'sponsor-1':4,'binary-parent':4},
  },
 }];
 return e;
}
describe('v0.6.1 deterministic replay',()=>{
 it('replay uses original carry-in, not current carry',()=>{const e=binary();expect(periodBinary(e,volumes(),new Map()).carryOut.get('root')!.left.toString()).toBe('800');});
 it('negative GPV reversal is included in historical period subtree GPV',()=>{expect(periodBinary(binary(),volumes(),new Map()).total.toString()).toBe('1800');});
 it('recomputed Pair respects original weekly cap',()=>{expect(periodBinary(binary(),volumes(),new Map()).payables.get('award')!.toString()).toBe('100');});
 it('K1 is recomputed with changed impacted theory and unchanged others',()=>{
  const e=binary();e.parameters.parameters.find(p=>p.code==='pool.binary.rate')!.value='.01';e.evidence.carryRecipients[0].leftCarryIn='0';e.evidence.carryRecipients[0].weeklyCapSnapshot='1000';
  e.recipients.push(recipient({key:'other',qualificationId:'root2'}));e.evidence.carryRecipients.push({...e.evidence.carryRecipients[0],qualificationId:'root2',leftCarryIn:'200',rightCarryIn:'200',weeklyCapSnapshot:'200'});
  for(const source of e.evidence.sources)source.evidence.binary.push({childQualificationId:'root',parentQualificationId:'root2',side:'LEFT'});
  const original=periodBinary(e,new Map([['left',d(1000)],['right',d(1000)]]),new Map()),r=periodBinary(e,volumes(),new Map());
  expect(original.payables.get('other')!.toString()).toBe('3.3333');expect(r.k.toString()).toBe('0.036');expect(r.payables.get('award')!.toString()).toBe('14.4');expect(r.payables.get('other')!.toString()).toBe('3.6');
 });
 it('Matching source uses recomputed Binary Paid',()=>{const e=binary();e.recipients=[recipient({awardType:'MATCHING',sourceAwardId:'source',rate:'.1'})];expect(periodMatching(e,new Map([['source',d(80)]]),d(1800)).payables.get('award')!.toString()).toBe('8');});
 it('K2 is recomputed from adjusted matching theory',()=>{const e=binary();e.recipients=[recipient({awardType:'MATCHING',sourceAwardId:'source',rate:'1'})];const r=periodMatching(e,new Map([['source',d(1000)]]),d(100));expect(r.k.toString()).toBe('0.015');expect(r.payables.get('award')!.toString()).toBe('15');});
 it('original settlement, award and carry rows remain unchanged',()=>{const e=binary(),before=JSON.stringify(e);periodBinary(e,volumes(),new Map());expect(JSON.stringify(e)).toBe(before);});
 for(const [name,amount] of [['positive delta creates compensating award',120],['negative delta creates recovery',80]] as const){
  it(name,async()=>{const e=binary(),r=e.recipients[0],before=JSON.stringify(e);const tx={entitlementReplayPosting:{findUnique:jest.fn().mockResolvedValue(null),aggregate:jest.fn().mockResolvedValue({_sum:{delta:null}}),create:jest.fn().mockImplementation(({data})=>data)},bonusAward:{create:jest.fn().mockResolvedValue({bonusAwardId:'new'})},bonusAwardLifecycleEvent:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn()},bonusRecoveryEvent:{create:jest.fn().mockResolvedValue({bonusRecoveryEventId:'recovery'})}};
   const post=await appendEntitlementDelta(tx as never,sealed(e),r,d(amount),'RETURN:one','hash');expect(post.delta.toString()).toBe(String(amount-100));expect(JSON.stringify(e)).toBe(before);
   if(amount>100){expect(tx.bonusAward.create).toHaveBeenCalledTimes(1);expect(tx.bonusRecoveryEvent.create).not.toHaveBeenCalled();}else{expect(tx.bonusRecoveryEvent.create).toHaveBeenCalledWith({data:expect.objectContaining({bonusAwardId:'award',recoveryAmount:d(20),outstandingAmount:d(20)})});expect(tx.bonusAward.create).not.toHaveBeenCalled();}
 });
 }
 for(const [status,expected] of [['PENDING_45D','REVERSED'],['PAID','CLAWBACK']] as const) {
  it(`${status} negative historical entitlement appends ${expected} lifecycle`,async()=>{
   const e=binary(),r=recipient({awardType:'REFERRAL',theory:'100',posted:'100'});e.recipients=[r];
   const tx={entitlementReplayPosting:{findUnique:jest.fn().mockResolvedValue(null),aggregate:jest.fn().mockResolvedValue({_sum:{delta:null}}),create:jest.fn().mockImplementation(({data})=>data)},bonusAward:{create:jest.fn()},
    bonusAwardLifecycleEvent:{findFirst:jest.fn().mockResolvedValue({status,occurredAt:new Date()}),create:jest.fn().mockImplementation(({data})=>data)},bonusRecoveryEvent:{create:jest.fn().mockResolvedValue({bonusRecoveryEventId:'recovery'})}};
   await appendEntitlementDelta(tx as never,sealed(e),r,d(0),'RETURN:lifecycle','hash','00000000-0000-0000-0000-000000000001');
   expect(tx.bonusAwardLifecycleEvent.create).toHaveBeenCalledWith({data:expect.objectContaining({bonusAwardId:'award',status:expected,reasonCode:'HISTORICAL_REPLAY'})});
   expect(tx.bonusRecoveryEvent.create).toHaveBeenCalledTimes(status==='PAID'?1:0);
  });
 }
 it('missing original evidence fails closed',()=>{expect(()=>verifyReplayEnvelope(null)).toThrow();});
 it('Matching replay validates historical Sponsor recipients even when Binary ancestry differs',()=>{
  const e=matchingEnvelope();
  expect(verifyReplayEnvelope(sealed(e))).toBe(e);
  expect(e.evidence.matchingSources[0].evidence.binary[0].parentQualificationId).toBe('binary-parent');
  expect(e.recipients[0].qualificationId).toBe('sponsor-1');
 });
 it('Matching replay fails closed when historical Sponsor evidence is absent or inconsistent',()=>{
  const missing=matchingEnvelope();delete missing.evidence.matchingSources;
  expect(()=>verifyReplayEnvelope(sealed(missing))).toThrow(expect.objectContaining({response:expect.objectContaining({code:'HISTORICAL_SNAPSHOT_MISSING'})}));
  const substituted=matchingEnvelope();substituted.evidence.matchingSources[0].evidence.sponsor=[];
  expect(()=>verifyReplayEnvelope(sealed(substituted))).toThrow(expect.objectContaining({response:expect.objectContaining({code:'HISTORICAL_SNAPSHOT_CORRUPT'})}));
 });
});

describe('v0.6.1 subscription cancellation',()=>{
 let assertions:Array<{label:string;actual:unknown}>;
 beforeAll(()=>{
  const root=resolve(__dirname,'../../../..');
  const evidencePath=resolve(tmpdir(),`ucell-phase2-replay-${process.pid}.json`);
  execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public',PHASE2_DB_EVIDENCE_PATH:evidencePath},timeout:30000});
  assertions=JSON.parse(readFileSync(evidencePath,'utf8')).results;
 },30000);
 const actual=(label:string)=>{const result=assertions.find(item=>item.label===label);expect(result).toBeDefined();return result!.actual;};
 it('future scheduled rows become CANCELLED',()=>{expect(actual('subscription future rows cancelled')).toBe('CANCELLED');});
 it('recognized affected rows enqueue one RPV_REVERSAL_REQUIRED',()=>{expect(actual('recognized affected event queued exactly once')).toBe(1);});
 it('worker creates exactly one negative RPV reversal event',()=>{expect(actual('RPV one negative historical reversal')).toBe(1);});
 it('worker creates recovery for previously payable RPV upline awards',()=>{expect(actual('RPV historical recipient recovery delta')).toBe('-100');});
 it('reprocessing event is idempotent',()=>{expect(actual('RPV duplicate processing creates no second posting')).toBe(1);expect(actual('return downstream does not repeat RPV clawback')).toBe(1);});
});

describe('v0.6.1 qualification workflow',()=>{
  const effectiveAt=new Date('2100-01-01T00:00:00Z');
  function harness(workflow:any){
    const currentPlan={qualificationPlanHistoryId:'plan-old'},currentHolder={holderHistoryId:'holder-old'};
    const tx:any={
      qualificationWorkflow:{findUniqueOrThrow:jest.fn(async()=>workflow),update:jest.fn(async({data}:any)=>({...workflow,...data}))},
      qualificationPlanHistory:{findFirst:jest.fn(async()=>currentPlan),update:jest.fn(),create:jest.fn(async({data}:any)=>data)},
      qualificationHolderHistory:{findFirst:jest.fn(async()=>currentHolder),update:jest.fn(),create:jest.fn(async({data}:any)=>data)},
      qualification:{update:jest.fn(async({data}:any)=>({qualificationId:workflow.qualificationId,...data}))},
      person:{findUnique:jest.fn(async({where}:any)=>({personId:where.personId}))},
      sponsorRelationship:{update:jest.fn(),create:jest.fn(),delete:jest.fn()},
      binaryPlacement:{update:jest.fn(),create:jest.fn(),delete:jest.fn()},
      bonusAward:{update:jest.fn(),delete:jest.fn()},
    };
    const statusService={transition:jest.fn()};
    const transaction=jest.fn(async(work:any)=>work(tx));
    return {tx,statusService,transaction,service:new QualificationWorkflowService({$transaction:transaction} as any,statusService as any)};
  }
  it('upgrade creates future plan history and does not alter past awards',async()=>{
    const workflow={qualificationWorkflowId:'workflow-upgrade',qualificationId:'ball-A',workflowType:'UPGRADE',status:'SUBMITTED',targetPlanCode:'LEADER',payload:{reviewFeePaid:true}};
    const {service,tx}=harness(workflow);await service.approve(workflow.qualificationWorkflowId,effectiveAt);
    expect(tx.qualificationPlanHistory.update).toHaveBeenCalledWith({where:{qualificationPlanHistoryId:'plan-old'},data:{effectiveTo:effectiveAt}});
    expect(tx.qualificationPlanHistory.create).toHaveBeenCalledWith({data:{qualificationId:'ball-A',planCode:'LEADER',effectiveFrom:effectiveAt,sourceType:'QUALIFICATION_UPGRADE',sourceId:'workflow-upgrade'}});
    expect(tx.qualification.update).toHaveBeenCalledWith({where:{qualificationId:'ball-A'},data:{planLevelCode:'LEADER'}});
    expect(tx.bonusAward.update).not.toHaveBeenCalled();expect(tx.bonusAward.delete).not.toHaveBeenCalled();
  });
  it('transfer preserves qualificationId and sponsor/binary positions',async()=>{
    const workflow={qualificationWorkflowId:'workflow-transfer',qualificationId:'ball-A',workflowType:'TRANSFER',status:'SUBMITTED',receivingPersonId:'person-new',payload:{reviewFeePaid:true}};
    const {service,tx}=harness(workflow);await service.approve(workflow.qualificationWorkflowId,effectiveAt);
    expect(tx.qualificationHolderHistory.update).toHaveBeenCalledWith({where:{holderHistoryId:'holder-old'},data:{effectiveTo:effectiveAt}});
    expect(tx.qualificationHolderHistory.create).toHaveBeenCalledWith({data:expect.objectContaining({qualificationId:'ball-A',holderPersonId:'person-new',sourceType:'TRANSFER'})});
    expect(tx.qualification.update).toHaveBeenCalledWith({where:{qualificationId:'ball-A'},data:{currentHolderPersonId:'person-new'}});
    for(const graph of [tx.sponsorRelationship,tx.binaryPlacement]){expect(graph.update).not.toHaveBeenCalled();expect(graph.create).not.toHaveBeenCalled();expect(graph.delete).not.toHaveBeenCalled();}
  });
  it('exit closes holder interval and status becomes EXITED',async()=>{
    const workflow={qualificationWorkflowId:'workflow-exit',qualificationId:'ball-A',workflowType:'EXIT',status:'SUBMITTED',payload:{reviewFeePaid:true,companyHolderPersonId:'company'}};
    const {service,tx,statusService}=harness(workflow);await service.approve(workflow.qualificationWorkflowId,effectiveAt);
    expect(tx.qualificationHolderHistory.update).toHaveBeenCalledWith({where:{holderHistoryId:'holder-old'},data:{effectiveTo:effectiveAt}});
    expect(tx.qualificationHolderHistory.create).toHaveBeenCalledWith({data:expect.objectContaining({qualificationId:'ball-A',holderPersonId:'company',sourceType:'QUALIFICATION_EXIT_COMPANY_HELD'})});
    expect(statusService.transition).toHaveBeenCalledWith(tx,'ball-A','EXITED',effectiveAt,'QUALIFICATION_EXIT','workflow-exit');
    expect(tx.qualification.update).toHaveBeenCalledWith({where:{qualificationId:'ball-A'},data:{currentHolderPersonId:'company',status:'CLOSED',activeFlag:false}});
  });
  it('company retransfer opens a new holder interval',async()=>{
    const workflow={qualificationWorkflowId:'workflow-retransfer',qualificationId:'ball-A',workflowType:'COMPANY_RETRANSFER',status:'SUBMITTED',receivingPersonId:'person-next',payload:{reviewFeePaid:true}};
    const {service,tx,statusService}=harness(workflow);await service.approve(workflow.qualificationWorkflowId,effectiveAt);
    expect(tx.qualificationHolderHistory.create).toHaveBeenCalledWith({data:expect.objectContaining({qualificationId:'ball-A',holderPersonId:'person-next',effectiveFrom:effectiveAt,sourceType:'COMPANY_RETRANSFER'})});
    expect(statusService.transition).toHaveBeenCalledWith(tx,'ball-A','EFFECTIVE',effectiveAt,'COMPANY_RETRANSFER','workflow-retransfer');
    expect(tx.qualification.update).toHaveBeenCalledWith({where:{qualificationId:'ball-A'},data:{currentHolderPersonId:'person-next',status:'EFFECTIVE'}});
  });
});
