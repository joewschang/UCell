import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
const url=new URL(process.env.DATABASE_URL??'');assert.equal(url.pathname,'/ucell_admin_test');assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
const count=await db.settlementBatch.count();const results=[];
for(const type of ['referral','binary']){
 const response=await fetch('http://127.0.0.1:3001/api/v1/admin/bonus/settlements/'+type,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({periodStart:'2020-01-01T00:00:00Z',periodEnd:'2020-01-08T00:00:00Z'})});
 const json=await response.json();assert.equal(response.status,422);assert.equal(json.code,'CONFIGURATION_PENDING');results.push({type,status:response.status,code:json.code,result:'PASS'});
}
assert.equal(await db.settlementBatch.count(),count);await db.$disconnect();fs.writeFileSync(fileURLToPath(new URL('./final/http-configuration-guards.json',import.meta.url)),JSON.stringify({result:'PASS',results,noSettlementRowsCreated:true},null,2)+'\n');console.log('PASS: K0/K1 configuration pending guards; no settlement rows created');
