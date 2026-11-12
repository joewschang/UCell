import {pathToFileURL} from 'node:url';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..'),member=path.join(root,'member'),require=createRequire(path.join(member,'package.json'));
const ts=require('typescript'),{build}=require('vite');
const dir=import.meta.dirname,site=path.join(dir,'site'),out=path.join(dir,'output');fs.mkdirSync(out,{recursive:true});
if(JSON.parse(fs.readFileSync(path.join(member,'node_modules/@line/liff/package.json'))).version!=='2.31.1')throw Error('LIFF version mismatch');
const built=await build({configFile:false,root:member,resolve:{alias:{'@line/liff':path.join(member,'node_modules/@line/liff/index.mjs')}},build:{write:false,minify:true,lib:{entry:path.join(dir,'sdk-entry.js'),formats:['es'],fileName:'sdk'},rollupOptions:{}}});
const chunk=(Array.isArray(built)?built[0]:built).output.find(x=>x.type==='chunk');if(!chunk||chunk.imports.length)throw Error('SDK must be self contained');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16),sdkPath='/assets/liff-2.31.1-'+hash(chunk.code)+'.js';
const outputs=new Map([[sdkPath,chunk.code]]),changes=[];let html=fs.readFileSync(path.join(site,'index.html'),'utf8');
const active=html.match(/<script type="module" crossorigin src="([^"]+)"/)[1];
function patch(rel,alias,endMarker){
 const file=path.join(site,rel),code=fs.readFileSync(file,'utf8'),end=code.indexOf(endMarker)+endMarker.length;if(end<endMarker.length)throw Error('Missing SDK end');
 const program=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true}),checker=program.getTypeChecker(),source=program.getSourceFile(file);
 const candidates=[...code.matchAll(/var ([\w$]+)=function\(([\w$]+),([\w$]+)\)\{return \1=Object\.setPrototypeOf/g)].filter(m=>m.index<code.indexOf('2.31.0'));
 let boundary;
 for(const match of candidates){const start=match.index,refs=new Set();
  function visit(n){if(ts.isIdentifier(n)&&(n.getStart()<start||n.getStart()>=end)){const s=checker.getSymbolAtLocation(n);if(s?.declarations?.some(d=>d.getStart()>=start&&d.end<=end))refs.add(n.text);}ts.forEachChild(n,visit)}visit(source);
  if(refs.size===1&&refs.has(alias)){boundary=start;break;}
 }
 if(boundary===undefined)throw Error('SDK block shares unexpected bindings: '+rel);
 const result=`import ${alias} from '${sdkPath}';\n`+code.slice(0,boundary)+code.slice(end);
 if(result.includes('2.31.0'))throw Error('Old SDK remains');
 const url='/'+rel.replace(/\\/g,'/').replace(/\.js$/, '-liff-'+hash(result)+'.js');outputs.set(url,result);changes.push({old:'/'+rel.replace(/\\/g,'/'),new:url,removedBytes:end-boundary,onlyExternalBinding:alias});
}
patch(active.slice(1),'Ze','var Ze=Yd;');patch('greetings/entry.js','gs','var gs=vs;');
for(const c of changes)html=html.replaceAll(c.old,c.new);
html=html.replace('<script src="'+changes[1].new,'<script type="module" src="'+changes[1].new);
// Replace every HTML reference. Old pages requesting active former URLs get a no-store redirect.
outputs.set('/index.html',html);
const retired=[];function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,ent.name);if(ent.isDirectory())walk(file);else if(ent.name.endsWith('.js')&&fs.readFileSync(file,'utf8').includes('2.31.0'))retired.push('/'+path.relative(site,file).replaceAll('\\','/'));}}walk(site);
let nginx='map_hash_bucket_size 256;\n'+fs.readFileSync(path.join(dir,'nginx-base.conf'),'utf8');
nginx=nginx.replace('  default "no-store',retired.map(p=>`  "${p}" "no-store, max-age=0";`).join('\n')+'\n  default "no-store');
const locations=retired.map(p=>{const redirect=changes.find(c=>c.old===p);if(redirect?.old==='/greetings/entry.js')return `  location = ${p} { default_type application/javascript; return 200 "import('${redirect.new}');"; }`;
return `  location = ${p} { return ${redirect?'302 '+redirect.new:'410'}; }`;}).join('\n');
nginx=nginx.replace('  index index.html;','  index index.html;\n  absolute_redirect off;\n'+locations);outputs.set('/default.conf',nginx);
for(const [url,code] of outputs){const file=path.join(out,url);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,code);}
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({version:'2.31.1',baseDigest:'sha256:813733a516347c8b682607158375416cf5cc8297c2cabc049d913d9c7848ed2a',sdkPath,changes,retiredPaths:retired},null,2)+'\n');
console.log(JSON.stringify({sdkPath,changes,retired:retired.length}));
