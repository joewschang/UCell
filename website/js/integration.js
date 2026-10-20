(()=>{
 const member='https://member.ucell.life';
 const money=(value,currency)=>currency==='TWD'?`NT$${new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(Number(value))}`:new Intl.NumberFormat('zh-TW',{style:'currency',currency,maximumFractionDigits:2}).format(Number(value));
 const element=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text)el.textContent=text;return el;};
 const link=(text,href,className='btn btn-navy')=>{const a=element('a',className,text);a.href=href;return a;};
 async function read(kind){const response=await fetch(`/api/public/${kind}`,{credentials:'omit',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('讀取失敗');const body=await response.json();if(!Array.isArray(body.data))throw Error('資料格式錯誤');return body.data;}
 function status(node,title,description,action){const box=element('div','discovery-state');box.append(element('span','state-symbol','○'),element('h3','',title),element('p','',description));if(action)box.append(action);node.replaceChildren(box);}
 function failure(node,retry){const button=element('button','btn btn-line','重新載入');button.type='button';button.onclick=retry;status(node,'資料暫時無法載入','請檢查網路連線，或稍後再試。',button);}
 const productPages=new Set(['TIP-363','TIP-580','TIP-636','TIP-696','TIP-777','TIP-999']);
 const productImage=path=>typeof path==='string'&&/^\/products\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(path)?path:null;
 function productCard(p){
  const card=element('article','catalog-card');card.dataset.catalogSku=p.sku;
  const visual=element('div','catalog-visual'),fallback=element('div','catalog-image-fallback');fallback.append(element('span','','UCELL'),element('small','','商品圖片準備中'));visual.append(fallback);
  const path=productImage(p.iconUrl);
  if(path){const image=element('img','catalog-image');image.alt=p.name+' 商品圖片';image.setAttribute('width','1200');image.setAttribute('height','900');image.setAttribute('loading','lazy');image.setAttribute('decoding','async');image.addEventListener('load',()=>{fallback.hidden=true;image.classList.add('is-loaded')},{once:true});image.addEventListener('error',()=>{image.remove();fallback.hidden=false},{once:true});image.src=path;visual.append(image);}
  const body=element('div','catalog-body'),meta=element('div','catalog-card-meta');meta.append(element('span','catalog-sku',p.sku),element('span',p.available?'catalog-availability':'catalog-availability is-pending',p.available?'開放選購':'暫未開放選購'));
  body.append(meta,element('h3','',p.name),element('p','catalog-price',money(p.price,p.currency)));
  const actions=element('div','catalog-actions');if(productPages.has(p.sku)){const details=link('產品介紹','product-'+p.sku.slice(4)+'.html','btn btn-line');details.setAttribute('aria-label',p.name+'：產品介紹');actions.append(details);}
  if(p.available){const buy=link('會員選購',member+'/shop?sku='+encodeURIComponent(p.sku));buy.setAttribute('aria-label',p.name+'：前往會員商城選購');actions.append(buy);}
  if(actions.childElementCount)body.append(actions);card.append(visual,body);return card;
 }
 let productsLoading=false;
 let catalogRows=null;
 function renderCatalog(){
  if(!catalogRows)return;
  const search=document.querySelector('[data-catalog-search]'),query=(search?.value||'').trim().toLowerCase();
  const visible=catalogRows.filter(p=>`${p.sku} ${p.name}`.toLowerCase().includes(query));
  document.querySelectorAll('[data-product-list]').forEach(list=>{
   list.replaceChildren();
   if(!catalogRows.length)status(list,'新品準備中，敬請期待','目前尚無上架商品，歡迎稍後再來看看。',link('聯絡我們','contact.html','btn btn-line'));
   else if(!visible.length)status(list,'沒有符合的產品','試試產品名稱或編號，或清除搜尋查看所有上架商品。');
   else visible.forEach(p=>list.append(productCard(p)));
  });
  document.querySelectorAll('[data-product-count]').forEach(n=>n.textContent=query?`找到 ${visible.length} / ${catalogRows.length} 項商品`:catalogRows.length?catalogRows.length+' 項上架商品':'目前尚無上架商品');
  const clear=document.querySelector('[data-catalog-clear]');if(clear)clear.hidden=!query;
 }
 async function products(){
  const nodes=[...document.querySelectorAll('[data-product-sku]')],lists=[...document.querySelectorAll('[data-product-list]')],counts=[...document.querySelectorAll('[data-product-count]')];if((!nodes.length&&!lists.length)||productsLoading)return;
  productsLoading=true;lists.forEach(n=>{n.setAttribute('aria-busy','true');status(n,'正在載入商品…','為您取得最新商品與售價。')});counts.forEach(n=>n.textContent='');
  try{const rows=await read('products');if(!rows.every(p=>p&&/^TIP-\d{3}$/.test(p.sku)&&typeof p.name==='string'&&p.name.trim()&&typeof p.available==='boolean'&&typeof p.price==='string'&&/^[A-Z]{3}$/.test(p.currency)&&Number.isFinite(Number(p.price))&&Number(p.price)>=0)||new Set(rows.map(p=>p.sku)).size!==rows.length)throw Error('商品資料格式錯誤');
   const catalog=new Map(rows.map(p=>[p.sku,p]));
   catalogRows=rows;renderCatalog();const search=document.querySelector('[data-catalog-search]');if(search)search.disabled=false;
   for(const node of nodes){const p=catalog.get(node.dataset.productSku),price=node.querySelector('[data-product-price]'),buy=node.querySelector('[data-product-buy]'),title=node.querySelector('h3,h1');
    if(p&&title)title.textContent=p.name;
    if(price)price.textContent=p?money(p.price,p.currency)+(p.available?'':' · 暫未開放購買'):'目前未上架';
    if(buy){buy.hidden=!p?.available;buy.href=member+'/shop?sku='+encodeURIComponent(node.dataset.productSku);buy.textContent='選購此商品';}
    node.classList.toggle('is-unavailable',!p?.available);
   }
  }catch{lists.forEach(n=>failure(n,products));counts.forEach(n=>n.textContent='');for(const node of nodes){const price=node.querySelector('[data-product-price]'),buy=node.querySelector('[data-product-buy]');if(price){price.textContent='暫時無法取得最新價格 ';const retry=element('button','link','重新載入');retry.type='button';retry.onclick=products;price.append(retry);}if(buy)buy.hidden=true;}}
  finally{productsLoading=false;lists.forEach(n=>n.setAttribute('aria-busy','false'));}
 }
 async function events(){
  const lists=[...document.querySelectorAll('[data-event-list]')];if(!lists.length)return;
  lists.forEach(n=>{n.setAttribute('aria-busy','true');status(n,'正在讀取近期活動','為您整理最新的交流與學習機會。')});
  try{const rows=await read('events');const date=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'long',day:'numeric'}),time=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false});
   for(const list of lists){list.replaceChildren();if(!rows.length){status(list,'下一場相聚，敬請期待','目前沒有已發布的近期活動。加入官方 LINE，掌握活動消息。',link('加入官方 LINE','https://lin.ee/pqS11xX','btn btn-line'));continue;}
    for(const row of rows.slice(0,Number(list.dataset.limit)||100)){const card=element('article','event-card discovery-card'),start=new Date(row.startsAt),end=new Date(row.endsAt),badge=element('div','event-date');badge.append(element('strong','',date.format(start)),element('span','',`${start.getFullYear()} · 台北時間`));card.append(badge,element('span','content-kind',({ONLINE:'線上活動',OFFLINE:'實體活動',HYBRID:'線上與實體'})[row.eventType]||'品牌活動'),element('h3','',row.title),element('p','event-description',row.description||'查看活動詳情，安排您的下一次參與。'),element('p','event-time',`${date.format(start)} ${time.format(start)} — ${date.format(end)} ${time.format(end)}`),link(row.canRegister?'查看詳情與報名':'查看活動詳情',`${member}/events?event=${encodeURIComponent(row.eventCode)}`));list.append(card);}
   }
  }catch{lists.forEach(n=>failure(n,events));}finally{lists.forEach(n=>n.setAttribute('aria-busy','false'));}
 }
 async function content(){
  const list=document.querySelector('[data-content-list]');if(!list)return;
  const search=document.querySelector('[data-content-search]'),buttons=[...document.querySelectorAll('[data-content-filter]')],count=document.querySelector('[data-content-count]');let filter='ALL';
  const load=async()=>{list.setAttribute('aria-busy','true');try{
   const rows=(await read('content')).filter(r=>{try{const u=new URL(r.url);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}});
   const render=()=>{const query=(search?.value||'').trim().toLocaleLowerCase(),visible=rows.filter(r=>(filter==='ALL'||r.type===filter)&&`${r.title} ${r.summary||''}`.toLocaleLowerCase().includes(query));list.replaceChildren();if(count)count.textContent=`${visible.length} 則內容`;
    if(!visible.length){status(list,rows.length?'沒有符合的內容':'精彩內容，陸續登場',rows.length?'試試其他關鍵字，或切換內容分類。':'我們會在這裡分享核准公開的品牌影片與閱讀素材。您也可以先探索官方 YouTube 頻道。',rows.length?undefined:link('探索官方 YouTube','https://youtube.com/@ucell_life','btn btn-line'));return;}
    for(const row of visible){const video=row.type==='VIDEO_EXTERNAL',card=element('article','resource-card discovery-card'),visual=element('div',`resource-visual ${video?'video':'reading'}`);visual.setAttribute('aria-hidden','true');visual.append(element('span','',video?'▶':'≡'),element('small','',video?'UCELL FILMS':'UCELL LIBRARY'));if(row.thumbnailUrl){try{const imageUrl=new URL(row.thumbnailUrl);if(imageUrl.protocol==='https:'&&!imageUrl.username&&!imageUrl.password){const img=element('img','resource-thumbnail');img.src=imageUrl.href;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();visual.append(img);}}catch{}}
     const body=element('div','resource-body'),a=link(video?'觀看影片 →':'探索素材 →',member+'/watch/'+encodeURIComponent(row.id),'resource-link');a.setAttribute('aria-label',`${video?'觀看影片':'開啟素材'}：${row.title}`);body.append(element('span','content-kind',video?'品牌影音':'閱讀素材'),element('h3','',row.title),element('p','',row.summary||'探索 UCell 的品牌與產品資訊。'),a);card.append(visual,body);list.append(card);}
   };
   buttons.forEach(b=>b.onclick=()=>{filter=b.dataset.contentFilter;buttons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render()});if(search)search.oninput=render;render();
  }catch{if(count)count.textContent='';failure(list,load);}finally{list.setAttribute('aria-busy','false');}};await load();
 }
 document.addEventListener('DOMContentLoaded',()=>{
  document.querySelector('[data-catalog-search]')?.addEventListener('input',renderCatalog);
  document.querySelector('[data-catalog-clear]')?.addEventListener('click',()=>{const search=document.querySelector('[data-catalog-search]');search.value='';renderCatalog();search.focus();});
  void products();void events();void content();
 });
})();
