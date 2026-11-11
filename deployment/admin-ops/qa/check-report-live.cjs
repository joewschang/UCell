/* Execute inside the deployed API container. Only aggregate read operations run. */
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {PrismaClient,Prisma}=createRequire('/app/packages/database/dist/index.js')('@prisma/client');
const {AdminOpsReadyService}=require('/app/apps/api/dist/modules/admin-ops-ready/admin-ops-ready.service.js');
const db=new PrismaClient();
(async()=>{
  const day=86400000;
  const to=new Date(Math.floor((Date.now()+8*3600000)/day)*day-8*3600000);
  const from=new Date(+to-30*day);
  const report=await new AdminOpsReadyService(db,{}).operationsReport(from,to,true);
  const expected=await db.$queryRaw`
    WITH facts AS (
      SELECT 'ordered' AS kind,currency,net_amount AS amount FROM commerce."order" WHERE created_at>=${from} AND created_at<${to}
      UNION ALL
      SELECT 'paid',currency,net_amount FROM commerce."order" WHERE paid_at>=${from} AND paid_at<${to} AND net_amount>0
      UNION ALL
      SELECT 'return',o.currency,l.return_amount FROM commerce.return_line l JOIN commerce.return_case c USING(return_case_id)
      JOIN commerce."order" o USING(order_id) WHERE c.occurred_at>=${from} AND c.occurred_at<${to}
    ) SELECT kind,currency,count(*)::int AS count,sum(amount)::text AS amount FROM facts GROUP BY kind,currency ORDER BY kind,currency
  `;
  for(const [type,key] of [['ordered','ordersByCurrency'],['paid','paidOrdersByCurrency'],['return','returnsByCurrency']]){
    const norm=r=>[r.currency,r.count,new Prisma.Decimal(r.amount).toFixed(2)];
    assert.deepEqual(report[key].map(norm),expected.filter(x=>x.kind===type).map(norm));
  }
  assert.equal(report.orders.count,report.ordersByCurrency.reduce((n,row)=>n+row.count,0));
  assert.equal(report.returns.lineCount,report.returnsByCurrency.reduce((n,row)=>n+row.count,0));
  const {formalReviewDirectory}=require('/app/apps/api/dist/modules/member/formal-review-directory.js');
  const first=await formalReviewDirectory(db,{page:'1',take:'2'});
  const rows=first.data??first.rows;
  assert(Array.isArray(rows));
  assert.equal(first.meta.page,1);
  const sample=rows[0];
  if(sample && sample.displayMemberNo && !sample.displayMemberNo.includes('尚未')){
    const result=await formalReviewDirectory(db,{page:'1',take:'5',q:sample.displayMemberNo});
    assert((result.data??result.rows).some(row=>row.id===sample.id));
  }
  console.log('VERIFIED_DIRECTORY',JSON.stringify({list:true,memberSearch:!!sample}));
  // Exercise the installed export guard without creating a real payout or bank file.
  const {verifyPayoutSources}=require('/app/packages/database/dist/compensation-audit-runner.js');
  const zero=new Prisma.Decimal(0),gross=new Prisma.Decimal(10);
  const batch={totalGross:gross,totalRecovery:zero,totalNet:gross};
  const line={recipientQualificationId:'test-recipient',grossAmount:gross,recoveryOffset:zero,netAmount:gross,payableEntries:[],recoveryApplications:[]};
  const synthetic={payoutBatch:{findUniqueOrThrow:async()=>batch},payoutLine:{findMany:async()=>[line]}};
  await assert.rejects(()=>verifyPayoutSources(synthetic,'test-batch'),/付款明細的來源總額/);
  line.payableEntries.push({qualificationId:'different-recipient',grossAmount:gross,status:'ALLOCATED'});
  await assert.rejects(()=>verifyPayoutSources(synthetic,'test-batch'),/受領資格/);
  console.log('VERIFIED_PAYOUT_GUARD',JSON.stringify({missingSource:true,wrongRecipient:true}));
  console.log('VERIFIED_REPORT',JSON.stringify({from:from.toISOString(),toExclusive:to.toISOString(),measurements:3,currencyGroups:expected.length}));
})().catch(err=>{console.error('REPORT_CHECK_FAILED',err.name,err.code||'verification');process.exitCode=1}).finally(()=>db.$disconnect());
