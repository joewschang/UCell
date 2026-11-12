import test from 'node:test';
import assert from 'node:assert/strict';
import {timeValues,sortRendered} from '../../../admin/src/time-sort/chronology.mjs';
import {trackRead,mapList,renderMeta,pageSource,collectPages} from '../../../admin/src/time-sort/pages.mjs';

test('Taipei written dates, day periods and ISO offsets identify the same instant',()=>{
 const expected=Date.parse('2026-11-13T13:04:06+00:00');
 for(const text of ['115/11/13 晚上9:04:06','民國115年11月13日 下午9:04:06','11/13/2026 9:04:06 PM','2026-11-13T21:04:06+08:00','2026-11-13T13:04:06Z'])assert.deepEqual(timeValues(text),[expected],text);
 assert(timeValues('2026/11/13 上午12:00')[0]<timeValues('2026/11/13 中午12:00')[0]);
 assert.deepEqual(timeValues('尚未完成、訂單 SL20261113005、2026-02-30'),[]);
 assert.equal(timeValues('2025-03 至 2026-03').length,2);
});
test('ties stay stable, missing values stay at the end in both directions',()=>{
 const rows=[{id:'a',t:null},{id:'b',t:1},{id:'c',t:2},{id:'d',t:1}];
 assert.deepEqual(sortRendered(rows,r=>r.t,false).map(r=>r.id),['b','d','c','a']);
 assert.deepEqual(sortRendered(rows,r=>r.t,true).map(r=>r.id),['c','b','d','a']);
});
test('page navigation preserves filters, true offset of last short page and distinct rows sharing a qualification',async()=>{
 const base='/admin/orders?q=example',all=[{name:'first',qualificationId:'Q'},{name:'second',qualificationId:'Q'},{name:'third',qualificationId:'Q'}];
 const read=async path=>{const url=new URL(path,'https://local');assert.equal(url.searchParams.get('q'),'example');const page=Number(url.searchParams.get('page')||1);return {data:all.slice((page-1)*2,page*2),meta:{page,total:3,hasNext:page===1}};};
 const url=base+'&page=2',reply=trackRead(url,await read(url),read),rendered=mapList(reply.data,row=>({props:{children:row.name}}));
 const result=await collectPages(pageSource(renderMeta(rendered)),new AbortController().signal);
 assert.deepEqual(result,{all,offset:2,size:1});
});
test('opaque placement cursor uses after and is read under the original status filter',async()=>{
 const read=async path=>{const u=new URL(path,'https://local');assert.equal(u.searchParams.get('status'),'PLACED');assert(!u.searchParams.has('cursor'));
   return u.searchParams.get('after')==='opaque'?{data:{items:[{id:'c'}],nextCursor:null,total:3}}:{data:{items:[{id:'a'},{id:'b'}],nextCursor:'opaque',total:3}};
 };
 const url='/admin/qualification-placements/dashboard?status=PLACED&after=opaque',reply=trackRead(url,await read(url),read);
 const source=pageSource(renderMeta(mapList(reply.data.items,row=>({props:{children:row.id}}))));
 const {all,offset}=await collectPages(source,new AbortController().signal);
 assert.equal(offset,2);assert.deepEqual(all.map(r=>r.id),['a','b','c']);
 const ctrl=new AbortController();ctrl.abort();await assert.rejects(collectPages(source,ctrl.signal),/abort/i);
});
test('cyclic cursor fails instead of presenting incomplete data',async()=>{
 const url='/admin/sample?cursor=loop',read=async()=>({data:{items:[{id:1}],nextCursor:'loop'}});
 const reply=trackRead(url,await read(),read),source=pageSource(renderMeta(mapList(reply.data.items,row=>({props:{children:row.id}}))));
 await assert.rejects(collectPages(source,new AbortController().signal),/重複|重新排序/);
});
