import {apiFor,link} from './context-ui.js';
let active='',generation=0,entry=null;
function sync(){
 const main=document.querySelector('main');
 const token=sessionStorage.getItem('ucell_member_token');
 const content=location.pathname.match(/^\/content\/([\da-f-]{36})\/?$/i);
 const sku=location.pathname==='/shop'&&new URLSearchParams(location.search).get('sku');
 const id=token&&main&&(content?'content:'+content[1]:sku?'sku:'+sku:'');
 if(id===active){if(entry&&main&&!entry.isConnected)main.append(entry);return;}
 active=id;const n=++generation;entry?.remove();entry=null;if(!id)return;
 apiFor('member')('').then(data=>{
 if(n!==generation||!data.open)return;
 const item=data.resources.find(r=>r.id===id);if(!item?.tags.length)return;
 entry=document.createElement('aside');entry.className='card';entry.setAttribute('aria-label','健康中心相關主題');
 entry.append(link('健康中心 · '+item.tags.map(t=>'#'+t).join(' ')+' →','/health/?from='+encodeURIComponent(id)));main.append(entry);
 }).catch(()=>{});
}
new MutationObserver(sync).observe(document.body,{subtree:true,childList:true});
window.addEventListener('popstate',sync);sync();
