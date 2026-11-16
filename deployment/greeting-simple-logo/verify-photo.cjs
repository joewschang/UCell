const fs=require('fs'),p=require('path'),assert=require('assert'),root=p.resolve(__dirname,'../..');
const ts=require(require.resolve('typescript',{paths:[p.join(root,'backend')]}));
const source=p.join(root,'backend/apps/api/src/modules/daily-greetings'),out=p.join(__dirname,'candidate');
fs.mkdirSync(p.join(out,'assets'),{recursive:true});
for(const name of ['greeting-brand','greeting-photo','greeting-art','daily-greeting','render-greeting'])fs.writeFileSync(p.join(out,name+'.js'),ts.transpileModule(fs.readFileSync(p.join(source,name+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
for(const name of ['ucell-simple-logo.png','ucell-line-qr.png','sunday-kitten-background.png'])fs.copyFileSync(p.join(source,'assets',name),p.join(out,'assets',name));
const PNG=require('./tools/node_modules/pngjs').PNG,jsqr=require('./tools/node_modules/jsqr');
const {greetingSvg}=require('./candidate/daily-greeting'),{renderGreeting}=require('./candidate/render-greeting');
(async()=>{const date='2026-11-15',svg=greetingSvg(date,'data:image/jpeg;base64,dGVzdA==');assert(!svg.includes('data:image/jpeg'));assert(svg.includes('週末愉快'));assert(!svg.includes('平安自在'));const buf=await renderGreeting(svg,process.env.DAILY_GREETING_FONT_PATH);const x=PNG.sync.read(buf);assert.equal(x.width,1080);assert.equal(x.height,1080);assert(buf.length<5*1024*1024);assert.equal(jsqr(new Uint8ClampedArray(x.data),x.width,x.height)?.data,'https://lin.ee/pqS11xX');fs.mkdirSync(p.join(__dirname,'preview'),{recursive:true});fs.writeFileSync(p.join(__dirname,'preview/today.png'),buf);console.log(JSON.stringify({date,bytes:buf.length,qr:'https://lin.ee/pqS11xX',checks:7,pass:true}));})().catch(e=>{console.error(e);process.exitCode=1;});
