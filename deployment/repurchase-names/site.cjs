'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {createRequire} = require('node:module');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const config = {
  member: {
    image:'0735f27afde43957a39fc889ec56fbd89a793d3588f6ad9f2eebb4097c85f7db',
    html:'6472a1bedaa589c8304c0e006bd4b4541cda89ea122797396a48f87c11a8e3d2',
    entry:'member-inbox-1724f1aa0f1d2dfd.js', entryHash:'1724f1aa0f1d2dfdb33e445839b9fe78182cafd86a81741e113ee87cda33aea0',
    auxiliary:'/greetings/entry-liff-49f39ccad27068de.js', auxiliaryHash:'49f39ccad27068de34e5805803697f9c0299ef297202ab7fc34f78fad27884db', auxiliaryPrefix:'/greetings/entry-liff-'
  },
  admin: {
    image:'2866d686b1dec05187a2300e3204a50bb87bf03971e0aa7ae2969a7aa29f2b7d',
    html:'f486246f6d4905d5d0c275f4e4fa6a25ee29208a7cee7f0405788dd3fff24fb4',
    entry:'admin-workspace-7f177c1004cc5d21.js', entryHash:'f1965a08a77908bfbadef761db20ee469ae376f030f4fbbe7560e579da51e2e2',
    auxiliary:'/assets/award-verification-261112.js', auxiliaryPrefix:'/assets/award-verification-', auxiliaryHash:'714b8f0132ae559030b41c5777b4a8d9c44f89d8a040a46847eb1e7c931f947b'
  }
};
function once(source, from, to) {
  assert.equal(source.split(from).length,2,'Unrecognized release text: '+from);
  return source.replace(from,()=>to);
}
function terminology(text) {
  return text.replaceAll('重購訂閱與認列排程','重銷訂閱一覽').replaceAll('重購訂閱','重銷訂閱一覽')
    .replaceAll('重銷 重購 續訂','重銷 訂閱 續訂').replaceAll('重購','重銷');
}
function memberEntry(source) {
  const memberRoot=path.resolve(__dirname,'../../member');
  const project=createRequire(path.join(memberRoot,'package.json'));
  const esbuild=createRequire(project.resolve('vite/package.json'))('esbuild');
  const compiled=esbuild.transformSync(fs.readFileSync(path.join(memberRoot,'src/mall-category.ts'),'utf8'),{
    loader:'ts',format:'cjs',target:'es2020',minify:true,charset:'utf8'
  }).code;
  const helper='const UCellMallCategories=(()=>{const module={exports:{}};'+compiled+';return module.exports})();';
  let next=once(source,'const Pc=["會員資格套組","重銷方案套組","主商品","促銷商品套組"];',helper+'const Pc=UCellMallCategories.mallCategories;');
  next=once(next,'Pc.find(u=>u===n.get("category"))','UCellMallCategories.mallCategoryFromLink(n.get("category"))');
  next=once(next,'const u=n.get("category");u&&Pc.includes(u)&&a(u)','const u=UCellMallCategories.mallCategoryFromLink(n.get("category"));u&&a(u)');
  return once(next,'"/shop?category="+encodeURIComponent("重銷方案套組")','"/shop?category=repurchase"');
}
function prepare(app,root,out) {
  const baseline=config[app];
  assert(baseline,'Unknown site');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.equal(hash(html),baseline.html,'Unexpected deployed shell');
  function read(name,expected) {
    const bytes=fs.readFileSync(path.join(root,'assets',name));
    if(expected)assert.equal(hash(bytes),expected,name);
    return bytes.toString('utf8');
  }
  const dir=path.join(out,'overlay','assets');
  fs.mkdirSync(dir,{recursive:true});
  const save=(name,code)=>fs.writeFileSync(path.join(dir,name),code);
  const main=terminology(read(baseline.entry,baseline.entryHash));
  let code=app==='member'?memberEntry(main):require('./tracking-members.cjs').patchAdmin(main);
  const tag=hash(app==='admin'?code+'|module-and-preload-graph':code).slice(0,16);
  const entry=app+'-order-labels-'+tag+'.js';
  const replacements={['/assets/'+baseline.entry]:'/assets/'+entry};
  const lazy=[...new Set(Array.from(code.matchAll(/["']\.\/(\w[^"'\s/]*\.js)["']/g),m=>m[1]))];
  const chunks=new Map(lazy.map(name=>[name,name.slice(0,-3)+'-'+tag+'.js']));
  function updateChunks(text){
    for(const [from,to] of chunks)text=text.replaceAll(from,to);
    return text;
  }
  code=updateChunks(code);
  for(const [from,to] of chunks){
    save(to,updateChunks(terminology(read(from))).replaceAll(baseline.entry,entry));
  }
  save(entry,code);
  if(baseline.auxiliary){
    const bytes=fs.readFileSync(path.join(root,baseline.auxiliary));
    assert.equal(hash(bytes),baseline.auxiliaryHash,baseline.auxiliary);
    const aux=terminology(bytes.toString('utf8'));
    const auxName=baseline.auxiliaryPrefix+hash(aux).slice(0,16)+'.js';
    replacements[baseline.auxiliary]=auxName;
    const dest=path.join(out,'overlay',auxName);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.writeFileSync(dest,aux);
  }
  const manifest={app,entry,replacements,htmlHash:baseline.html,entryHash:hash(code)};
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
  fs.copyFileSync(path.join(__dirname,'install.cjs'),path.join(out,'install.cjs'));
  fs.writeFileSync(path.join(out,'Dockerfile'),[
    'FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-'+app+'@sha256:'+baseline.image+' AS base',
    'FROM node:22-alpine AS build','COPY --from=base /usr/share/nginx/html/ /site/',
    'COPY . /release','RUN node /release/install.cjs /site /release','FROM base',
    'COPY --from=build /site/ /usr/share/nginx/html/','RUN nginx -t',''
  ].join('\n'));
  console.log(app,entry,manifest.entryHash);
}
if(require.main===module)prepare(...process.argv.slice(2));
