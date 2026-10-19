(()=>{
 const member='https://member.ucell.life';
 const money=(value,currency)=>currency==='TWD'?`NT$${new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(Number(value))}`:new Intl.NumberFormat('zh-TW',{style:'currency',currency,maximumFractionDigits:2}).format(Number(value));
 const element=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text)el.textContent=text;return el;};
 const link=(text,href,className='btn btn-navy')=>{const a=element('a',className,text);a.href=href;return a;};
 async function read(kind){const response=await fetch(`/api/public/${kind}`,{credentials:'omit',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('讀取失敗');const body=await response.json();if(!Array.isArray(body.data))throw Error('資料格式錯誤');return body.data;}
 function status(node,title,description,action){const box=element('div','discovery-state');box.append(element('span','state-symbol','○'),element('h3','',title),element('p','',description));if(action)box.append(action);node.replaceChildren(box);}
 function failure(node,retry){const button=element('button','btn btn-line','重新載入');button.type='button';button.onclick=retry;status(node,'資料暫時無法載入','請檢查網路連線，或稍後再試。',button);}
 async function products(){
  const nodes=[...document.querySelectorAll('[data-product-sku]')];if(!nodes.length)return;
  try{const catalog=new Map((await read('products')).map(p=>[p.sku,p]));
   for(const node of nodes){const p=catalog.get(node.dataset.productSku),price=node.querySelector('[data-product-price]'),buy=node.querySelector('[data-product-buy]'),title=node.querySelector('h3,h1');
    if(p&&title)title.textContent=p.name;
    if(price)price.textContent=p?`${money(p.price,p.currency)} / 盒${p.available?'':' · 暫未開放購買'}`:'目前未上架';
    if(buy){buy.hidden=!p?.available;buy.href=`${member}/shop?sku=${encodeURIComponent(node.dataset.productSku)}`;buy.textContent='選購此商品';}
    node.classList.toggle('is-unavailable',!p?.available);
   }
  }catch{for(const node of nodes){const price=node.querySelector('[data-product-price]'),buy=node.querySelector('[data-product-buy]');if(price){price.textContent='暫時無法取得最新價格 ';const retry=element('button','link','重新載入');retry.type='button';retry.onclick=products;price.append(retry);}if(buy)buy.hidden=true;}}
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
    for(const row of visible){const video=row.type==='VIDEO_EXTERNAL',card=element('article','resource-card discovery-card'),visual=element('div',`resource-visual ${video?'video':'reading'}`);visual.setAttribute('aria-hidden','true');visual.append(element('span','',video?'▶':'≡'),element('small','',video?'UCELL FILMS':'UCELL LIBRARY'));const body=element('div','resource-body'),a=link(video?'觀看影片 ↗':'開啟素材 ↗',row.url,'resource-link');a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',`${video?'觀看影片':'開啟素材'}：${row.title}（另開視窗）`);body.append(element('span','content-kind',video?'品牌影音':'閱讀素材'),element('h3','',row.title),element('p','',row.summary||'探索 UCell 的品牌與產品資訊。'),a);card.append(visual,body);list.append(card);}
   };
   buttons.forEach(b=>b.onclick=()=>{filter=b.dataset.contentFilter;buttons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render()});if(search)search.oninput=render;render();
  }catch{if(count)count.textContent='';failure(list,load);}finally{list.setAttribute('aria-busy','false');}};await load();
 }
 document.addEventListener('DOMContentLoaded',()=>{void products();void events();void content();const button=document.querySelector('.burger');button?.setAttribute('aria-expanded','false');button?.addEventListener('click',()=>button.setAttribute('aria-expanded',String(document.querySelector('.menu')?.classList.contains('open'))));});
})();
