import { PrismaClient, Prisma } from '@prisma/client';
import { EpvMonthService } from '../apps/api/src/modules/epv/epv-month.service';
import { captureParameters } from '../packages/database/src/parameter-snapshot';

const prisma=new PrismaClient();

function assert(ok:boolean,msg:string){
  if(!ok) throw new Error(`DB_GOLDEN_FAIL: ${msg}`);
}

async function main(){
  const q=await prisma.qualification.findMany({
    where:{qualificationId:{in:[
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000004',
      '20000000-0000-4000-8000-000000000005',
    ]}}
  });
  assert(q.length===5,'five golden qualifications must exist');

  const sponsor=await prisma.sponsorRelationship.count({
    where:{effectiveTo:null}
  });
  assert(sponsor===4,'exact deterministic sponsor fixture must exist');

  const binary=await prisma.binaryPlacement.count({
    where:{effectiveTo:null}
  });
  assert(binary===4,'exact deterministic binary fixture must exist');

  const leaderG5=await prisma.runtimeRuleParameter.findFirst({
    where:{
      ruleVersionCode:'R1.0B',
      parameterCode:'equalization.rate',
      scopeKey:'LEADER:G5'
    }
  });
  assert(!!leaderG5,'Leader G5 fixture parameter is required');
  assert(new Prisma.Decimal(String(leaderG5!.valueJson)).eq('0.10'),'Leader G5 must equal 10%');

  const pools=['pool.referral.rate','pool.binary.rate','pool.matching.rate','pool.global.rate','pool.welfare.rate'];
  const rows=await prisma.runtimeRuleParameter.findMany({
    where:{ruleVersionCode:'R1.0B',parameterCode:{in:pools}}
  });
  const expected=['.42','.36','.15','.05','.02'];
  // Migration parameters may precede fixture parameters; select the explicit 2020 fixture.
  for(const [index,code] of pools.entries()){
    const matches=rows.filter(row=>row.parameterCode===code && row.scopeKey==='*' && row.effectiveFrom.toISOString()==='2020-01-01T00:00:00.000Z');
    assert(matches.length===1,'required pool fixture must be unique: '+code);
    assert(new Prisma.Decimal(String(matches[0].valueJson)).eq(expected[index]),'frozen pool mismatch: '+code);
  }

  const persons=await prisma.person.findMany({
    where:{personId:{in:[
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000005',
    ]}}
  });
  assert(persons.length===5,'five golden persons must exist');

  const version='GOLDEN_TIMEZONE_TEST_ONLY';
  await prisma.runtimeRuleParameter.create({data:{ruleVersionCode:version,parameterCode:'epv.calendar.timezone',valueJson:'Asia/Taipei',effectiveFrom:new Date('2020-01-01'),effectiveTo:new Date('2020-02-01')}});
  await prisma.runtimeRuleParameter.create({data:{ruleVersionCode:version,parameterCode:'epv.calendar.timezone',valueJson:'UTC',effectiveFrom:new Date('2020-02-01')}});
  const months=new EpvMonthService();
  const historical=await captureParameters(prisma as any,new Date('2020-01-31T15:59:59Z'),version);
  const before=await months.bounds(prisma as any,new Date('2020-01-31T15:59:59Z'),historical);
  const boundary=await months.bounds(prisma as any,new Date('2020-01-31T16:00:00Z'),historical);
  assert(before.start.toISOString()==='2019-12-31T16:00:00.000Z','Taipei January start must be UTC Dec 31 16:00');
  assert(boundary.start.toISOString()==='2020-01-31T16:00:00.000Z','Taipei February begins before UTC February');
  const prospective=await captureParameters(prisma as any,new Date('2020-02-01'),version);
  const future=await months.bounds(prisma as any,new Date('2020-02-01'),prospective);
  assert(future.start.toISOString()==='2020-02-01T00:00:00.000Z','prospective TEST timezone uses its own month boundary');
  const replay=await months.bounds(prisma as any,new Date('2020-01-31T16:00:00Z'),historical);
  assert(replay.start.getTime()===boundary.start.getTime(),'historical snapshot cannot follow newer timezone');
  const timezoneRows=await prisma.runtimeRuleParameter.findMany({where:{ruleVersionCode:'R1.0B',parameterCode:'epv.calendar.timezone',effectiveFrom:{lte:new Date('2026-09-15T00:00:00+08:00')},OR:[{effectiveTo:null},{effectiveTo:{gt:new Date('2026-09-15T00:00:00+08:00')}}]}});
  assert(timezoneRows.length===1 && timezoneRows[0].valueJson==='Asia/Taipei','SA timezone migration must select a unique Asia/Taipei parameter');
  console.log('DB_TIMEZONE_REGRESSION_PASS: Taipei boundary and prospective historical snapshot');

  console.log('DB_GOLDEN_E2E_PASS');
}

main()
  .finally(()=>prisma.$disconnect());
