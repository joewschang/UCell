const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out='C:/UCell/virtual-agent-20261022',registry='ucellprodacrm3z2zx4ohqyui.azurecr.io';
const baseline={admin:registry+'/ucell-admin@sha256:f3c7b51f7ea90fd38ad8331b88debb8450586d1e4a15ef68776466d880a4cde4',member:registry+'/ucell-member@sha256:53f9c7fbfb13e8c0e5fcb98921df3d2eb70996ddac9a69fabd4121c2ea8d993c',website:registry+'/ucell-website@sha256:43918968282d15ead37e5aa1ed426eef6ae72294dbf0a880f0eaec94c1ac64f0'};
const observed={...baseline,website:registry+'/ucell-website:support-20261021'};
for(const component of ['admin','member','website']){
 const dir=path.join(out,component),dest=path.join(dir,'dist');fs.mkdirSync(dest,{recursive:true});
 if(component==='website'){
  for(const file of fs.readdirSync(path.join(root,'website')).filter(x=>x.endsWith('.html')))fs.copyFileSync(path.join(root,'website',file),path.join(dest,file));
  for(const folder of ['css','js','assets'])fs.cpSync(path.join(root,'website',folder),path.join(dest,folder),{recursive:true});
 }else{
  const assets=path.join(root,component,'dist/assets');const js=fs.readdirSync(assets).filter(x=>x.endsWith('.js')).map(x=>fs.readFileSync(path.join(assets,x),'utf8')).join('');assert.ok(js.includes('https://api.ucell.life/api/v1'));assert.ok(!js.includes('api-stage.ucell.life'));if(component==='admin'){assert.ok(js.includes('0dd08c48-b6e9-4b19-b67a-d3de401f9092'));assert.ok(js.includes('https://admin.ucell.life/login'));}else{assert.ok(js.includes('2012021712-Dqh6Z8aq'));assert.ok(js.includes('624267916918-10vr4skhkfdtcc9f708sppios9s01tn1.apps.googleusercontent.com'));}
  fs.cpSync(path.join(root,component,'dist'),dest,{recursive:true});
 }
 // Overlay assets only; preserve deployed nginx configuration and website API proxy.
 fs.writeFileSync(path.join(dir,'Dockerfile'),`FROM ${baseline[component]}\nCOPY dist/ /usr/share/nginx/html/\n`);
 for(const name of ['portrait','welcome','avatar'])assert.equal(fs.readFileSync(path.join(dest,'assets/virtual-agent',name+'.webp')).compare(fs.readFileSync(path.join(root,'shared/virtual-agent',name+'.webp'))),0);
}
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files.push({path:path.relative(out,p),sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});}}
for(const c of ['admin','member','website'])walk(path.join(out,c));fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({baseline,observed,files},null,2));console.log('Prepared three frontend-only release images; verified identity configuration and identical character assets.');
