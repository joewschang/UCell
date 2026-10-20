
document.addEventListener('DOMContentLoaded',()=>{
 const burger=document.querySelector('.burger'), menu=document.querySelector('.menu');
 if(burger&&menu){
   const fitMenu=()=>{if(menu.classList.contains('open'))menu.style.setProperty('--menu-top',`${Math.max(0,burger.closest('.header').getBoundingClientRect().bottom)}px`);};
   const setOpen=open=>{menu.classList.toggle('open',open);burger.setAttribute('aria-expanded',String(open));burger.setAttribute('aria-label',open?'關閉導覽':'開啟導覽');fitMenu();};
   burger.addEventListener('click',()=>setOpen(!menu.classList.contains('open')));
   menu.addEventListener('keydown',event=>{if(event.key==='Escape'){setOpen(false);burger.focus();}});
   document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.classList.contains('open')){setOpen(false);burger.focus();}});
   document.addEventListener('click',event=>{if(!event.target.closest('.header'))setOpen(false);});
   menu.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false);});
   document.addEventListener('focusin',event=>{if(!event.target.closest('.header'))setOpen(false);});
   window.addEventListener('resize',()=>{if(window.innerWidth>1180)setOpen(false);else fitMenu();});
   window.addEventListener('scroll',fitMenu,{passive:true});
 }
 const page=window.location.pathname.split('/').pop()||'index.html';
 const groups={
   'about.html':['vision.html','values.html','sustainability.html'],
   'science.html':['ingredients.html','evidence.html','quality.html','research-policy.html'],
   'products.html':['product-363.html','product-580.html','product-636.html','product-696.html','product-777.html','product-999.html'],
   'membership.html':['returns.html']
 };
 document.querySelectorAll('.menu>a,.actions>a,.mobile-member-actions>a').forEach(a=>{
   const href=a.getAttribute('href');
   if(href===page)a.setAttribute('aria-current','page');
   else if(groups[href]?.includes(page))a.setAttribute('aria-current','location');
 });
 document.querySelectorAll('[data-search]').forEach(input=>{
   const target=input.dataset.search;
   input.addEventListener('input',()=>{
     const q=input.value.trim().toLowerCase();
     document.querySelectorAll(target).forEach(el=>{
       el.classList.toggle('hidden', q && !el.innerText.toLowerCase().includes(q));
     });
   });
 });
 document.querySelectorAll('[data-filter]').forEach(btn=>{
   btn.addEventListener('click',()=>{
     const value=btn.dataset.filter;
     document.querySelectorAll('.product-card[data-cat]').forEach(card=>{
       card.classList.toggle('hidden', value!=='all' && card.dataset.cat!==value);
     });
   });
 });
});
