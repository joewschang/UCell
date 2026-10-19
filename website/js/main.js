
document.addEventListener('DOMContentLoaded',()=>{
 const burger=document.querySelector('.burger'), menu=document.querySelector('.menu');
 if(burger&&menu) burger.addEventListener('click',()=>menu.classList.toggle('open'));
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
