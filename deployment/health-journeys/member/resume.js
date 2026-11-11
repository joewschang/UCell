import {apiFor} from '../context-ui.js';
let click;try{click=JSON.parse(sessionStorage.getItem('ucell.health.click'));}catch{}
if(click&&click.expires>Date.now()&&sessionStorage.getItem('ucell_member_token')){
 const {attempt,visitor,game,resource}=click,api=apiFor('member');
 const startUrl=new URL(click.href,location.origin);
 const matches=()=>location.pathname===startUrl.pathname&&startUrl.search===location.search;
 const metric=action=>api('/journey/event','POST',{attempt,visitor,game,resource,action}).catch(()=>{});
 if(matches())metric('detail');
 window.addEventListener('uc-health-cart',e=>{if(resource==='sku:'+e.detail)metric('cart');});
 window.addEventListener('uc-health-order',e=>api('/journey/order','POST',{attempt,visitor,order:e.detail}).catch(()=>{}));
 window.addEventListener('uc-health-register',e=>{if(resource===e.detail)metric('registration_start');});
}
const key='ucell.health.return';
let req;try{req=JSON.parse(sessionStorage.getItem(key));}catch{}
if(req&&req.until>Date.now()&&/^\/health\/(?!\/)/.test(req.target)){
 const timer=setInterval(()=>{
   if(req.until<Date.now()){sessionStorage.removeItem(key);clearInterval(timer);return;}
   if(sessionStorage.getItem('ucell_member_token')){clearInterval(timer);sessionStorage.removeItem(key);location.replace(req.target);}
 },500);
}
const back=Number(sessionStorage.getItem('ucell.health.back'));
if(back&&Date.now()-back<3600000){
 const destinations=/^\/(?:shop|orders?|checkout|events|learning|mall|products)(?:\/|$)/;
 function update(){
 const old=document.querySelector('#health-return');
 if(!destinations.test(location.pathname)){old?.remove();return;}
 if(!old){const a=document.createElement('a');a.href='/health/';a.id='health-return';a.textContent='返回健康護照';a.style.cssText='display:block;width:fit-content;margin:1rem auto 6rem;padding:.75rem 1.2rem;background:#124c41;color:white;border-radius:2rem';document.body.append(a);}
 }
 update();new MutationObserver(update).observe(document.body,{childList:true,subtree:true});
}
