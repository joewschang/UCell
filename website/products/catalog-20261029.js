/* Independent presentation module: does not write orders, prices or member data. */
(()=>{
 'use strict';
 const script=document.currentScript;
 const base=new URL('./',script?.src||location.href);
 const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 function install(catalog){
  const products=new Map(catalog.products.map(p=>[p.sku,p]));
  function detail(p){
   const box=make('details');box.className='uc-product-information';box.dataset.productInformation=p.sku;
   box.append(make('summary','新版包裝與商品說明'));
   const body=make('div');body.className='uc-product-information-body';
   body.append(make('h4',p.name+' '+p.sku),make('p',p.englishName+' · '+p.series),make('p',p.packaging),make('p',p.description));
   const highlights=make('p','新版原稿主題：'+p.highlights.join('、'));body.append(highlights);
   const a=make('a','開啟完整商品說明原稿');a.href=p.poster;a.target='_blank';a.rel='noopener noreferrer';body.append(a);
   const img=make('img');img.src=p.poster;img.alt=p.name+' '+p.sku+' 新版包裝與商品說明原稿';img.loading='lazy';img.width=905;img.height=1281;body.append(img,make('p',catalog.notice));box.append(body);return box;
  }
  function update(){
   document.querySelectorAll('img[src*="/products/tip-"]').forEach(img=>{
    // Keep selection icons compact. Only existing full product covers are replaced.
    const match=img.getAttribute('src')?.match(/\/products\/tip-(\d{3})\.png(?:\?.*)?$/);if(!match)return;
    const p=products.get('TIP-'+match[1]);if(!p)return;
    if(img.closest('tbody')){img.src=p.poster;img.alt=p.name+' 新版包裝';return;}
    const card=img.closest('.cart-product,.catalog-card');
    if(card){img.src=p.poster;img.alt=p.name+' 新版包裝';img.classList.add('uc-product-new-cover');
     card.querySelectorAll('p').forEach(n=>{if(n.textContent.startsWith('封面包裝標示：'))n.textContent=p.packaging;});
     if(!card.querySelector('[data-product-information]'))card.append(detail(p));
    }
   });
   document.querySelectorAll('.cart-product,.catalog-card').forEach(card=>{
    if(card.querySelector('[data-product-information]'))return;
    const img=card.querySelector('img');const match=img?.getAttribute('src')?.match(/tip-(\d{3})-20261029/);const p=match&&products.get('TIP-'+match[1]);if(p)card.append(detail(p));
   });
   document.querySelectorAll('[data-product-sku]').forEach(node=>{
    const p=products.get(node.dataset.productSku);if(!p)return;
    const image=node.querySelector('.product-detail .visual img');if(image){image.src=p.poster;image.alt=p.name+' 新版包裝與說明';}
    const lead=node.querySelector('.lead');if(lead)lead.textContent=p.description+' '+p.packaging+'。';
    if(!node.querySelector('[data-product-information]')){const section=make('section');section.className='section';section.append(detail(p));node.append(section);}
   });
  }
  let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;observer.disconnect();update();observer.observe(document.body,{childList:true,subtree:true});});});
  update();observer.observe(document.body,{childList:true,subtree:true});
 }
 fetch(new URL('catalog-20261029.json',base),{credentials:'omit'}).then(r=>{if(!r.ok)throw Error('catalog unavailable');return r.json();}).then(install).catch(()=>{/* Existing catalog and checkout remain usable if extra content is unavailable. */});
})();
