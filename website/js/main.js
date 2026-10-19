
document.addEventListener('DOMContentLoaded',()=>{
 const burger=document.querySelector('.burger'), menu=document.querySelector('.menu');
 if(burger&&menu){
   const fitMenu=()=>{if(menu.classList.contains('open'))menu.style.setProperty('--menu-top',`${Math.max(0,burger.closest('.header').getBoundingClientRect().bottom)}px`);};
   const setOpen=open=>{menu.classList.toggle('open',open);burger.setAttribute('aria-expanded',String(open));burger.setAttribute('aria-label',open?'關閉導覽':'開啟導覽');fitMenu();};
   burger.addEventListener('click',()=>setOpen(!menu.classList.contains('open')));
   menu.addEventListener('keydown',event=>{if(event.key==='Escape'){setOpen(false);burger.focus();}});
   window.addEventListener('resize',fitMenu);
   window.addEventListener('scroll',fitMenu,{passive:true});
 }
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
