const assert=require('node:assert/strict'),{test}=require('node:test'),{applyMenu}=require('./season.cjs');
function fixture(initial){let menu=initial,verbs=[];async function req(path,method='GET',opts){
 if(method==='GET'){if(path.startsWith('/richmenu/'))return path.endsWith('/gone')?null:{richMenuId:path.split('/').at(-1)};return menu?{richMenuId:menu}:null}
 verbs.push(method);menu=method==='DELETE'?null:path.split('/').at(-1);return {};
}return {req,get:()=>menu,verbs}}
for(const [initial,desired,previous,expected] of [[null,'x',null,'x'],['x','y','custom','y'],['x',null,'custom','custom'],['y',null,null,null],['x',null,'gone',null],['externallyChanged',null,'custom','externallyChanged'],['x','x',null,'x']]){
 test([initial,desired,previous].join('/'),async()=>{const f=fixture(initial);await applyMenu('test',desired,previous,['x','y'],f.req);assert.equal(f.get(),expected);if(initial===expected)assert.equal(f.verbs.length,0)})
}
test('LINE must confirm the actual new link',async()=>{await assert.rejects(applyMenu('test','x',null,['x'],async()=>null),/not confirmed/)});
