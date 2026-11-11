const assert=require('node:assert/strict');
const {AdminOpsReadyService}=require('/app/apps/api/dist/modules/admin-ops-ready/admin-ops-ready.service.js');
const {AdminOpsReadyController}=require('/app/apps/api/dist/modules/admin-ops-ready/admin-ops-ready.controller.js');
const from=new Date('2026-10-31T16:00:00.000Z'),to=new Date('2026-11-30T16:00:00.000Z');
async function verify(exclusive) {
  const expected=exclusive?{gte:from,lt:to}:{gte:from,lte:to};
  const amount='1234567890123456.78';
  const byCurrency=[{currency:'TWD',_count:2,_sum:{netAmount:amount}}];
  const query=async ({where})=>{assert.deepEqual(where.createdAt||where.periodEnd,expected);return []};
  const prisma={
    $transaction:async(list,opt)=>{assert.equal(opt.isolationLevel,'RepeatableRead');return Promise.all(list)},
    $queryRaw:async(parts,...vars)=>{assert.equal(vars[0].valueOf(),from.valueOf());assert.equal(vars[1].sql,exclusive?'<':'<=');assert.equal(vars[2].valueOf(),to.valueOf());return [{currency:'TWD',count:1,amount:'10.02'}]},
    person:{count:async({where})=>{assert.deepEqual(where.createdAt,expected);return 4}},
    qualification:{count:async()=>3,findMany:query},membershipApplication:{groupBy:async()=>[]},
    order:{groupBy:async({by,where})=>{assert.deepEqual(by,['currency']);if(where.paidAt)assert.deepEqual(where.netAmount,{gt:0});assert.deepEqual(where.paidAt||where.createdAt,expected);return byCurrency},
      aggregate:async()=>({_count:3,_sum:{netAmount:amount}}),findMany:query},
    returnLine:{aggregate:async()=>({_count:1,_sum:{returnAmount:'10.02',gpvReversal:0}})},
    bonusAward:{groupBy:async()=>[]},payoutBatch:{aggregate:async()=>({}),findMany:query},bonusRecoveryEvent:{aggregate:async()=>({})}
  };
  const service=new AdminOpsReadyService(prisma,{}),ctrl=new AdminOpsReadyController(service);
  const response=await ctrl.report(from.toISOString(),to.toISOString(),exclusive?'true':undefined);
  assert.deepEqual(response.data.paidOrdersByCurrency,[{currency:'TWD',count:2,amount}]);
  assert.deepEqual(response.data.ordersByCurrency,response.data.paidOrdersByCurrency);
  assert.equal(response.data.returnsByCurrency[0].amount,'10.02');
  for(const type of ['ORDERS','QUALIFICATIONS','PAYOUTS']){
    const out=await ctrl.export(type,'10000',from.toISOString(),to.toISOString(),exclusive?'true':undefined);
    assert.equal(out.data.rowCount,0);
  }
  await assert.rejects(()=>service.operationsReport(to,from,exclusive));
}
(async()=>{await verify(true);await verify(false);console.log('Passed report currency, amount precision, isolation, period and export contract checks.');})().catch(e=>{console.error(e);process.exitCode=1;});
