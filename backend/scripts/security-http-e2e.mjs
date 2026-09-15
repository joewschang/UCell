const base=(process.env.UCELL_API_BASE??'http://127.0.0.1:3000/api/v1').replace(/\/$/,'');
const membership=process.env.UAT_TOKEN_MEMBERSHIP;
const finance=process.env.UAT_TOKEN_FINANCE;
const compliance=process.env.UAT_TOKEN_COMPLIANCE;

const failures=[];
async function call(path,token,method='GET',body){
  const headers={'content-type':'application/json','x-request-id':crypto.randomUUID()};
  if(token)headers.authorization=`Bearer ${token}`;
  const res=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  return res;
}
function expect(label,actual,expected){
  if(actual!==expected)failures.push(`${label}: expected ${expected}, got ${actual}`);
}

async function main(){
const unauth=await call('/admin/dashboard/summary');
expect('admin endpoint without bearer',unauth.status,401);

if(membership){
  const r=await call('/admin/operations/payout-batches',membership);
  expect('MEMBERSHIP_OPS payout denial',r.status,403);
}
if(finance){
  const r=await call('/admin/operations/workflows',finance);
  expect('FINANCE workflow denial',r.status,403);
}
if(compliance){
  const r=await call('/admin/ops-ready/audit-events?take=1',compliance);
  if(![200].includes(r.status))failures.push(`COMPLIANCE audit access: expected 200, got ${r.status}`);
}

if(failures.length){
  console.error('SECURITY_E2E_FAIL');
  failures.forEach(x=>console.error('-',x));
  process.exit(1);
}
if(!membership||!finance||!compliance){
  console.log('SECURITY_E2E_PARTIAL_PASS: role tokens missing; unauthenticated case passed');
  process.exit(2);
}
console.log('SECURITY_E2E_PASS');
}
main().catch(error=>{
  console.error('SECURITY_E2E_BLOCKED: formal HTTP service or credentials infrastructure unavailable');
  console.error(error.cause?.code??error.name);
  process.exitCode=2;
});
