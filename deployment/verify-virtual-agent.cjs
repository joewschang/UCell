const assert=require('assert/strict'),fs=require('fs'),crypto=require('crypto'),path=require('path');
const root=path.resolve(__dirname,'..');const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{const checks=[];for(const [app,url]of Object.entries({website:'https://ucell.life',admin:'https://admin.ucell.life',member:'https://member.ucell.life'})){
 const response=await fetch(url);assert.equal(response.status,200);const html=await response.text();
 for(const asset of ['portrait','welcome','avatar']){const r=await fetch(url+'/assets/virtual-agent/'+asset+'.webp');assert.equal(r.status,200);assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(fs.readFileSync(path.join(root,'shared/virtual-agent',asset+'.webp'))));}
 if(app==='website'){assert.ok(html.includes('virtual-agent.js'));const r=await fetch(url+'/contact.html');assert.ok((await r.text()).includes('您好，我是 UCell 智慧秘書'));}else{const script=html.match(/src="([^\"]+\.js)"/)[1];const r=await fetch(new URL(script,url));assert.equal(r.status,200);const js=await r.text();assert.ok(js.includes('UCell 智慧秘書'));assert.ok(js.includes('https://api.ucell.life/api/v1'));}
 checks.push({app,healthy:true,assets:'SHA-256 matched',frontend:'updated'});
 }fs.writeFileSync('C:/UCell/virtual-agent-20261022/public-verification.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));
})().catch(e=>{console.error(e);process.exitCode=1});
