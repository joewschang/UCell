import { PersonService } from '../src/modules/person/person.service';
import { R10B } from '../../../packages/shared/src/r1-0b-golden';
import { phase2DbEvidence } from './phase2-db-evidence';
let evidence:any[];
beforeAll(()=>{ evidence=[...phase2DbEvidence()]; },30000);
function actual(label:string){const observed=evidence.find((item:any)=>item.label===label);expect(observed).toBeDefined();expect(observed.result).toBe('PASS');expect(observed.actual).toEqual(observed.expected);return observed.actual;}
describe('R1.0B v0.6.4 Golden Dataset',()=>{
  it('keeps Person and Qualification distinct', async () => {
    const personId='00000000-0000-0000-0000-000000000001';
    const balls=[
      {qualificationId:'00000000-0000-0000-0000-000000000011',currentHolderPersonId:personId,status:'EFFECTIVE',activeFlag:true,kind:'MEMBER_ORIGIN',planLevelCode:'STARTER',binaryTreeMembership:null,canonicalPosition:null,ownerIntervals:[],companyProfileBindings:[],globalRankHistory:[]},
      {qualificationId:'00000000-0000-0000-0000-000000000012',currentHolderPersonId:personId,status:'SUSPENDED',activeFlag:false,kind:'MEMBER_ORIGIN',planLevelCode:'STARTER',binaryTreeMembership:null,canonicalPosition:null,ownerIntervals:[],companyProfileBindings:[],globalRankHistory:[]},
    ];
    const findMany=jest.fn(async()=>balls), count=jest.fn(async()=>2);
    const tx={person:{findUnique:jest.fn(async()=>({personId}))},qualification:{findMany,count},qualificationPlanHistory:{findMany:jest.fn(async()=>[])}};
    const service=new PersonService({$transaction:async(work:any)=>work(tx)} as any,{} as any,{} as any);
    const result=await service.qualifications(personId);
    expect(result.data.map(ball=>({qualificationId:ball.qualificationId,currentHolderPersonId:ball.currentHolderPersonId,status:ball.status,activeFlag:ball.activeFlag}))).toEqual(
      balls.map(({qualificationId,currentHolderPersonId,status,activeFlag})=>({qualificationId,currentHolderPersonId,status,activeFlag})),
    );
    expect(result.data.every(ball=>ball.admin360.schemaVersion==='ADMIN_QUALIFICATION_360_V1')).toBe(true);
    expect(result.meta.total).toBe(2);
    expect(new Set(result.data.map(ball=>ball.qualificationId)).size).toBe(2);
    expect(result.data.every(ball=>ball.qualificationId!==personId)).toBe(true);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({where:{currentHolderPersonId:personId}}));
    expect(count).toHaveBeenCalledWith({where:{currentHolderPersonId:personId}});
    // Corresponding isolated PostgreSQL 1:N / outsider / pagination / no-mutation
    // assertions run in phase3-membership-db-test.mjs, never inferred from Person status.
  });
  it('keeps Sponsor and Binary trees distinct',()=>{
    expect(actual('Binary-only historical EPV ancestor gets no award')).toBe(0);
    expect(actual('Active historical EPV Sponsor G1')).toBe('100.8');
    expect(actual('RPV current Binary parent receives no recovery')).toBe(0);
  });
  it('validates Referral 15/20/25',()=>{
    expect(R10B.referral).toEqual({STARTER:0.15,ELITE:0.20,LEADER:0.25});
  });
  it('validates Equalization including Leader G5=10%',()=>{
    expect(R10B.equalization.LEADER).toEqual({2:0.20,3:0.15,4:0.10,5:0.10,6:0.10,7:0.05});
    expect(R10B.equalization.LEADER[5]).toBe(0.10);
  });
  it('validates Active First and no current-state compression',()=>{
    expect(actual('historically inactive recipient stays zero')).toBe('0');
    expect(actual('historical sponsor receives adjustment despite current inactive')).toBe(1);
    expect(actual('current sponsor never receives historical money')).toBe(0);
  });
  it('validates Binary Carry and K1',()=>{
    expect(actual('carry continuation derives next historical left carry')).toBe('300');
    expect(actual('resume converges same replay run')).toEqual([true,'CONVERGED',3]);
    expect(actual('period checkpoints capture complete K1 and K2 replay')).toHaveLength(3);
  });
  it('validates Matching source=Binary Paid after K1',()=>{
    expect(actual('downstream Matching uses exact recalculated Binary source')).toBe('0');
    expect(actual('complete replay posts every Matching entitlement')).toBe(3);
  });
  it('validates RPV 5/8/12 on Binary Tree',()=>{
    expect([R10B.rpvDepth(0),R10B.rpvDepth(1),R10B.rpvDepth(2)]).toEqual([5,8,12]);
    expect(actual('RPV replay retains original recipient after Binary change')).toBe(true);
    expect(actual('RPV current Binary parent receives no recovery')).toBe(0);
  });
  it('validates EPV on Sponsor Tree',()=>{
    for(let generation=1;generation<=5;generation++) expect(actual(`Active historical EPV Sponsor G${generation}`)).toBe('100.8');
    expect(actual('Binary-only historical EPV ancestor gets no award')).toBe(0);
  });
  it('validates refund -> replay -> recovery -> payout',()=>{
    expect(actual('real multi-return reaches cumulative full return')).toBe('RETURNED');
    expect(actual('PAID historical reduction appends one CLAWBACK lifecycle')).toBe(1);
    expect(actual('outstanding recovery tracks PAID clawback')).toBe('840');
    expect(actual('PAID clawback offset limited to new payout capacity 100')).toBe('100');
    expect(actual('offset does not overwrite original PAID history')).toBeDefined();
  });
  it('validates partial recovery across multiple payout batches',()=>{
    expect(actual('PAID clawback offset limited to new payout capacity 100')).toBe('100');
    expect(actual('PAID clawback offset limited to new payout capacity 200')).toBe('200');
    expect(actual('multi-batch clawback outstanding decreases only once per capacity')).toBe('300');
    expect(actual('same payout line offset replay is idempotent')).toBe('100');
  },30000);
});
