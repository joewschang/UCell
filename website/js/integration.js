(()=>{
 const money=(value,currency)=>currency==='TWD'?`NT$${new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(Number(value))}`:new Intl.NumberFormat('zh-TW',{style:'currency',currency,maximumFractionDigits:2}).format(Number(value));
 async function read(kind){const response=await fetch(`/api/public/${kind}`,{credentials:'omit',signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('讀取失敗');const body=await response.json();if(!Array.isArray(body.data))throw new Error('資料格式錯誤');return body.data;}
 function message(node,text){node.replaceChildren(document.createTextNode(text));}
 async function products(){
  const nodes=[...document.querySelectorAll('[data-product-sku]')];if(!nodes.length)return;
  try{const catalog=new Map((await read('products')).map(p=>[p.sku,p]));
   for(const node of nodes){const p=catalog.get(node.dataset.productSku),price=node.querySelector('[data-product-price]'),buy=node.querySelector('[data-product-buy]');
    const title=node.querySelector('h3,h1');if(p&&title)title.textContent=p.name;
    if(price)message(price,p?`${money(p.price,p.currency)} / 盒${p.available?'':' · 暫未開放購買'}`:'目前未上架');
    if(buy)buy.hidden=!p?.available;
    node.classList.toggle('is-unavailable',!p?.available);
   }
  }catch{for(const node of nodes){const price=node.querySelector('[data-product-price]');if(price){message(price,'暫時無法取得最新價格 ');const retry=document.createElement('button');retry.type='button';retry.className='link';retry.textContent='重新載入';retry.onclick=()=>void products();price.append(retry);}const buy=node.querySelector('[data-product-buy]');if(buy)buy.hidden=true;}}
 }
 async function events(){
  const list=document.querySelector('[data-event-list]');if(!list)return;
  message(list,'正在載入活動…');
  try{const rows=await read('events');list.replaceChildren();if(!rows.length){message(list,'目前尚無已發布活動，歡迎加入 LINE 官方帳號接收最新消息。');return;}
   const date=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'short'});
   for(const row of rows){const card=document.createElement('article');card.className='card event-card';const title=document.createElement('h3');title.textContent=row.title;const time=document.createElement('p');time.className='meta';time.textContent=`${date.format(new Date(row.startsAt))} — ${date.format(new Date(row.endsAt))}（台北時間）`;const description=document.createElement('p');description.className='event-description';description.textContent=row.description??'';const link=document.createElement('a');link.className='btn btn-navy';link.href=`https://member.ucell.life/events?event=${encodeURIComponent(row.eventCode)}`;link.textContent=row.canRegister?'會員登入與報名':'前往會員活動中心';card.append(title,time,description,link);list.append(card);}
  }catch{message(list,'目前無法載入活動，請稍後重試。 ');const retry=document.createElement('button');retry.type='button';retry.className='btn btn-line';retry.textContent='重新載入';retry.onclick=()=>void events();list.append(retry);}
 }
 document.addEventListener('DOMContentLoaded',()=>{void products();void events();const button=document.querySelector('.burger');button?.setAttribute('aria-expanded','false');button?.addEventListener('click',()=>button.setAttribute('aria-expanded',String(document.querySelector('.menu')?.classList.contains('open'))));});
})();
