const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require('linkedom'),{render}=require('../scripts/build-faq.cjs');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'faq.html'),'utf8'),data=JSON.parse(fs.readFileSync(path.join(root,'content/faq.json'),'utf8'));
function setup(hash=''){
 const {window,document}=parseHTML(html);window.location={hash};
 const scrolled=[];document.querySelectorAll('[data-faq-item]').forEach(el=>el.scrollIntoView=()=>scrolled.push(el.id));
 vm.runInNewContext(fs.readFileSync(path.join(root,'js/support.js'),'utf8'),{window,document});
 document.dispatchEvent(new window.Event('DOMContentLoaded'));
 const visible=()=>[...document.querySelectorAll('[data-faq-item]')].filter(el=>!el.hidden);
 const search=value=>{const input=document.querySelector('#faq-search');input.value=value;input.dispatchEvent(new window.Event('input'));};
 return {window,document,visible,search,scrolled};
}
test('published FAQ is generated from one source and all answers work without scripts',()=>{
 assert.ok(html.includes(render(data)));
 const {document}=parseHTML(html);
 assert.equal(document.querySelectorAll('[data-faq-item]').length,data.items.length);
 assert.equal(document.querySelector('[data-faq-tools]').hidden,true);
 for(const item of data.items){const el=document.getElementById('faq-'+item.id);assert.ok(el);assert.ok(el.textContent.includes(item.answer));assert.equal(el.hidden,false);}
});
test('FAQ search combines classification and normalized keywords; no result can reset',()=>{
 const {document,visible,search}=setup();
 assert.equal(visible().length,12);
 document.querySelector('[data-faq-category="products"]').click();
 assert.equal(visible().length,3);
 search('價格');assert.equal(visible()[0].id,'faq-price');
 search('不存在');assert.equal(visible().length,0);assert.equal(document.querySelector('[data-faq-empty]').hidden,false);
 document.querySelector('[data-faq-reset]').click();assert.equal(visible().length,12);assert.equal(document.querySelector('[data-faq-category="all"]').getAttribute('aria-pressed'),'true');
 search('ｇｏｏｇｌｅ');assert.equal(visible().length,1);assert.equal(visible()[0].id,'faq-register');
 search('Google   註冊');assert.equal(visible().length,1);
 document.querySelector('[data-faq-clear]').click();assert.equal(visible().length,12);
});
test('direct answer links expand answers and clear filters on hash navigation',()=>{
 const {document,window,visible,search,scrolled}=setup('#faq-returns');
 assert.equal(document.getElementById('faq-returns').open,true);assert.deepEqual(scrolled,['faq-returns']);
 search('不存在');assert.equal(visible().length,0);
 window.location.hash='#faq-register';window.dispatchEvent(new window.Event('hashchange'));
 assert.equal(document.getElementById('faq-register').open,true);assert.equal(visible().length,12);
 assert.equal(scrolled.at(-1),'faq-register');
});
test('invalid or unrelated hashes do not crash or change the FAQ',()=>{
 for(const hash of ['#%E0%A4%A','#missing','#<script>']){const {visible,scrolled}=setup(hash);assert.equal(visible().length,12);assert.equal(scrolled.length,0);}
});
test('FAQ content escapes markup, rejects unsafe URLs and duplicate IDs',()=>{
 const copy=structuredClone(data);copy.items[0].answer='<script>alert(1)</script>';
 const rendered=render(copy);assert.ok(rendered.includes('&lt;script&gt;'));assert.ok(!rendered.includes('<script>'));
 copy.items[0].link.href='javascript:alert(1)';assert.throws(()=>render(copy),/destination/);
 const duplicate=structuredClone(data);duplicate.items[1].id=duplicate.items[0].id;assert.throws(()=>render(duplicate),/item/);
});
test('all help and journey fragments point to existing answers; all pages expose help',()=>{
 for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
  const {document}=parseHTML(fs.readFileSync(path.join(root,file),'utf8'));
  assert.ok(document.querySelector('.utility a[href="faq.html"]'),file);
  for(const a of document.querySelectorAll('a[href*=".html#"]')){
   const href=a.getAttribute('href');if(href.startsWith('https:'))continue;
   const [page,id]=href.split('#'),target=parseHTML(fs.readFileSync(path.join(root,page),'utf8')).document;
   assert.ok(target.getElementById(id),file+': '+href);
  }
 }
});
