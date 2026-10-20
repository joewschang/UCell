const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'js/integration.js'),'utf8');
const product=(sku,extra={})=>({sku,name:sku+' 正式商品',iconUrl:'/products/'+sku.toLowerCase()+'.png',price:'4800',currency:'TWD',available:true,...extra});
async function render(page,answer){
 const {window}=parseHTML(fs.readFileSync(path.join(root,page),'utf8'));
 let calls=0;
 const fetch=async url=>{
  if(url!=='/api/public/products')return {ok:true,json:async()=>({data:[]})};
  calls++;const result=typeof answer==='function'?answer(calls):answer;
  if(result instanceof Error)throw result;
  return {ok:true,json:async()=>({data:result})};
 };
 vm.runInNewContext(script,{document:window.document,fetch,AbortSignal,Intl,URL,console});
 window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
 await new Promise(setImmediate);
 return {document:window.document,window,calls:()=>calls};
}
for(const page of ['index.html','products.html']){
 test(page+' renders all and only backend products, with the current image, name and price',async()=>{
  const rows=['TIP-363','TIP-580','TIP-696','TIP-777','TIP-999'].map(s=>product(s));
  const {document,calls}=await render(page,rows);
  assert.equal(calls(),1);assert.equal(document.querySelectorAll('[data-catalog-sku]').length,5);
  assert.equal(document.querySelector('[data-catalog-sku="TIP-636"]'),null);
  assert.match(document.querySelector('[data-product-count]').textContent,/5 項/);
  for(const row of rows){
   const card=document.querySelector('[data-catalog-sku="'+row.sku+'"]');
   assert.equal(card.querySelector('h3').textContent,row.name);
   assert.equal(card.querySelector('img').getAttribute('src'),row.iconUrl);
   assert.match(card.querySelector('.catalog-price').textContent,/4,800/);
   assert.equal(card.querySelector('.btn-navy').getAttribute('href'),'https://member.ucell.life/shop?sku='+row.sku);
   assert.equal(card.querySelector('img').getAttribute('loading'),'lazy');
  }
  assert.equal(document.querySelector('[data-product-list]').getAttribute('aria-busy'),'false');
 });
}
test('new products appear without a source edit; unpublished products disappear on the next load',async()=>{
 const {document}=await render('index.html',[product('TIP-123',{name:'新上架商品',price:'3600'})]);
 assert.equal(document.querySelectorAll('[data-catalog-sku]').length,1);
 assert.equal(document.querySelector('[data-catalog-sku="TIP-363"]'),null);
 assert.equal(document.querySelector('a[href="product-123.html"]'),null);
 assert.match(document.querySelector('.catalog-price').textContent,/3,600/);
});
test('unavailable products have no purchase action; unsafe names remain plain text and unsafe images use fallback',async()=>{
 const {document}=await render('index.html',[product('TIP-363',{name:'<script>alert(1)</script>',available:false,iconUrl:'https://evil.example/image.png'})]);
 const card=document.querySelector('.catalog-card');
 assert.equal(card.querySelector('h3').textContent,'<script>alert(1)</script>');
 assert.equal(card.querySelector('script'),null);assert.equal(card.querySelector('img'),null);
 assert.equal(card.querySelector('.btn-navy'),null);assert.match(card.textContent,/暫未開放選購/);
});
test('a failed image leaves a useful placeholder and does not retry recursively',async()=>{
 const {document,window}=await render('index.html',[product('TIP-363')]);
 const image=document.querySelector('.catalog-image'),fallback=document.querySelector('.catalog-image-fallback');
 image.dispatchEvent(new window.Event('load'));assert.equal(fallback.hidden,true);
 image.dispatchEvent(new window.Event('error'));assert.equal(fallback.hidden,false);assert.equal(document.querySelector('.catalog-image'),null);
});
test('empty catalog is explicit, with no fabricated products',async()=>{
 const {document}=await render('index.html',[]);
 assert.equal(document.querySelectorAll('.catalog-card').length,0);
 assert.match(document.querySelector('[data-product-list]').textContent,/目前尚無上架商品/);
});
test('network failures offer a working retry and never leave stale cards',async()=>{
 const {document,calls}=await render('index.html',n=>n===1?new Error('offline'):[product('TIP-363')]);
 const list=document.querySelector('[data-product-list]');
 assert.match(list.textContent,/資料暫時無法載入/);
 await list.querySelector('button').onclick();
 assert.equal(calls(),2);assert.equal(list.querySelectorAll('.catalog-card').length,1);
 assert.equal(list.getAttribute('aria-busy'),'false');
});
test('invalid prices fail closed instead of displaying misleading prices or purchase links',async()=>{
 const {document}=await render('index.html',[product('TIP-363',{price:'not-a-price'})]);
 assert.equal(document.querySelectorAll('.catalog-card').length,0);
 assert.match(document.querySelector('[data-product-list]').textContent,/資料暫時無法載入/);
});
test('catalog search matches name or SKU, handles no results, and clears without refetching',async()=>{
 const {document,window,calls}=await render('products.html',[product('TIP-363',{name:'晶萃源力飲'}),product('TIP-580')]);
 const search=document.querySelector('[data-catalog-search]');assert.equal(search.disabled,false);
 search.value=' tip-363 ';search.dispatchEvent(new window.Event('input'));assert.equal(document.querySelectorAll('.catalog-card').length,1);
 search.value='晶萃';search.dispatchEvent(new window.Event('input'));assert.equal(document.querySelectorAll('.catalog-card').length,1);
 search.value='沒有這個產品';search.dispatchEvent(new window.Event('input'));assert.equal(document.querySelectorAll('.catalog-card').length,0);assert.match(document.querySelector('[data-product-list]').textContent,/沒有符合的產品/);
 document.querySelector('[data-catalog-clear]').click();assert.equal(search.value,'');assert.equal(document.querySelectorAll('.catalog-card').length,2);assert.equal(calls(),1);
});
