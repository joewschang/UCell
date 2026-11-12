const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const [admin,member,out]=process.argv.slice(2);if(!admin||!member||!out)throw Error('Usage: node public.cjs <candidate admin root> <candidate member root> <report>');
const h=b=>createHash('sha256').update(b).digest('hex'),checks=[];
async function resource(origin,url,options) {
  const res=await fetch(new URL(url,origin),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000),...options});return {res,body:Buffer.from(await res.arrayBuffer())};
}
async function checkSPA(dir,origin,routes) {
  const index=fs.readFileSync(path.join(dir,'index.html'));
  const names=[...new Set([...index.toString().matchAll(/(?:href|src)="([^"?]+\.(?:css|js))(?:\?[^"]*)?"/g)].map(m=>m[1]))];
  for(const route of routes) {
    const {res,body}=await resource(origin,route);assert.equal(res.status,200);
    assert.equal(h(body),h(index),'public entry did not switch: '+origin+route);
    checks.push({url:origin+route,status:res.status,sha256:h(body)});
  }
  for(const url of names) {
    const local=path.join(dir,url),{res,body}=await resource(origin,url);assert.equal(res.status,200,'asset '+url);
    const hasLocal=fs.existsSync(local);if(hasLocal)assert.equal(h(body),h(fs.readFileSync(local)),url);
    checks.push({url:origin+url,status:res.status,sha256:h(body),matchedLocal:hasLocal});
  }
}
(async()=>{await checkSPA(admin,'https://admin.ucell.life',['/qualifications','/orders','/daily-operations']);
 await checkSPA(member,'https://member.ucell.life',['/','/notifications']);
 for(const [url,status] of [['/health',200],['/admin/qualifications?page=1&take=8',401],['/admin/orders',401],['/admin/orders/qualification-options?page=1&take=6',401],['/admin/orders/product-options',401],['/admin/undefined-qa-path',404],['/member/messages',401]]){const {res}=await resource('https://api.ucell.life','/api/v1'+url);assert.equal(res.status,status,url);checks.push({url:'https://api.ucell.life/api/v1'+url,status:res.status});}
 fs.writeFileSync(out,JSON.stringify({at:new Date().toISOString(),checks},null,2));console.log(checks.length+' live public UI asset, deep-link, health and access-control checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
