const admin=location.hostname.startsWith('admin.');
const link=document.createElement('a'),tags=document.createElement('div');
link.href='/topics/';link.textContent=admin?'標籤管理':'# 主題探索';
link.style.cssText='display:inline-flex;align-items:center;min-height:44px;padding:0 .85rem;border:1px solid currentColor;border-radius:.65rem;color:inherit;font-weight:650;text-decoration:none;margin:.4rem';
tags.setAttribute('aria-label','相關主題');
let requested='',generation=0;
async function resourceTags(id){
 const serial=++generation;tags.replaceChildren();
 if(!id)return;
 const token=sessionStorage.getItem('ucell_member_token'),role=token?'member':'public';
 try{
 const r=await fetch('https://api.ucell.life/api/v1/'+role+'/health-game/topics',{headers:token?{Authorization:'Bearer '+token}:{},cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!r.ok)return;
 const data=(await r.json()).data.rows.find(r=>r.id===id);
 if(serial!==generation||!data)return;
 for(const t of data.tags){const a=link.cloneNode(false);a.textContent='#'+t;a.href='/topics/?tag='+encodeURIComponent(t);tags.append(a);}
 }catch{}
}
function sync(){
 const path=location.pathname,q=new URLSearchParams(location.search),health=path.startsWith('/health');
 const sku=path==='/shop'&&q.get('sku'),event=path==='/events'&&q.get('event'),course=path==='/learning'&&q.get('course'),content=path.match(/^\/content\/([\da-f-]{36})\/?$/i);
 const id=sku?'sku:'+sku:event?'event:'+event:course?'course:'+course:content?'content:'+content[1]:health?q.get('read')||'game':'';
 if(!admin&&id!==requested){requested=id;resourceTags(id);}
 const main=document.querySelector('main');
 if(!admin&&id&&main&&!main.contains(tags))main.append(tags);else if(!id&&tags.isConnected)tags.remove();
 const host=health?document.querySelector('header'):admin?document.querySelector('nav,aside,main'):path==='/explore'?main:null;
 if(host&&!host.contains(link))host.prepend(link);else if(!host&&link.isConnected)link.remove();
}
sync();new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});window.addEventListener('popstate',sync);
