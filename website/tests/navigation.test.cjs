const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const {parseHTML}=require('linkedom');const root=path.resolve(__dirname,'..');
test('every page has a reachable skip target and valid local page links',()=>{
 for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){const {document}=parseHTML(fs.readFileSync(path.join(root,file),'utf8'));assert.equal(document.querySelectorAll('#main-content').length,1,file);assert.ok(document.querySelector('.skip-link'),file);
 for(const a of document.querySelectorAll('a[href]')){const href=a.getAttribute('href');if(/^[\w-]+\.html(?:#.*)?$/.test(href))assert.ok(fs.existsSync(path.join(root,href.split('#')[0])),file+': '+href);}
 }
});
test('mobile navigation closes on Escape, outside click, selection and desktop resize; highlights current section',()=>{
 const {window,document}=parseHTML(fs.readFileSync(path.join(root,'products.html'),'utf8'));window.location={pathname:'/products.html'};window.innerWidth=390;document.querySelector('.header').getBoundingClientRect=()=>({bottom:76});
 vm.runInNewContext(fs.readFileSync(path.join(root,'js/main.js'),'utf8'),{window,document});document.dispatchEvent(new window.Event('DOMContentLoaded'));
 const burger=document.querySelector('.burger'),menu=document.querySelector('.menu');assert.equal(menu.querySelector('a[href="products.html"]').getAttribute('aria-current'),'page');
 burger.click();assert.equal(burger.getAttribute('aria-expanded'),'true');const escape=new window.Event('keydown',{bubbles:true});escape.key='Escape';menu.dispatchEvent(escape);assert.equal(burger.getAttribute('aria-expanded'),'false');
 burger.click();document.querySelector('main').click();assert.equal(menu.classList.contains('open'),false);
 burger.click();menu.querySelector('a').click();assert.equal(menu.classList.contains('open'),false);
 burger.click();window.innerWidth=1280;window.dispatchEvent(new window.Event('resize'));assert.equal(menu.classList.contains('open'),false);
});
