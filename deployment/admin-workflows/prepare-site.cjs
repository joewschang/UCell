'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {prepare}=require('../third-placement/site/prepare.cjs');
const cash=require('./cash-ui/patch.cjs');
const [app,original,out]=process.argv.slice(2);
const transform=mod=>typeof mod==='function'?mod:mod.patch;
const sites={
  admin:{
    image:'264f17c82a6226d8af7e4c8ed61b9935c8a1b41992dd8a8c76a4710d822a861e',
    html:'43460da633e408481f42d4319c964d38b31676640cf942f6a8a9f8f69ea819b0',
    entry:'admin-agreement-ede7801a3d31da29.js',
    entryHash:'fee8164cbad59cab956a8244793f7b77bdb55100e592f8107876ee2cc6284a75',
    edits:[],transform(code){
      const tasks=transform(require('./tasks/patch.cjs')),sort=transform(require('./sort/patch.cjs'));
      return sort(tasks(cash.admin(code))) + require('./sort/external.cjs').externalStamp();
    }
  },
  member:{
    image:'ec1c0fbf51f7f0d6a223000f6358c090e518ad94bb031e9db6f27e434a228f3b',
    html:'fd6260da1961377a2031734428e0e1b43c084b7500dce8d5cadca58caf2d5723',
    entry:'member-agreement-2fdfeceaa46c1f43.js',entryHash:'2fdfeceaa46c1f43966c25d3044f5095a697e9d1e0480a2333d01e8e0c7bc982',
    edits:[],transform:cash.member
  }
};
prepare(app,original,out,sites[app],'workflows');
if(app==='admin'){
  const healthDir=path.join(out,'overlay','health','journey');
  fs.mkdirSync(healthDir,{recursive:true});
  fs.writeFileSync(path.join(healthDir,'manage.js'),fs.readFileSync(path.resolve(__dirname,'../health-journeys/admin/manage.js'),'utf8').replace(/\r\n/g,'\n'));
  const css=fs.readFileSync(path.resolve(__dirname,'../../admin/src/time-sort.css'),'utf8').replace(/\r\n/g,'\n');
  const name='time-sort-'+createHash('sha256').update(css).digest('hex').slice(0,16)+'.css';
  fs.writeFileSync(path.join(out,'overlay','assets',name),css);
  const file=path.join(out,'manifest.json'),manifest=JSON.parse(fs.readFileSync(file));
  require('./sort/external.cjs').prepareExternal(original,out,manifest);
  const anchor='<link rel="stylesheet" href="/assets/admin-workspace-edfb69cea0c3645d.css">';
  if(!fs.readFileSync(path.join(original,'index.html'),'utf8').includes(anchor)) throw Error('Admin stylesheet anchor missing');
  manifest.replacements[anchor]=anchor+'<link rel="stylesheet" href="/assets/'+name+'">';
  fs.writeFileSync(file,JSON.stringify(manifest,null,2));
}
