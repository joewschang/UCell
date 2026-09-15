import { PrismaClient, Prisma } from '@prisma/client';

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
  assert(sponsor>=4,'golden sponsor tree must exist');

  const binary=await prisma.binaryPlacement.count({
    where:{effectiveTo:null}
  });
  assert(binary>=4,'golden binary tree must exist');

  const leaderG5=await prisma.runtimeRuleParameter.findFirst({
    where:{
      ruleVersionCode:'R1.0B',
      parameterCode:'equalization.rate',
      scopeKey:'LEADER:G5'
    }
  });
  if(leaderG5){
    assert(new Prisma.Decimal(String(leaderG5.valueJson)).eq('0.10'),'Leader G5 must equal 10%');
  }

  const pools=['pool.referral.rate','pool.binary.rate','pool.matching.rate','pool.global.rate','pool.welfare.rate'];
  const rows=await prisma.runtimeRuleParameter.findMany({
    where:{ruleVersionCode:'R1.0B',parameterCode:{in:pools}}
  });
  if(rows.length===5){
    const total=rows.reduce((s,r)=>s.add(new Prisma.Decimal(String(r.valueJson))),new Prisma.Decimal(0));
    assert(total.eq(1),'five pools must sum to 100%');
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

  console.log('DB_GOLDEN_E2E_PASS');
}

main()
  .finally(()=>prisma.$disconnect());
