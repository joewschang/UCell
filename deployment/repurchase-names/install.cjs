'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const [root,release]=process.argv.slice(2);
const {htmlHash,replacements}=JSON.parse(fs.readFileSync(path.join(release,'manifest.json')));
assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,'index.html'))).digest('hex'),htmlHash);
fs.cpSync(path.join(release,'overlay'),root,{recursive:true});
function replaceEntries(dir){
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const name=path.join(dir,item.name);
    if(item.isDirectory()){replaceEntries(name);continue;}
    if(!item.isFile()||!item.name.endsWith('.html'))continue;
    const original=fs.readFileSync(name,'utf8');
    let updated=original;
    for(const [from,to] of Object.entries(replacements))updated=updated.replaceAll(from,to);
    if(original!==updated)fs.writeFileSync(name,updated);
  }
}
replaceEntries(root);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const value of Object.values(replacements))assert(html.includes(value),value);
