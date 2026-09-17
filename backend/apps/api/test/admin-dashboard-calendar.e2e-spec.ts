import { AdminDashboardService, dashboardCalendarBounds, statusCounts } from '../src/modules/admin-dashboard/admin-dashboard.service';

const parameter=(value:unknown,id='timezone')=>({runtimeRuleParameterId:id,parameterCode:'accounting.timezone',scopeKey:'*',valueJson:value,effectiveFrom:new Date('2020-01-01T00:00:00.000Z'),effectiveTo:null});

function txFor(timezone:unknown,bounds?:{dayStart:Date;dayEnd:Date;monthStart:Date;monthEnd:Date}){
  const orderCount=jest.fn(async()=>0);
  const tx={
    runtimeRuleParameter:{findMany:jest.fn(async()=>timezone==='OVERLAP'?[parameter('Asia/Taipei','a'),parameter('UTC','b')]:timezone===undefined?[]:[parameter(timezone)])},
    $queryRaw:jest.fn(async()=>bounds?[bounds]:[]),
    person:{count:jest.fn(async()=>0),groupBy:jest.fn(async()=>[{status:'EFFECTIVE',_count:{_all:7}},{status:'SUSPENDED',_count:{_all:2}}])},qualification:{count:jest.fn(async()=>0),groupBy:jest.fn(async()=>[{status:'EFFECTIVE',_count:{_all:9}},{status:'EXITED',_count:{_all:1}}])},membershipApplication:{count:jest.fn(async()=>0)},order:{count:orderCount},bonusRecoveryEvent:{count:jest.fn(async()=>0)},payableEntry:{count:jest.fn(async()=>0)},
  };
  return {tx,orderCount};
}

describe('Admin Dashboard versioned accounting calendar',()=>{
  const now=new Date('2026-09-17T16:30:00.000Z'); // 2026-09-18 00:30 in Taipei.
  const taipei={dayStart:new Date('2026-09-17T16:00:00.000Z'),dayEnd:new Date('2026-09-18T16:00:00.000Z'),monthStart:new Date('2026-08-31T16:00:00.000Z'),monthEnd:new Date('2026-09-30T16:00:00.000Z')};
  const utc={dayStart:new Date('2026-09-17T00:00:00.000Z'),dayEnd:new Date('2026-09-18T00:00:00.000Z'),monthStart:new Date('2026-09-01T00:00:00.000Z'),monthEnd:new Date('2026-10-01T00:00:00.000Z')};

  test.each([['Asia/Taipei',taipei],['UTC',utc]])('uses the %s snapshot to expose half-open UTC bounds',async(timezone,bounds)=>{
    const {tx}=txFor(timezone,bounds);
    await expect(dashboardCalendarBounds(tx as any,now)).resolves.toMatchObject({...bounds,timezone});
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  test('summary uses both lower and upper accounting-day/month boundaries in one repeatable-read transaction',async()=>{
    const {tx,orderCount}=txFor('Asia/Taipei',taipei);
    let transactionOptions:unknown;
    const db={$transaction:jest.fn(async(fn:any,options:any)=>{transactionOptions=options;return fn(tx);})};
    const result=await new AdminDashboardService(db as any).summary(now);
    expect(orderCount.mock.calls).toEqual([
      [{where:{createdAt:{gte:taipei.dayStart,lt:taipei.dayEnd}}}],
      [{where:{createdAt:{gte:taipei.monthStart,lt:taipei.monthEnd}}}],
    ]);
    expect(result.generatedAt).toEqual(now);
    expect(result.memberLifecycle).toMatchObject({
      nasl:{new:{availability:'UNAVAILABLE',value:null,reasonCode:'NASL_DEDICATED_ANALYTICS_PROJECTION'},lost:{availability:'UNAVAILABLE',value:null,reasonCode:'NASL_DEDICATED_ANALYTICS_PROJECTION'}},
      currentPersonRecordStatus:{availability:'AVAILABLE',source:'identity.person.status',counts:{EFFECTIVE:7,SUSPENDED:2,DRAFT:0}},
      currentQualificationLifecycleStatus:{availability:'AVAILABLE',source:'membership.qualification.status',counts:{EFFECTIVE:9,EXITED:1,DRAFT:0}},
    });
    expect(transactionOptions).toEqual({isolationLevel:'RepeatableRead'});
  });

  test('status count projection is exhaustive and ignores values outside the declared domain',()=>{
    expect(statusCounts(['DRAFT','EFFECTIVE'] as const,[{status:'EFFECTIVE',_count:{_all:3}},{status:'UNKNOWN',_count:{_all:99}}])).toEqual({DRAFT:0,EFFECTIVE:3});
  });

  test.each([
    [undefined,'CONFIGURATION_PENDING'],
    ['Invalid/Timezone','INVALID_TIMEZONE'],
    ['OVERLAP','PARAMETER_OVERLAP'],
  ])('fails closed for %s accounting timezone configuration',async(timezone,code)=>{
    const {tx}=txFor(timezone,taipei);
    await expect(dashboardCalendarBounds(tx as any,now)).rejects.toMatchObject({response:{code}});
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
