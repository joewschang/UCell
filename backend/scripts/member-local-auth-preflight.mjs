import assert from 'node:assert/strict';
const base=process.env.MEMBER_LOCAL_API_URL??'http://127.0.0.1:3001/api/v1';
const url=new URL(base);assert.ok(['localhost','127.0.0.1'].includes(url.hostname),'Local DEV only');
for(const [method,path,body] of [
 ['GET','/member/me'],
 ['GET','/member/notifications?qualificationId=00000000-0000-4000-8000-000000000001'],
 ['PATCH','/member/profile',{name:'UNAUTHORIZED_TEST_ONLY'}],
 ['POST','/member/orders',{qualificationId:'00000000-0000-4000-8000-000000000001',items:[]}]
]){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':'UNAUTHORIZED_TEST_ONLY'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)});
 assert.equal(response.status,401,`${method} ${path} must require Member session independently of Admin DEV`);
}
console.log('MEMBER_LOCAL_AUTH_PASS: 4 actual HTTP operations denied without Member session; formal LINE NOT VERIFIED');
